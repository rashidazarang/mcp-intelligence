#!/usr/bin/env node

/**
 * MCP Intelligence Server - MCP Server Mode
 * 
 * This file allows MCP Intelligence to run as an MCP server itself,
 * exposing its intelligence capabilities through the MCP protocol.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  TextContent,
} from '@modelcontextprotocol/sdk/types.js';
import { MCPIntelligence } from './core/MCPIntelligence';
import { Logger } from './utils/logger';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const logger = new Logger('MCPIntelligenceServer');

class MCPIntelligenceServer {
  private server: Server;
  private intelligence: MCPIntelligence;

  constructor() {
    this.server = new Server(
      {
        name: 'mcp-intelligence',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize intelligence
    this.intelligence = new MCPIntelligence({
      pmipIntegration: true
    });
  }

  async initialize() {
    logger.info('Initializing MCP Intelligence Server...');

    // Initialize intelligence system
    await this.intelligence.initialize();

    // Setup request handlers
    this.setupHandlers();

    logger.info('MCP Intelligence Server initialized successfully');
  }

  private setupHandlers() {
    // Handle list tools request
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools: Tool[] = [
        {
          name: 'query',
          description: 'Process a natural language query and route to appropriate MCP server',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Natural language query'
              },
              context: {
                type: 'object',
                description: 'Optional context for the query'
              }
            },
            required: ['query']
          }
        },
        {
          name: 'get_suggestions',
          description: 'Get query suggestions based on partial input',
          inputSchema: {
            type: 'object',
            properties: {
              partial_query: {
                type: 'string',
                description: 'Partial query string'
              },
              limit: {
                type: 'number',
                description: 'Maximum number of suggestions',
                default: 5
              }
            },
            required: ['partial_query']
          }
        },
        {
          name: 'explain',
          description: 'Explain a previous query result',
          inputSchema: {
            type: 'object',
            properties: {
              result: {
                type: 'object',
                description: 'Query result to explain'
              }
            },
            required: ['result']
          }
        }
      ];
      
      return { tools };
    });

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        logger.info(`Executing tool: ${name}`);
        
        let result;
        
        switch (name) {
          case 'query':
            result = await this.intelligence.query(args.query, args.context);
            break;
            
          case 'get_suggestions':
            result = await this.intelligence.getSuggestions(
              args.partial_query,
              args.limit || 5
            );
            break;
            
          case 'explain':
            result = await this.intelligence.explain(args.result);
            break;
            
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
        
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
    logger.info('MCP Intelligence Server started on stdio transport');
  }
}

// Main entry point
async function main() {
  try {
    const server = new MCPIntelligenceServer();
    await server.initialize();
    await server.start();
  } catch (error) {
    logger.error('Failed to start MCP Intelligence:', error);
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  logger.info('Shutting down MCP Intelligence...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down MCP Intelligence...');
  process.exit(0);
});

// Start the server
main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});