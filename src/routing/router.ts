/**
 * Intelligent Router
 * 
 * Routes requests to appropriate MCP servers
 */

import { EventEmitter } from 'events';
import { MCPServerManager } from '../servers/manager';
import { Logger } from '../utils/logger';
import { RouteResult, RouterConfig } from '../types';

export class Router extends EventEmitter {
  private serverManager: MCPServerManager;
  private logger: Logger;
  private routingTable: Map<string, string> = new Map();
  private keywordMap: Map<string, string[]> = new Map();

  constructor() {
    super();
    this.logger = new Logger('Router');
    this.initializeKeywordMap();
  }

  async initialize(serverManager: MCPServerManager) {
    this.serverManager = serverManager;
    await this.buildRoutingTable();
  }

  /**
   * Initialize keyword mappings for intelligent routing
   */
  private initializeKeywordMap() {
    this.keywordMap.set('airtable', [
      'table', 'base', 'record', 'field', 'view', 'formula', 'attachment'
    ]);
    
    this.keywordMap.set('supabase', [
      'query', 'sql', 'database', 'postgres', 'rpc', 'realtime', 'subscription'
    ]);
    
    this.keywordMap.set('github', [
      'repository', 'issue', 'pull request', 'commit', 'branch', 'workflow', 'action'
    ]);
    
    this.keywordMap.set('notion', [
      'page', 'database', 'block', 'workspace', 'property', 'relation'
    ]);
    
    this.keywordMap.set('slack', [
      'channel', 'message', 'thread', 'mention', 'reaction', 'workspace'
    ]);
  }

  /**
   * Build routing table from available tools
   */
  private async buildRoutingTable() {
    const servers = this.serverManager.getServers();
    
    for (const server of servers) {
      const tools = await this.serverManager.getServerTools(server.name);
      
      for (const tool of tools) {
        // Map tool name to server
        this.routingTable.set(tool.name, server.name);
        
        // Also map with server prefix
        this.routingTable.set(`${server.name}_${tool.name}`, server.name);
      }
    }
    
    this.logger.info(`Built routing table with ${this.routingTable.size} routes`);
  }

  /**
   * Route a tool request
   */
  async route(toolName: string, args: any): Promise<RouteResult | null> {
    // Direct routing by tool name
    const serverName = this.routingTable.get(toolName);
    
    if (serverName) {
      this.emit('route:found', { tool: toolName, server: serverName });
      
      // Extract original tool name if prefixed
      const originalTool = toolName.includes('_') 
        ? toolName.split('_').slice(1).join('_')
        : toolName;
      
      return {
        server: serverName,
        tool: originalTool,
        params: args,
      };
    }
    
    return null;
  }

  /**
   * Intelligent routing based on content
   */
  async intelligentRoute(query: string, args: any): Promise<RouteResult | null> {
    this.logger.info(`Attempting intelligent routing for: ${query}`);
    
    // Check keywords
    const serverScores = new Map<string, number>();
    
    for (const [server, keywords] of this.keywordMap.entries()) {
      let score = 0;
      const lowerQuery = query.toLowerCase();
      
      for (const keyword of keywords) {
        if (lowerQuery.includes(keyword)) {
          score += 10;
        }
      }
      
      if (score > 0) {
        serverScores.set(server, score);
      }
    }
    
    // Find best match
    if (serverScores.size > 0) {
      const bestServer = Array.from(serverScores.entries())
        .sort((a, b) => b[1] - a[1])[0][0];
      
      // Find appropriate tool
      const tool = await this.findToolForQuery(bestServer, query);
      
      if (tool) {
        this.logger.info(`Intelligent routing: ${query} -> ${bestServer}.${tool}`);
        
        return {
          server: bestServer,
          tool,
          params: args,
        };
      }
    }
    
    // Fallback: try each server
    const servers = this.serverManager.getServers();
    
    for (const server of servers) {
      const tool = await this.findToolForQuery(server.name, query);
      
      if (tool) {
        return {
          server: server.name,
          tool,
          params: args,
        };
      }
    }
    
    return null;
  }

  /**
   * Smart routing for natural language queries
   */
  async smartRoute(query: string): Promise<RouteResult | null> {
    this.logger.info(`Smart routing for: "${query}"`);
    
    // Parse intent from query
    const intent = this.parseIntent(query);
    
    // Map intent to server and tool
    const route = await this.mapIntentToRoute(intent, query);
    
    if (route) {
      this.emit('route:smart', { query, route });
      return route;
    }
    
    // Fallback to intelligent routing
    return this.intelligentRoute(query, {});
  }

