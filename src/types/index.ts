/**
 * Type Definitions for MCP Orchestrator
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';

export interface OrchestratorConfig {
  servers: ServerConfig[];
  workflows?: WorkflowConfig[];
  routing?: RoutingConfig;
  cache?: CacheConfig;
}

export interface ServerConfig {
  name: string;
  package?: string;
  path?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
}

export interface MCPServer {
  name: string;
  config: ServerConfig;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  client?: Client;
  tools: MCPTool[];
  error?: string;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema?: any;
  server?: string;
  originalName?: string;
}

export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface RouteResult {
  server: string;
  tool: string;
  params: any;
}

export interface WorkflowConfig {
  name: string;
  description?: string;
  steps: WorkflowStep[];
  triggers?: WorkflowTrigger[];
}

export interface WorkflowStep {
  name: string;
  server: string;
  tool: string;
  params?: any;
  transform?: any;
  condition?: any;
}

export interface WorkflowTrigger {
  type: 'schedule' | 'webhook' | 'event';
  config: any;
}

export interface RoutingConfig {
  smartRouting?: boolean;
  cacheEnabled?: boolean;
  parallelExecution?: boolean;
  fallbackEnabled?: boolean;
}

export interface CacheConfig {
  enabled?: boolean;
  ttl?: number;
  maxSize?: number;
}

export interface RouterConfig {
  keywordMappings?: Record<string, string[]>;
  fallbackServers?: Record<string, string[]>;
}