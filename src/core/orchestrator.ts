/**
 * Core Orchestrator
 * 
 * Manages multiple MCP servers and provides unified interface
 */

import { EventEmitter } from 'events';
import { MCPServerManager } from '../servers/manager';
import { Router } from '../routing/router';
import { WorkflowEngine } from '../workflows/engine';
import { Cache } from '../utils/cache';
import { Logger } from '../utils/logger';
import { 
  OrchestratorConfig, 
  MCPTool, 
  ToolExecutionResult,
  MCPServer 
} from '../types';

export class MCPOrchestrator extends EventEmitter {
  private serverManager: MCPServerManager;
  private router: Router;
  private workflowEngine: WorkflowEngine;
  private cache: Cache;
  private logger: Logger;
  private config: OrchestratorConfig;
  private initialized: boolean = false;

  constructor() {
    super();
    this.logger = new Logger('Orchestrator');
    this.serverManager = new MCPServerManager();
    this.router = new Router();
    this.workflowEngine = new WorkflowEngine();
    this.cache = new Cache();
  }

  async initialize(config: OrchestratorConfig) {
    if (this.initialized) {
      this.logger.warn('Orchestrator already initialized');
      return;
    }

    this.logger.info('Initializing Orchestrator...');
    this.config = config;

    // Initialize components
    await this.serverManager.initialize(config.servers);
    await this.router.initialize(this.serverManager);
    await this.workflowEngine.initialize(config.workflows);

    // Setup event handlers
    this.setupEventHandlers();

    this.initialized = true;
    this.logger.info('Orchestrator initialized successfully');
  }

