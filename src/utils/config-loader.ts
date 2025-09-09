/**
 * Configuration Loader
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { OrchestratorConfig } from '../types';
import { Logger } from './logger';

export class ConfigLoader {
  private static logger = new Logger('ConfigLoader');

  static async load(): Promise<OrchestratorConfig> {
    // Try to load from multiple sources
    const configPath = await this.findConfigFile();
    
    if (configPath) {
      return this.loadFromFile(configPath);
    }

    // Load from environment variables
    return this.loadFromEnv();
  }

  private static async findConfigFile(): Promise<string | null> {
    const possiblePaths = [
      process.env.MCP_ORCHESTRATOR_CONFIG,
      path.join(process.cwd(), 'mcp-orchestrator.config.yml'),
      path.join(process.cwd(), 'mcp-orchestrator.config.json'),
      path.join(process.env.HOME || '', '.mcp-orchestrator', 'config.yml'),
      path.join(process.env.HOME || '', '.mcp-orchestrator', 'config.json'),
    ].filter(Boolean) as string[];

    for (const configPath of possiblePaths) {
      try {
        await fs.access(configPath);
        this.logger.info(`Found config file: ${configPath}`);
        return configPath;
      } catch {
        // File doesn't exist, try next
      }
    }

    return null;
  }

  private static async loadFromFile(configPath: string): Promise<OrchestratorConfig> {
    const content = await fs.readFile(configPath, 'utf-8');
    
    if (configPath.endsWith('.yml') || configPath.endsWith('.yaml')) {
      return yaml.load(content) as OrchestratorConfig;
    }
    
    return JSON.parse(content);
  }

  private static loadFromEnv(): OrchestratorConfig {
    const servers = this.parseServersFromEnv();
    
    return {
      servers,
      routing: {
        smartRouting: process.env.MCP_SMART_ROUTING !== 'false',
        cacheEnabled: process.env.MCP_CACHE_ENABLED !== 'false',
        parallelExecution: process.env.MCP_PARALLEL_EXECUTION !== 'false',
      },
      cache: {
        enabled: process.env.MCP_CACHE_ENABLED !== 'false',
        ttl: parseInt(process.env.MCP_CACHE_TTL || '300'),
      },
    };
  }

  private static parseServersFromEnv(): any[] {
    const servers = [];
    const serverList = process.env.MCP_SERVERS || 'airtable,supabase';
    
    for (const serverName of serverList.split(',')) {
      const name = serverName.trim();
      
      // Map to known packages
      const packageMap: Record<string, string> = {
        'airtable': '@rashidazarang/airtable-mcp',
        'supabase': '@supabase/mcp-server',
        'github': '@modelcontextprotocol/server-github',
        'notion': '@mcp-servers/notion',
        'postgres': '@modelcontextprotocol/server-postgres',
      };

      if (packageMap[name]) {
        servers.push({
          name,
          package: packageMap[name],
          env: this.getServerEnv(name),
        });
      }
    }

    return servers;
  }

  private static getServerEnv(serverName: string): Record<string, string> {
    const env: Record<string, string> = {};
    
    // Map server-specific environment variables
    switch (serverName) {
      case 'airtable':
        if (process.env.AIRTABLE_TOKEN) env.AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
        if (process.env.AIRTABLE_BASE_ID) env.AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
        break;
        
      case 'supabase':
        if (process.env.SUPABASE_URL) env.SUPABASE_URL = process.env.SUPABASE_URL;
        if (process.env.SUPABASE_KEY) env.SUPABASE_KEY = process.env.SUPABASE_KEY;
        break;
        
      case 'github':
        if (process.env.GITHUB_TOKEN) env.GITHUB_TOKEN = process.env.GITHUB_TOKEN;
        break;
        
      case 'notion':
        if (process.env.NOTION_TOKEN) env.NOTION_TOKEN = process.env.NOTION_TOKEN;
        break;
    }
    
    return env;
  }
}