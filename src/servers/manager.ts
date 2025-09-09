/**
 * MCP Server Manager
 * 
 * Manages connections to multiple MCP servers
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Logger } from '../utils/logger';
import { MCPServer, MCPTool, ServerConfig, ToolExecutionResult } from '../types';

export class MCPServerManager extends EventEmitter {
  private servers: Map<string, MCPServer> = new Map();
  private clients: Map<string, Client> = new Map();
  private processes: Map<string, ChildProcess> = new Map();
  private logger: Logger;

  constructor() {
    super();
    this.logger = new Logger('ServerManager');
  }

  async initialize(serverConfigs: ServerConfig[]) {
    this.logger.info(`Initializing ${serverConfigs.length} MCP servers...`);

    for (const config of serverConfigs) {
      try {
        await this.connectServer(config);
      } catch (error) {
        this.logger.error(`Failed to connect to ${config.name}:`, error);
        // Continue with other servers
      }
    }

    this.logger.info(`Connected to ${this.servers.size} servers`);
  }

  /**
   * Connect to an MCP server
   */
  private async connectServer(config: ServerConfig) {
    this.logger.info(`Connecting to ${config.name}...`);

    try {
      // Spawn the MCP server process
      const args = this.buildServerArgs(config);
      const env = { ...process.env, ...config.env };
      
      const serverProcess = spawn(config.command || 'npx', args, {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Create MCP client
      const transport = new StdioClientTransport({
        command: config.command || 'npx',
        args,
        env,
      });

      const client = new Client(
        {
          name: `orchestrator-client-${config.name}`,
          version: '0.1.0',
        },
        {
          capabilities: {},
        }
      );

      // Connect client
      await client.connect(transport);

      // Store references
      const server: MCPServer = {
        name: config.name,
        config,
        status: 'connected',
        client,
        tools: [],
      };

      this.servers.set(config.name, server);
      this.clients.set(config.name, client);
      this.processes.set(config.name, serverProcess);

      // Discover tools
      await this.discoverTools(config.name);

      this.emit('server:connected', server);
      this.logger.info(`Connected to ${config.name} successfully`);

    } catch (error) {
      this.logger.error(`Failed to connect to ${config.name}:`, error);
      throw error;
    }
  }

  /**
   * Build server arguments
   */
  private buildServerArgs(config: ServerConfig): string[] {
    if (config.args) {
      return config.args;
    }

    // Default args for npm packages
    if (config.package) {
      return [config.package];
    }

    // Local path
    if (config.path) {
      return [config.path];
    }

    return [];
  }

  /**
   * Discover available tools from a server
   */
  private async discoverTools(serverName: string) {
    const server = this.servers.get(serverName);
    const client = this.clients.get(serverName);

    if (!server || !client) {
      throw new Error(`Server ${serverName} not found`);
    }

    try {
      const response = await client.request(
        { method: 'tools/list' },
        { type: 'tools/list' }
      );

      const tools = response.tools || [];
      server.tools = tools.map((tool: any) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        server: serverName,
      }));

      this.logger.info(`Discovered ${server.tools.length} tools from ${serverName}`);
    } catch (error) {
      this.logger.error(`Failed to discover tools from ${serverName}:`, error);
      server.tools = [];
    }
  }

  /**
   * Get all connected servers
   */
  getServers(): MCPServer[] {
    return Array.from(this.servers.values());
  }

  /**
   * Get a specific server
   */
  getServer(name: string): MCPServer | undefined {
    return this.servers.get(name);
  }

  /**
   * Get tools from a specific server
   */
  async getServerTools(serverName: string): Promise<MCPTool[]> {
    const server = this.servers.get(serverName);
    
    if (!server) {
      throw new Error(`Server ${serverName} not found`);
    }

    // Refresh tools if empty
    if (server.tools.length === 0) {
      await this.discoverTools(serverName);
    }

    return server.tools;
  }

  /**
   * Execute a tool on a specific server
   */
  async executeTool(
    serverName: string,
    toolName: string,
    args: any
  ): Promise<ToolExecutionResult> {
    const client = this.clients.get(serverName);
    
    if (!client) {
      throw new Error(`Server ${serverName} not connected`);
    }

    try {
      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: args,
          },
        },
        {
          type: 'tools/call',
        }
      );

      return {
        success: true,
        data: response.content?.[0]?.text 
          ? JSON.parse(response.content[0].text)
          : response,
      };
    } catch (error) {
      this.logger.error(`Tool execution failed on ${serverName}:`, error);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Disconnect from a server
   */
  async disconnectServer(serverName: string) {
    const server = this.servers.get(serverName);
    const client = this.clients.get(serverName);
    const process = this.processes.get(serverName);

    if (client) {
      await client.close();
      this.clients.delete(serverName);
    }

    if (process) {
      process.kill();
      this.processes.delete(serverName);
    }

    if (server) {
      server.status = 'disconnected';
      this.servers.delete(serverName);
      this.emit('server:disconnected', server);
    }

    this.logger.info(`Disconnected from ${serverName}`);
  }

  /**
   * Disconnect from all servers
   */
  async disconnectAll() {
    const serverNames = Array.from(this.servers.keys());
    
    for (const name of serverNames) {
      await this.disconnectServer(name);
    }
  }

  /**
   * Reconnect to a server
   */
  async reconnectServer(serverName: string) {
    const server = this.servers.get(serverName);
    
    if (!server) {
      throw new Error(`Server ${serverName} not found`);
    }

    await this.disconnectServer(serverName);
    await this.connectServer(server.config);
  }

  /**
   * Check server health
   */
  async checkHealth(serverName: string): Promise<boolean> {
    const client = this.clients.get(serverName);
    
    if (!client) {
      return false;
    }

    try {
      // Try to list tools as a health check
      await client.request(
        { method: 'tools/list' },
        { type: 'tools/list' }
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get server statistics
   */
  getStats() {
    const stats = {
      total: this.servers.size,
      connected: 0,
      disconnected: 0,
      tools: 0,
    };

    for (const server of this.servers.values()) {
      if (server.status === 'connected') {
        stats.connected++;
      } else {
        stats.disconnected++;
      }
      stats.tools += server.tools.length;
    }

    return stats;
  }
}