/**
 * MCP Intelligence - Semantic Intelligence Layer for MCP Servers
 * 
 * This is the brain that understands natural language, reasons about data,
 * and intelligently routes to appropriate MCP servers.
 */

import { EventEmitter } from 'events';
import { createOrchestraV2, OrchestraV2 } from '@agent-orchestra/core';
import { NLPProcessor } from '../nlp/NLPProcessor';
import { ServerRegistry } from '../registry/ServerRegistry';
import { SemanticRouter } from '../routing/SemanticRouter';
import { ValidationEngine } from '../validation/ValidationEngine';
import { LearningSystem } from '../learning/LearningSystem';
import { Logger } from '../utils/logger';
import { 
  MCPIntelligenceConfig, 
  QueryResult, 
  Intent, 
  ServerCapability,
  ValidationResult 
} from '../types';

export class MCPIntelligence extends EventEmitter {
  private orchestra: OrchestraV2;
  private nlpProcessor: NLPProcessor;
  private serverRegistry: ServerRegistry;
  private semanticRouter: SemanticRouter;
  private validationEngine: ValidationEngine;
  private learningSystem: LearningSystem;
  private logger: Logger;
  private config: MCPIntelligenceConfig;
  private initialized: boolean = false;

  constructor(config?: MCPIntelligenceConfig) {
    super();
    this.config = config || this.getDefaultConfig();
    this.logger = new Logger('MCPIntelligence');
    
    // Initialize components
    this.nlpProcessor = new NLPProcessor();
    this.serverRegistry = new ServerRegistry();
    this.semanticRouter = new SemanticRouter(this.serverRegistry, this.nlpProcessor);
    this.validationEngine = new ValidationEngine();
    this.learningSystem = new LearningSystem();
  }

