/**
 * Server Registry for MCP Intelligence
 * 
 * Maintains a registry of all available servers, their capabilities,
 * and provides intelligent server selection based on queries.
 */

import { EventEmitter } from 'events';
import Fuse from 'fuse.js';
import { 
  ServerCapability, 
  ServerRegistration,
  Intent,
  Entity 
} from '../types/intelligence';
import { Logger } from '../utils/logger';

export class ServerRegistry extends EventEmitter {
  private logger: Logger;
  private servers: Map<string, ServerRegistration>;
  private domainIndex: Map<string, Set<string>>; // domain -> server names
  private entityIndex: Map<string, Set<string>>; // entity -> server names
  private operationIndex: Map<string, Set<string>>; // operation -> server names
  private fuzzySearch: Fuse<ServerRegistration>;

  constructor() {
    super();
    this.logger = new Logger('ServerRegistry');
    this.servers = new Map();
    this.domainIndex = new Map();
    this.entityIndex = new Map();
    this.operationIndex = new Map();
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing Server Registry...');
    
    // Initialize fuzzy search
    this.updateFuzzySearch();
    
    // Start health check interval
    this.startHealthChecks();
    
    this.logger.info('Server Registry initialized');
  }

  /**
   * Register a server with its capabilities
   */
  async register(name: string, capability: ServerCapability): Promise<void> {
    this.logger.info(`Registering server: ${name}`);
    
    // Create server registration
    const registration: ServerRegistration = {
      name,
      capability,
      status: 'active',
      lastHealthCheck: new Date(),
      metrics: {
        totalRequests: 0,
        avgResponseTime: 0,
        errorRate: 0
      }
    };
    
    // Store in registry
    this.servers.set(name, registration);
    
    // Update indices
    this.updateIndices(name, capability);
    
    // Update fuzzy search
    this.updateFuzzySearch();
    
    this.logger.debug(`Server ${name} registered with capabilities:`, capability);
    this.emit('server:registered', { name, capability });
  }

  /**
   * Find servers that can handle a specific intent
   */
  async findServersForIntent(intent: Intent): Promise<ServerRegistration[]> {
    const candidates = new Set<string>();
    
    // Find by entities
    intent.entities.forEach(entity => {
      const servers = this.entityIndex.get(entity.type);
      if (servers) {
        servers.forEach(server => candidates.add(server));
      }
    });
    
    // Find by operation
    const operationServers = this.operationIndex.get(intent.action);
    if (operationServers) {
      operationServers.forEach(server => candidates.add(server));
    }
    
    // Find by domain context
    if (intent.context?.domain) {
      const domainServers = this.domainIndex.get(intent.context.domain);
      if (domainServers) {
        domainServers.forEach(server => candidates.add(server));
      }
    }
    
    // Convert to registrations
    const registrations = Array.from(candidates)
      .map(name => this.servers.get(name))
      .filter(reg => reg && reg.status === 'active') as ServerRegistration[];
    
    // If no exact matches, use fuzzy search
    if (registrations.length === 0) {
      return this.fuzzyFindServers(intent);
    }
    
    return registrations;
  }

  /**
   * Find servers by domain
   */
  findServersByDomain(domain: string): ServerRegistration[] {
    const serverNames = this.domainIndex.get(domain);
    if (!serverNames) return [];
    
    return Array.from(serverNames)
      .map(name => this.servers.get(name))
      .filter(reg => reg && reg.status === 'active') as ServerRegistration[];
  }

  /**
   * Find servers by entity type
   */
  findServersByEntity(entityType: string): ServerRegistration[] {
    const serverNames = this.entityIndex.get(entityType);
    if (!serverNames) return [];
    
    return Array.from(serverNames)
      .map(name => this.servers.get(name))
      .filter(reg => reg && reg.status === 'active') as ServerRegistration[];
  }

  /**
   * Find servers by operation
   */
  findServersByOperation(operation: string): ServerRegistration[] {
    const serverNames = this.operationIndex.get(operation);
    if (!serverNames) return [];
    
    return Array.from(serverNames)
      .map(name => this.servers.get(name))
      .filter(reg => reg && reg.status === 'active') as ServerRegistration[];
  }

  /**
   * Get server by name
   */
  getServer(name: string): ServerRegistration | undefined {
    return this.servers.get(name);
  }

  /**
   * Get all registered servers
   */
  getAllServers(): ServerRegistration[] {
    return Array.from(this.servers.values());
  }

  /**
   * Update server metrics
   */
  updateMetrics(
    serverName: string,
    requestTime: number,
    success: boolean
  ): void {
    const server = this.servers.get(serverName);
    if (!server) return;
    
    const metrics = server.metrics!;
    
    // Update total requests
    metrics.totalRequests++;
    
    // Update average response time
    metrics.avgResponseTime = 
      (metrics.avgResponseTime * (metrics.totalRequests - 1) + requestTime) / 
      metrics.totalRequests;
    
    // Update error rate
    if (!success) {
      metrics.errorRate = 
        ((metrics.errorRate * (metrics.totalRequests - 1)) + 1) / 
        metrics.totalRequests;
    } else {
      metrics.errorRate = 
        (metrics.errorRate * (metrics.totalRequests - 1)) / 
        metrics.totalRequests;
    }
    
    this.emit('metrics:updated', { serverName, metrics });
  }

