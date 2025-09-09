#!/usr/bin/env node

/**
 * MCP Orchestrator - Meta-MCP Server
 * 
 * A single MCP server that orchestrates multiple MCP servers,
 * providing unified access and cross-server workflows.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  TextContent,
  ImageContent,
  EmbeddedContent,
} from '@modelcontextprotocol/sdk/types.js';
import { MCPOrchestrator } from './core/orchestrator';
import { ConfigLoader } from './utils/config-loader';
import { Logger } from './utils/logger';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const logger = new Logger('MCPOrchestrator');

class MCPOrchestratorServer {
  private server: Server;
  private orchestrator: MCPOrchestrator;

  constructor() {
    this.server = new Server(
      {
        name: 'mcp-orchestrator',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize orchestrator
    this.orchestrator = new MCPOrchestrator();
  }

  async initialize() {
    logger.info('Initializing MCP Orchestrator Server...');

    // Load configuration
    const config = await ConfigLoader.load();
    await this.orchestrator.initialize(config);

    // Setup request handlers
    this.setupHandlers();

    logger.info('MCP Orchestrator Server initialized successfully');
  }

  private setupHandlers() {
    // Handle list tools request
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = await this.orchestrator.getAllTools();
      
      return {
        tools: tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema || {
            type: 'object',
            properties: {},
          },
        })),
      };
    });

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        logger.info(`Executing tool: ${name}`);
        
        // Execute through orchestrator
        const result = await this.orchestrator.executeTool(name, args);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            } as TextContent,
          ],
        };
      } catch (error) {
        logger.error(`Tool execution failed: ${error.message}`);
        
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            } as TextContent,
          ],
          isError: true,
        };
      }
    });

    // Error handling
    this.server.onerror = (error) => {
      logger.error('Server error:', error);
    };
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('MCP Orchestrator Server started on stdio transport');
  }
}

// Main entry point
async function main() {
  try {
    const server = new MCPOrchestratorServer();
    await server.initialize();
    await server.start();
  } catch (error) {
    logger.error('Failed to start MCP Orchestrator:', error);
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  logger.info('Shutting down MCP Orchestrator...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down MCP Orchestrator...');
  process.exit(0);
});

// Start the server
main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});