  /**
   * Initialize MCP Intelligence with Agent Orchestra
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.warn('MCP Intelligence already initialized');
      return;
    }

    this.logger.info('Initializing MCP Intelligence...');

    // Initialize Agent Orchestra for execution
    this.orchestra = await createOrchestraV2({
      protocols: {
        mcp: true,
        rest: this.config.enabledProtocols?.rest || false,
        soap: this.config.enabledProtocols?.soap || false,
        graphql: this.config.enabledProtocols?.graphql || false,
        websocket: this.config.enabledProtocols?.websocket || false,
        lambda: this.config.enabledProtocols?.lambda || false
      }
    });

    // Initialize components
    await this.nlpProcessor.initialize();
    await this.serverRegistry.initialize();
    await this.validationEngine.initialize();
    await this.learningSystem.initialize();

    // Load server capabilities
    await this.loadServerCapabilities();

    this.initialized = true;
    this.logger.info('MCP Intelligence initialized successfully');
    this.emit('initialized');
  }

  /**
   * Process a natural language query
   */
  async query(naturalLanguageQuery: string, context?: any): Promise<QueryResult> {
    if (!this.initialized) {
      throw new Error('MCP Intelligence not initialized. Call initialize() first.');
    }

    this.logger.info(`Processing query: "${naturalLanguageQuery}"`);
    const startTime = Date.now();

    try {
      // Step 1: Parse and understand the query
      const intent = await this.nlpProcessor.parseIntent(naturalLanguageQuery, context);
      this.logger.debug('Parsed intent:', intent);

      // Step 2: Route to appropriate server(s)
      const routingDecision = await this.semanticRouter.route(intent);
      this.logger.debug('Routing decision:', routingDecision);

      // Step 3: Validate the operation
      const validationResult = await this.validationEngine.validateOperation(
        routingDecision,
        intent,
        context
      );

      if (!validationResult.isValid) {
        this.logger.warn('Validation failed:', validationResult.errors);
        return {
          success: false,
          error: `Validation failed: ${validationResult.errors.join(', ')}`,
          intent,
          duration: Date.now() - startTime
        };
      }

      // Step 4: Execute through Agent Orchestra
      const executionResult = await this.executeWithOrchestra(routingDecision);

      // Step 5: Validate the result
      const resultValidation = await this.validationEngine.validateResult(
        executionResult,
        intent
      );

      if (!resultValidation.isValid) {
        this.logger.warn('Result validation failed:', resultValidation.errors);
      }

      // Step 6: Learn from this interaction
      await this.learningSystem.recordInteraction({
        query: naturalLanguageQuery,
        intent,
        routing: routingDecision,
        result: executionResult,
        duration: Date.now() - startTime,
        validation: resultValidation
      });

      // Step 7: Format and return the result
      return {
        success: true,
        data: executionResult,
        intent,
        routing: routingDecision,
        validation: resultValidation,
        duration: Date.now() - startTime,
        confidence: this.calculateConfidence(intent, routingDecision, resultValidation)
      };

    } catch (error) {
      this.logger.error('Query processing failed:', error);
      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Register an MCP server with its capabilities
   */
  async registerServer(name: string, capability: ServerCapability): Promise<void> {
    this.logger.info(`Registering server: ${name}`);
    await this.serverRegistry.register(name, capability);
    
    // Register with Agent Orchestra if it's an MCP server
    if (capability.protocol === 'mcp') {
      await this.orchestra.addMCPServer({
        name,
        package: capability.package
      });
    }
  }

  /**
   * Get intelligent suggestions based on partial query
   */
  async getSuggestions(partialQuery: string, limit: number = 5): Promise<string[]> {
    const patterns = await this.learningSystem.getFrequentPatterns();
    const suggestions = await this.nlpProcessor.generateSuggestions(
      partialQuery,
      patterns,
      limit
    );
    return suggestions;
  }

  /**
   * Explain a query result
   */
  async explain(queryResult: QueryResult): Promise<string> {
    const explanation = await this.nlpProcessor.generateExplanation(queryResult);
    return explanation;
  }

  /**
   * Execute routing decision through Agent Orchestra
   */
  private async executeWithOrchestra(routingDecision: any): Promise<any> {
    const { server, tool, params, protocol } = routingDecision;
    
    this.logger.debug(`Executing: ${protocol}.${server}.${tool}`);
    
    if (protocol === 'mcp') {
      return await this.orchestra.execute('mcp', `${server}.${tool}`, params);
    } else {
      return await this.orchestra.execute(protocol, tool, params);
    }
  }

  /**
   * Load server capabilities from configuration
   */
  private async loadServerCapabilities(): Promise<void> {
    // Load PMIP-specific servers
    if (this.config.pmipIntegration) {
      await this.registerServer('propertyware', {
        protocol: 'soap',
        package: 'propertyware-adapter',
        domains: ['property_management'],
        entities: ['portfolio', 'building', 'unit', 'work_order', 'lease', 'tenant'],
        operations: ['query', 'create', 'update', 'sync'],
        description: 'PropertyWare SOAP API for property management'
      });

      await this.registerServer('servicefusion', {
        protocol: 'rest',
        package: 'servicefusion-adapter',
        domains: ['property_management', 'maintenance'],
        entities: ['customer', 'job', 'vendor', 'invoice'],
        operations: ['query', 'create', 'update', 'dispatch'],
        description: 'ServiceFusion REST API for service management'
      });

      await this.registerServer('airtable', {
        protocol: 'mcp',
        package: '@rashidazarang/airtable-mcp',
        domains: ['property_management', 'general'],
        entities: ['record', 'table', 'base'],
        operations: ['query', 'create', 'update', 'delete'],
        description: 'Airtable MCP for flexible data management'
      });

      await this.registerServer('supabase', {
        protocol: 'mcp',
        package: '@supabase/mcp-server',
        domains: ['data_warehouse', 'analytics'],
        entities: ['table', 'view', 'function'],
        operations: ['query', 'insert', 'update', 'delete', 'upsert'],
        description: 'Supabase data warehouse'
      });
    }

    // Load additional servers from config
    if (this.config.servers) {
      for (const [name, capability] of Object.entries(this.config.servers)) {
        await this.registerServer(name, capability as ServerCapability);
      }
    }
  }

  /**
   * Calculate confidence score for a query result
   */
  private calculateConfidence(
    intent: Intent,
    routingDecision: any,
    validation: ValidationResult
  ): number {
    let confidence = 0.5; // Base confidence

    // Intent confidence
    confidence += (intent.confidence || 0.5) * 0.3;

    // Routing confidence
    confidence += (routingDecision.confidence || 0.5) * 0.3;

    // Validation confidence
    confidence += validation.isValid ? 0.4 : 0;

    return Math.min(confidence, 1.0);
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): MCPIntelligenceConfig {
    return {
      enabledProtocols: {
        mcp: true,
        rest: true,
        soap: true,
        graphql: false,
        websocket: false,
        lambda: true
      },
      pmipIntegration: true,
      learning: {
        enabled: true,
        minConfidence: 0.7,
        maxHistorySize: 1000
      },
      validation: {
        enabled: true,
        strict: false
      },
      cache: {
        enabled: true,
        ttl: 300000 // 5 minutes
      }
    };
  }

  /**
   * Shutdown MCP Intelligence
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down MCP Intelligence...');
    
    await this.learningSystem.save();
    await this.orchestra?.shutdown();
    
    this.initialized = false;
    this.emit('shutdown');
  }
}