  /**
   * Rank servers by relevance to intent
   */
  rankServersByRelevance(
    servers: ServerRegistration[],
    intent: Intent
  ): ServerRegistration[] {
    // Score each server
    const scored = servers.map(server => {
      let score = 0;
      
      // Entity match score
      const entityMatches = intent.entities.filter(entity =>
        server.capability.entities.includes(entity.type)
      ).length;
      score += entityMatches * 3;
      
      // Operation match score
      if (server.capability.operations.includes(intent.action)) {
        score += 5;
      }
      
      // Domain match score (if context provided)
      if (intent.context?.domain && 
          server.capability.domains.includes(intent.context.domain)) {
        score += 4;
      }
      
      // Performance score (lower error rate is better)
      const errorPenalty = server.metrics!.errorRate * 2;
      score -= errorPenalty;
      
      // Response time score (faster is better)
      const timePenalty = (server.metrics!.avgResponseTime / 1000) * 0.5;
      score -= timePenalty;
      
      return { server, score };
    });
    
    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    
    return scored.map(s => s.server);
  }

  /**
   * Check if a server can handle specific entities
   */
  canHandleEntities(serverName: string, entities: Entity[]): boolean {
    const server = this.servers.get(serverName);
    if (!server) return false;
    
    return entities.every(entity =>
      server.capability.entities.includes(entity.type)
    );
  }

  /**
   * Check if a server can perform an operation
   */
  canPerformOperation(serverName: string, operation: string): boolean {
    const server = this.servers.get(serverName);
    if (!server) return false;
    
    return server.capability.operations.includes(operation);
  }

  /**
   * Update indices when a server is registered
   */
  private updateIndices(name: string, capability: ServerCapability): void {
    // Update domain index
    capability.domains.forEach(domain => {
      if (!this.domainIndex.has(domain)) {
        this.domainIndex.set(domain, new Set());
      }
      this.domainIndex.get(domain)!.add(name);
    });
    
    // Update entity index
    capability.entities.forEach(entity => {
      if (!this.entityIndex.has(entity)) {
        this.entityIndex.set(entity, new Set());
      }
      this.entityIndex.get(entity)!.add(name);
    });
    
    // Update operation index
    capability.operations.forEach(operation => {
      if (!this.operationIndex.has(operation)) {
        this.operationIndex.set(operation, new Set());
      }
      this.operationIndex.get(operation)!.add(name);
    });
  }

  /**
   * Update fuzzy search index
   */
  private updateFuzzySearch(): void {
    const servers = Array.from(this.servers.values());
    
    this.fuzzySearch = new Fuse(servers, {
      keys: [
        'name',
        'capability.description',
        'capability.domains',
        'capability.entities',
        'capability.operations'
      ],
      threshold: 0.4,
      includeScore: true
    });
  }

  /**
   * Fuzzy find servers when exact matches fail
   */
  private fuzzyFindServers(intent: Intent): ServerRegistration[] {
    // Build search query from intent
    const searchTerms = [
      intent.action,
      ...intent.entities.map(e => e.type),
      ...intent.entities.map(e => e.value)
    ].join(' ');
    
    const results = this.fuzzySearch.search(searchTerms);
    
    return results
      .filter(result => result.score! < 0.5) // Only include good matches
      .map(result => result.item);
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    setInterval(() => {
      this.servers.forEach((server, name) => {
        // Simple health check - mark as active if recently used
        const timeSinceLastCheck = Date.now() - server.lastHealthCheck!.getTime();
        
        if (timeSinceLastCheck > 300000) { // 5 minutes
          server.status = 'inactive';
          this.logger.warn(`Server ${name} marked as inactive`);
        }
      });
    }, 60000); // Check every minute
  }

  /**
   * Mark server as healthy
   */
  markHealthy(serverName: string): void {
    const server = this.servers.get(serverName);
    if (server) {
      server.status = 'active';
      server.lastHealthCheck = new Date();
    }
  }

  /**
   * Mark server as unhealthy
   */
  markUnhealthy(serverName: string, error?: string): void {
    const server = this.servers.get(serverName);
    if (server) {
      server.status = 'error';
      this.logger.error(`Server ${serverName} marked as unhealthy: ${error}`);
      this.emit('server:unhealthy', { serverName, error });
    }
  }

  /**
   * Remove a server from registry
   */
  unregister(serverName: string): void {
    const server = this.servers.get(serverName);
    if (!server) return;
    
    // Remove from indices
    server.capability.domains.forEach(domain => {
      this.domainIndex.get(domain)?.delete(serverName);
    });
    
    server.capability.entities.forEach(entity => {
      this.entityIndex.get(entity)?.delete(serverName);
    });
    
    server.capability.operations.forEach(operation => {
      this.operationIndex.get(operation)?.delete(serverName);
    });
    
    // Remove from registry
    this.servers.delete(serverName);
    
    // Update fuzzy search
    this.updateFuzzySearch();
    
    this.logger.info(`Server ${serverName} unregistered`);
    this.emit('server:unregistered', { serverName });
  }
}