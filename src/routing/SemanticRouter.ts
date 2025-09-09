/**
 * Semantic Router for MCP Intelligence
 * 
 * Intelligently routes queries to the appropriate MCP servers
 * based on semantic understanding of the intent.
 */

import { 
  Intent, 
  RoutingDecision, 
  ServerRegistration,
  RoutingError 
} from '../types/intelligence';
import { ServerRegistry } from '../registry/ServerRegistry';
import { NLPProcessor } from '../nlp/NLPProcessor';
import { Logger } from '../utils/logger';

export class SemanticRouter {
  private logger: Logger;
  private serverRegistry: ServerRegistry;
  private nlpProcessor: NLPProcessor;
  private routingCache: Map<string, RoutingDecision>;

  constructor(serverRegistry: ServerRegistry, nlpProcessor: NLPProcessor) {
    this.logger = new Logger('SemanticRouter');
    this.serverRegistry = serverRegistry;
    this.nlpProcessor = nlpProcessor;
    this.routingCache = new Map();
  }

  /**
   * Route an intent to the best server and tool
   */
  async route(intent: Intent): Promise<RoutingDecision> {
    this.logger.debug('Routing intent:', intent);
    
    try {
      // Check cache first
      const cacheKey = this.getCacheKey(intent);
      if (this.routingCache.has(cacheKey)) {
        this.logger.debug('Using cached routing decision');
        return this.routingCache.get(cacheKey)!;
      }

      // Find candidate servers
      const candidates = await this.serverRegistry.findServersForIntent(intent);
      
      if (candidates.length === 0) {
        throw new RoutingError('No servers found for intent', { intent });
      }

      // Rank servers by relevance
      const ranked = this.serverRegistry.rankServersByRelevance(candidates, intent);
      
      // Select the best server
      const bestServer = ranked[0];
      
      // Determine the specific tool/operation
      const tool = this.selectTool(bestServer, intent);
      
      // Build parameters
      const params = this.buildParameters(intent);
      
      // Create routing decision
      const decision: RoutingDecision = {
        server: bestServer.name,
        tool,
        params,
        protocol: bestServer.capability.protocol,
        confidence: this.calculateRoutingConfidence(bestServer, intent),
        alternates: ranked.slice(1, 3).map(server => ({
          server: server.name,
          tool: this.selectTool(server, intent),
          params,
          protocol: server.capability.protocol,
          confidence: this.calculateRoutingConfidence(server, intent)
        })),
        reasoning: this.generateRoutingReasoning(bestServer, intent)
      };

      // Cache the decision
      this.routingCache.set(cacheKey, decision);
      
      // Clean cache if too large
      if (this.routingCache.size > 1000) {
        const firstKey = this.routingCache.keys().next().value;
        this.routingCache.delete(firstKey);
      }

      this.logger.info(`Routed to ${decision.server}.${decision.tool} with confidence ${decision.confidence}`);
      return decision;

    } catch (error) {
      this.logger.error('Routing failed:', error);
      throw new RoutingError(`Failed to route intent: ${error.message}`, { intent, error });
    }
  }

  /**
   * Select the specific tool/operation for a server
   */
  private selectTool(server: ServerRegistration, intent: Intent): string {
    const { action, entities } = intent;
    
    // Map intent action to server operations
    const operationMap: Record<string, string[]> = {
      query: ['list', 'get', 'find', 'search', 'query'],
      create: ['create', 'add', 'insert', 'post'],
      update: ['update', 'modify', 'patch', 'put'],
      delete: ['delete', 'remove', 'destroy'],
      sync: ['sync', 'synchronize', 'replicate'],
      analyze: ['analyze', 'aggregate', 'report']
    };

    const possibleOps = operationMap[action] || [action];
    
    // Find matching operation in server capabilities
    for (const op of possibleOps) {
      if (server.capability.operations.includes(op)) {
        // Build tool name based on entity and operation
        if (entities.length > 0) {
          const entity = entities[0].type;
          return `${op}_${entity}`;
        }
        return op;
      }
    }

    // Default to first available operation
    return server.capability.operations[0] || 'query';
  }

  /**
   * Build parameters from intent
   */
  private buildParameters(intent: Intent): any {
    const params: any = {};

    // Add filters
    if (intent.filters) {
      intent.filters.forEach(filter => {
        params[filter.field] = filter.value;
      });
    }

    // Add entities
    if (intent.entities.length > 0) {
      intent.entities.forEach(entity => {
        if (entity.role === 'filter') {
          params[entity.type] = entity.value;
        }
      });
    }

    // Add timeframe
    if (intent.timeframe) {
      if (intent.timeframe.start) {
        params.startDate = intent.timeframe.start.toISOString();
      }
      if (intent.timeframe.end) {
        params.endDate = intent.timeframe.end.toISOString();
      }
      if (intent.timeframe.relative) {
        params.timeframe = intent.timeframe.relative;
      }
    }

    // Add aggregation
    if (intent.aggregation) {
      params.aggregation = intent.aggregation;
    }

    return params;
  }

  /**
   * Calculate confidence score for routing decision
   */
  private calculateRoutingConfidence(server: ServerRegistration, intent: Intent): number {
    let confidence = 0.5; // Base confidence

    // Check entity support
    const supportedEntities = intent.entities.filter(e => 
      server.capability.entities.includes(e.type)
    );
    confidence += (supportedEntities.length / Math.max(intent.entities.length, 1)) * 0.2;

    // Check operation support
    if (server.capability.operations.includes(intent.action)) {
      confidence += 0.2;
    }

    // Server health score
    const healthScore = 1 - (server.metrics?.errorRate || 0);
    confidence += healthScore * 0.1;

    return Math.min(confidence, 1.0);
  }

  /**
   * Generate human-readable routing reasoning
   */
  private generateRoutingReasoning(server: ServerRegistration, intent: Intent): string {
    const reasons = [];

    // Entity support
    const supportedEntities = intent.entities
      .filter(e => server.capability.entities.includes(e.type))
      .map(e => e.type);
    
    if (supportedEntities.length > 0) {
      reasons.push(`Supports entities: ${supportedEntities.join(', ')}`);
    }

    // Operation support
    if (server.capability.operations.includes(intent.action)) {
      reasons.push(`Can perform ${intent.action} operations`);
    }

    // Domain match
    if (intent.context?.domain && server.capability.domains.includes(intent.context.domain)) {
      reasons.push(`Specializes in ${intent.context.domain}`);
    }

    // Performance
    if (server.metrics && server.metrics.avgResponseTime < 1000) {
      reasons.push('Fast response time');
    }

    return reasons.join('; ');
  }

  /**
   * Generate cache key for intent
   */
  private getCacheKey(intent: Intent): string {
    const key = [
      intent.action,
      ...intent.entities.map(e => `${e.type}:${e.value}`),
      ...(intent.filters || []).map(f => `${f.field}:${f.operator}:${f.value}`)
    ].join('|');
    
    return key;
  }

  /**
   * Clear routing cache
   */
  clearCache(): void {
    this.routingCache.clear();
    this.logger.info('Routing cache cleared');
  }

  /**
   * Get routing statistics
   */
  getStatistics(): any {
    return {
      cacheSize: this.routingCache.size,
      cachedRoutes: Array.from(this.routingCache.keys())
    };
  }
}