  /**
   * Get all available tools from all servers
   */
  async getAllTools(): Promise<MCPTool[]> {
    const cacheKey = 'all-tools';
    const cached = this.cache.get<MCPTool[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const allTools: MCPTool[] = [];
    const servers = this.serverManager.getServers();

    for (const server of servers) {
      const tools = await this.serverManager.getServerTools(server.name);
      
      // Add server prefix to avoid conflicts
      const prefixedTools = tools.map(tool => ({
        ...tool,
        name: this.getPrefixedToolName(server.name, tool.name),
        description: `[${server.name}] ${tool.description}`,
        originalName: tool.name,
        server: server.name,
      }));
      
      allTools.push(...prefixedTools);
    }

    // Add orchestrator-specific tools
    allTools.push(...this.getOrchestratorTools());

    this.cache.set(cacheKey, allTools, 300); // Cache for 5 minutes
    return allTools;
  }

  /**
   * Execute a tool (routes to appropriate server or handles internally)
   */
  async executeTool(toolName: string, args: any): Promise<ToolExecutionResult> {
    this.logger.info(`Executing tool: ${toolName}`);

    // Check if it's an orchestrator tool
    if (toolName.startsWith('orchestrator_')) {
      return this.executeOrchestratorTool(toolName, args);
    }

    // Check if it's a workflow
    if (toolName.startsWith('workflow_')) {
      const workflowName = toolName.replace('workflow_', '');
      return this.workflowEngine.execute(workflowName, args);
    }

    // Route to appropriate server
    const route = await this.router.route(toolName, args);
    
    if (!route) {
      // Try intelligent routing based on content
      const intelligentRoute = await this.router.intelligentRoute(toolName, args);
      
      if (!intelligentRoute) {
        throw new Error(`No server found for tool: ${toolName}`);
      }
      
      return this.executeOnServer(intelligentRoute.server, intelligentRoute.tool, args);
    }

    return this.executeOnServer(route.server, route.tool, args);
  }

  /**
   * Execute tool on specific server
   */
  private async executeOnServer(
    serverName: string,
    toolName: string,
    args: any
  ): Promise<ToolExecutionResult> {
    // Check cache
    const cacheKey = `${serverName}:${toolName}:${JSON.stringify(args)}`;
    const cached = this.cache.get<ToolExecutionResult>(cacheKey);
    
    if (cached && !args.noCache) {
      this.logger.info(`Cache hit for ${serverName}.${toolName}`);
      return cached;
    }

    try {
      const result = await this.serverManager.executeTool(serverName, toolName, args);
      
      // Cache successful results
      if (result.success) {
        this.cache.set(cacheKey, result, 60); // Cache for 1 minute
      }
      
      this.emit('tool:executed', {
        server: serverName,
        tool: toolName,
        result,
      });
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to execute ${serverName}.${toolName}:`, error);
      
      // Try fallback server if available
      const fallback = this.router.getFallback(serverName, toolName);
      if (fallback) {
        this.logger.info(`Trying fallback server: ${fallback}`);
        return this.executeOnServer(fallback, toolName, args);
      }
      
      throw error;
    }
  }

  /**
   * Execute orchestrator-specific tools
   */
  private async executeOrchestratorTool(
    toolName: string,
    args: any
  ): Promise<ToolExecutionResult> {
    switch (toolName) {
      case 'orchestrator_list_servers':
        return {
          success: true,
          data: this.serverManager.getServers(),
        };

      case 'orchestrator_execute_workflow':
        return this.workflowEngine.execute(args.workflow, args.params);

      case 'orchestrator_cross_server_query':
        return this.executeCrossServerQuery(args);

      case 'orchestrator_sync_data':
        return this.syncDataBetweenServers(args);

      case 'orchestrator_smart_route':
        return this.smartRoute(args.query);

      default:
        throw new Error(`Unknown orchestrator tool: ${toolName}`);
    }
  }

  /**
   * Execute query across multiple servers
   */
  private async executeCrossServerQuery(args: {
    query: string;
    servers?: string[];
  }): Promise<ToolExecutionResult> {
    const servers = args.servers || this.serverManager.getServers().map(s => s.name);
    const results: any[] = [];

    // Execute in parallel across servers
    const promises = servers.map(async (serverName) => {
      try {
        const server = this.serverManager.getServer(serverName);
        if (!server) return null;

        // Find appropriate tool for the query
        const tool = await this.router.findToolForQuery(serverName, args.query);
        if (!tool) return null;

        const result = await this.executeOnServer(serverName, tool, args);
        return { server: serverName, result };
      } catch (error) {
        this.logger.error(`Query failed on ${serverName}:`, error);
        return { server: serverName, error: error.message };
      }
    });

    const queryResults = await Promise.all(promises);
    const validResults = queryResults.filter(r => r !== null);

    return {
      success: true,
      data: {
        query: args.query,
        results: validResults,
        serversQueried: servers.length,
        successfulQueries: validResults.filter(r => !r.error).length,
      },
    };
  }

  /**
   * Sync data between two servers
   */
  private async syncDataBetweenServers(args: {
    source: { server: string; tool: string; params: any };
    destination: { server: string; tool: string; transform?: any };
  }): Promise<ToolExecutionResult> {
    this.logger.info(`Syncing data from ${args.source.server} to ${args.destination.server}`);

    // Fetch from source
    const sourceData = await this.executeOnServer(
      args.source.server,
      args.source.tool,
      args.source.params
    );

    if (!sourceData.success) {
      return {
        success: false,
        error: `Failed to fetch from source: ${sourceData.error}`,
      };
    }

    // Transform data if needed
    let dataToSync = sourceData.data;
    if (args.destination.transform) {
      dataToSync = this.transformData(sourceData.data, args.destination.transform);
    }

    // Push to destination
    const destResult = await this.executeOnServer(
      args.destination.server,
      args.destination.tool,
      dataToSync
    );

    return {
      success: destResult.success,
      data: {
        source: args.source.server,
        destination: args.destination.server,
        recordsSynced: Array.isArray(dataToSync) ? dataToSync.length : 1,
        result: destResult.data,
      },
      error: destResult.error,
    };
  }

  /**
   * Smart routing based on natural language query
   */
  private async smartRoute(query: string): Promise<ToolExecutionResult> {
    const route = await this.router.smartRoute(query);
    
    if (!route) {
      return {
        success: false,
        error: 'Could not determine appropriate server for query',
      };
    }

    return this.executeOnServer(route.server, route.tool, route.params);
  }

  /**
   * Transform data between different formats
   */
  private transformData(data: any, transform: any): any {
    // Simple transformation logic
    // In production, this would be more sophisticated
    if (typeof transform === 'function') {
      return transform(data);
    }

    if (transform.mapping) {
      // Field mapping
      if (Array.isArray(data)) {
        return data.map(item => this.mapFields(item, transform.mapping));
      }
      return this.mapFields(data, transform.mapping);
    }

    return data;
  }

  /**
   * Map fields from source to destination format
   */
  private mapFields(item: any, mapping: Record<string, string>): any {
    const result: any = {};
    
    for (const [dest, source] of Object.entries(mapping)) {
      result[dest] = this.getNestedValue(item, source);
    }
    
    return result;
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Get orchestrator-specific tools
   */
  private getOrchestratorTools(): MCPTool[] {
    return [
      {
        name: 'orchestrator_list_servers',
        description: 'List all connected MCP servers',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'orchestrator_execute_workflow',
        description: 'Execute a predefined workflow across multiple servers',
        inputSchema: {
          type: 'object',
          properties: {
            workflow: { type: 'string', description: 'Workflow name' },
            params: { type: 'object', description: 'Workflow parameters' },
          },
          required: ['workflow'],
        },
      },
      {
        name: 'orchestrator_cross_server_query',
        description: 'Execute a query across multiple servers',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Query to execute' },
            servers: {
              type: 'array',
              items: { type: 'string' },
              description: 'Servers to query (optional, defaults to all)',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'orchestrator_sync_data',
        description: 'Sync data between two servers',
        inputSchema: {
          type: 'object',
          properties: {
            source: {
              type: 'object',
              properties: {
                server: { type: 'string' },
                tool: { type: 'string' },
                params: { type: 'object' },
              },
              required: ['server', 'tool'],
            },
            destination: {
              type: 'object',
              properties: {
                server: { type: 'string' },
                tool: { type: 'string' },
                transform: { type: 'object' },
              },
              required: ['server', 'tool'],
            },
          },
          required: ['source', 'destination'],
        },
      },
      {
        name: 'orchestrator_smart_route',
        description: 'Intelligently route a natural language query to the appropriate server',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Natural language query' },
          },
          required: ['query'],
        },
      },
    ];
  }

  /**
   * Get prefixed tool name to avoid conflicts
   */
  private getPrefixedToolName(serverName: string, toolName: string): string {
    // Don't prefix if already prefixed
    if (toolName.includes('_')) {
      const parts = toolName.split('_');
      if (this.serverManager.getServer(parts[0])) {
        return toolName;
      }
    }
    
    return `${serverName}_${toolName}`;
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers() {
    this.serverManager.on('server:connected', (server) => {
      this.logger.info(`Server connected: ${server.name}`);
      this.cache.clear(); // Clear cache when servers change
    });

    this.serverManager.on('server:disconnected', (server) => {
      this.logger.warn(`Server disconnected: ${server.name}`);
      this.cache.clear();
    });

    this.router.on('route:found', (route) => {
      this.logger.debug(`Route found: ${route.tool} -> ${route.server}`);
    });
  }
}