  /**
   * Parse intent from natural language query
   */
  private parseIntent(query: string): {
    action: string;
    resource: string;
    modifiers: string[];
  } {
    const lowerQuery = query.toLowerCase();
    
    // Common action patterns
    const actions = [
      'list', 'get', 'create', 'update', 'delete', 'sync', 'copy',
      'fetch', 'show', 'find', 'search', 'query', 'export', 'import'
    ];
    
    let detectedAction = 'query';
    for (const action of actions) {
      if (lowerQuery.includes(action)) {
        detectedAction = action;
        break;
      }
    }
    
    // Common resource patterns
    const resources = [
      'table', 'record', 'database', 'issue', 'page', 'message',
      'file', 'user', 'data', 'document', 'task', 'project'
    ];
    
    let detectedResource = 'data';
    for (const resource of resources) {
      if (lowerQuery.includes(resource)) {
        detectedResource = resource;
        break;
      }
    }
    
    // Extract modifiers
    const modifiers: string[] = [];
    if (lowerQuery.includes('all')) modifiers.push('all');
    if (lowerQuery.includes('recent')) modifiers.push('recent');
    if (lowerQuery.includes('active')) modifiers.push('active');
    
    return {
      action: detectedAction,
      resource: detectedResource,
      modifiers,
    };
  }

  /**
   * Map intent to route
   */
  private async mapIntentToRoute(
    intent: any,
    query: string
  ): Promise<RouteResult | null> {
    // Map common patterns
    const mappings: Record<string, { server: string; tool: string }> = {
      'list_table': { server: 'airtable', tool: 'list_tables' },
      'list_record': { server: 'airtable', tool: 'list_records' },
      'create_record': { server: 'airtable', tool: 'create_record' },
      'query_database': { server: 'supabase', tool: 'query' },
      'list_issue': { server: 'github', tool: 'list_issues' },
      'create_page': { server: 'notion', tool: 'create_page' },
    };
    
    const key = `${intent.action}_${intent.resource}`;
    const mapping = mappings[key];
    
    if (mapping) {
      return {
        server: mapping.server,
        tool: mapping.tool,
        params: { query },
      };
    }
    
    return null;
  }

  /**
   * Find appropriate tool for a query on a specific server
   */
  async findToolForQuery(serverName: string, query: string): Promise<string | null> {
    const tools = await this.serverManager.getServerTools(serverName);
    const lowerQuery = query.toLowerCase();
    
    // Find best matching tool
    for (const tool of tools) {
      const toolName = tool.name.toLowerCase();
      const toolDesc = tool.description?.toLowerCase() || '';
      
      // Check if query mentions the tool
      if (lowerQuery.includes(toolName.replace(/_/g, ' '))) {
        return tool.name;
      }
      
      // Check description match
      const queryWords = lowerQuery.split(' ');
      let matchCount = 0;
      
      for (const word of queryWords) {
        if (toolDesc.includes(word)) {
          matchCount++;
        }
      }
      
      if (matchCount >= 2) {
        return tool.name;
      }
    }
    
    // Default tools based on action keywords
    if (lowerQuery.includes('list') || lowerQuery.includes('get')) {
      const listTool = tools.find(t => t.name.includes('list'));
      if (listTool) return listTool.name;
    }
    
    if (lowerQuery.includes('create') || lowerQuery.includes('add')) {
      const createTool = tools.find(t => t.name.includes('create'));
      if (createTool) return createTool.name;
    }
    
    return null;
  }

  /**
   * Get fallback server for a tool
   */
  getFallback(serverName: string, toolName: string): string | null {
    // Define fallback mappings
    const fallbacks: Record<string, string[]> = {
      'airtable': ['supabase', 'notion'],
      'supabase': ['airtable', 'postgres'],
      'github': ['gitlab', 'bitbucket'],
      'notion': ['airtable', 'confluence'],
    };
    
    const serverFallbacks = fallbacks[serverName];
    if (!serverFallbacks) return null;
    
    // Check if fallback server has the tool
    for (const fallback of serverFallbacks) {
      if (this.routingTable.has(`${fallback}_${toolName}`)) {
        return fallback;
      }
    }
    
    return null;
  }

  /**
   * Refresh routing table
   */
  async refresh() {
    this.routingTable.clear();
    await this.buildRoutingTable();
  }
}