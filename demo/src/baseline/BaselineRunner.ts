import { QueryTest } from '../scenarios';

interface BaselineResult {
  tokensUsed: number;
  toolsEvaluated: number;
  timeMs: number;
  selectedTool: string;
  selectedServer: string;
}

/**
 * BaselineRunner simulates the traditional approach where all tools
 * from all servers are presented to the LLM for selection
 */
export class BaselineRunner {
  private allTools: any[] = [];
  
  constructor() {
    // Combine all tools from both servers
    this.allTools = [
      // Airtable tools
      { server: 'airtable', name: 'list_bases', description: 'List all Airtable bases' },
      { server: 'airtable', name: 'list_tables', description: 'List tables in a base' },
      { server: 'airtable', name: 'get_records', description: 'Get records from a table' },
      { server: 'airtable', name: 'create_record', description: 'Create a new record' },
      { server: 'airtable', name: 'update_record', description: 'Update an existing record' },
      { server: 'airtable', name: 'delete_record', description: 'Delete a record' },
      
      // Supabase tools
      { server: 'supabase', name: 'list_tables', description: 'List database tables' },
      { server: 'supabase', name: 'execute_sql', description: 'Execute SQL query' },
      { server: 'supabase', name: 'subscribe_realtime', description: 'Subscribe to real-time updates' },
      { server: 'supabase', name: 'insert_data', description: 'Insert data into table' },
      { server: 'supabase', name: 'update_data', description: 'Update table data' },
      { server: 'supabase', name: 'delete_data', description: 'Delete table data' }
    ];
  }
  
  async run(query: QueryTest): Promise<BaselineResult> {
    const startTime = Date.now();
    
    // Simulate LLM processing all tools
    // In baseline, we present all tools and let LLM decide
    const tokensForTools = this.calculateToolTokens();
    const tokensForQuery = this.estimateQueryTokens(query.query);
    const tokensForSelection = 150; // Simulated LLM reasoning tokens
    
    // Simulate selection logic (would be actual LLM call in production)
    const selectedTool = this.selectTool(query);
    
    // Simulate processing delay
    await this.simulateProcessingDelay();
    
    return {
      tokensUsed: tokensForTools + tokensForQuery + tokensForSelection,
      toolsEvaluated: this.allTools.length,
      timeMs: Date.now() - startTime,
      selectedTool: selectedTool.name,
      selectedServer: selectedTool.server
    };
  }
  
  private calculateToolTokens(): number {
    // Each tool description is roughly 20 tokens
    // Plus formatting and structure overhead
    return this.allTools.length * 25 + 100;
  }
  
  private estimateQueryTokens(query: string): number {
    // Rough estimation: 1 token per 4 characters
    return Math.ceil(query.length / 4);
  }
  
  private selectTool(query: QueryTest): any {
    // Simulate tool selection based on query keywords
    // In production, this would be an actual LLM call
    
    const queryLower = query.query.toLowerCase();
    
    // Check for explicit server mentions
    if (queryLower.includes('airtable')) {
      return this.allTools.find(t => t.server === 'airtable' && t.name === 'list_bases') 
        || this.allTools[0];
    }
    
    if (queryLower.includes('supabase') || queryLower.includes('sql')) {
      return this.allTools.find(t => t.server === 'supabase' && t.name === 'execute_sql')
        || this.allTools[6];
    }
    
    // Pattern matching for common operations
    if (queryLower.includes('list') || queryLower.includes('show')) {
      if (queryLower.includes('table')) {
        return this.allTools.find(t => t.name === 'list_tables');
      }
      if (queryLower.includes('base')) {
        return this.allTools.find(t => t.name === 'list_bases');
      }
    }
    
    if (queryLower.includes('create') || queryLower.includes('insert')) {
      return this.allTools.find(t => t.name === 'create_record' || t.name === 'insert_data');
    }
    
    if (queryLower.includes('update')) {
      return this.allTools.find(t => t.name === 'update_record' || t.name === 'update_data');
    }
    
    if (queryLower.includes('delete')) {
      return this.allTools.find(t => t.name === 'delete_record' || t.name === 'delete_data');
    }
    
    if (queryLower.includes('real-time') || queryLower.includes('realtime')) {
      return this.allTools.find(t => t.name === 'subscribe_realtime');
    }
    
    // Default fallback
    return this.allTools[0];
  }
  
  private async simulateProcessingDelay(): Promise<void> {
    // Simulate network and processing latency
    // Baseline is slower because it evaluates all tools
    const delay = 300 + Math.random() * 200; // 300-500ms
    return new Promise(resolve => setTimeout(resolve, delay));
  }
  
  /**
   * Calculate the theoretical minimum tokens if we knew exactly which tool to use
   * This helps demonstrate the overhead of the baseline approach
   */
  getOptimalTokens(query: string, selectedTool: string): number {
    const queryTokens = this.estimateQueryTokens(query);
    const singleToolTokens = 25; // Just one tool description
    const reasoningTokens = 50; // Minimal reasoning needed
    
    return queryTokens + singleToolTokens + reasoningTokens;
  }
}