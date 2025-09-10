export interface DemoScenario {
  id: string;
  name: string;
  description: string;
  queries: QueryTest[];
}

export interface QueryTest {
  query: string;
  expectedServer: 'airtable' | 'supabase' | 'either';
  expectedIntent: string;
  context?: any;
  complexity: 'simple' | 'ambiguous' | 'complex';
}

export const scenarios: DemoScenario[] = [
  {
    id: 'clear-routing',
    name: 'Clear Intent Routing',
    description: 'Queries with clear server affinity',
    queries: [
      {
        query: 'Show all Airtable bases',
        expectedServer: 'airtable',
        expectedIntent: 'list_bases',
        complexity: 'simple'
      },
      {
        query: 'List all tables in my Airtable base',
        expectedServer: 'airtable',
        expectedIntent: 'list_tables',
        complexity: 'simple'
      },
      {
        query: 'Get records from Airtable where status is active',
        expectedServer: 'airtable',
        expectedIntent: 'query_records',
        complexity: 'simple'
      },
      {
        query: 'Show Supabase database tables',
        expectedServer: 'supabase',
        expectedIntent: 'list_tables',
        complexity: 'simple'
      },
      {
        query: 'Execute SQL query on Supabase',
        expectedServer: 'supabase',
        expectedIntent: 'execute_sql',
        complexity: 'simple'
      },
      {
        query: 'Get real-time updates from Supabase',
        expectedServer: 'supabase',
        expectedIntent: 'subscribe_realtime',
        complexity: 'simple'
      }
    ]
  },
  
  {
    id: 'ambiguous-routing',
    name: 'Ambiguous Query Routing',
    description: 'Queries that could target either server',
    queries: [
      {
        query: 'Show me all users',
        expectedServer: 'either',
        expectedIntent: 'list_users',
        context: { hint: 'Could be in either system' },
        complexity: 'ambiguous'
      },
      {
        query: 'Update the status field to completed',
        expectedServer: 'either',
        expectedIntent: 'update_record',
        context: { recentServer: 'airtable' },
        complexity: 'ambiguous'
      },
      {
        query: 'Get all projects created this month',
        expectedServer: 'either',
        expectedIntent: 'query_projects',
        complexity: 'ambiguous'
      },
      {
        query: 'Delete records older than 30 days',
        expectedServer: 'either',
        expectedIntent: 'delete_records',
        complexity: 'ambiguous'
      },
      {
        query: 'Count total records in the system',
        expectedServer: 'either',
        expectedIntent: 'count_records',
        complexity: 'ambiguous'
      }
    ]
  },
  
  {
    id: 'complex-routing',
    name: 'Complex Multi-Step Queries',
    description: 'Queries requiring coordination between servers',
    queries: [
      {
        query: 'Sync user data from Supabase authentication to Airtable CRM',
        expectedServer: 'supabase',
        expectedIntent: 'sync_data',
        context: { 
          steps: ['fetch_supabase_users', 'transform_data', 'update_airtable']
        },
        complexity: 'complex'
      },
      {
        query: 'Compare project status between Airtable and Supabase databases',
        expectedServer: 'airtable',
        expectedIntent: 'compare_data',
        context: {
          steps: ['fetch_airtable_projects', 'fetch_supabase_projects', 'compare']
        },
        complexity: 'complex'
      },
      {
        query: 'Migrate all task data from Airtable to Supabase with validation',
        expectedServer: 'airtable',
        expectedIntent: 'migrate_data',
        context: {
          steps: ['export_airtable', 'validate_data', 'import_supabase']
        },
        complexity: 'complex'
      },
      {
        query: 'Generate analytics report combining Airtable projects and Supabase metrics',
        expectedServer: 'airtable',
        expectedIntent: 'generate_report',
        context: {
          steps: ['fetch_projects', 'fetch_metrics', 'combine_data', 'generate_report']
        },
        complexity: 'complex'
      }
    ]
  },
  
  {
    id: 'performance-stress',
    name: 'Performance Stress Test',
    description: 'High-volume queries to test system limits',
    queries: [
      {
        query: 'Bulk insert 1000 records into the tasks table',
        expectedServer: 'supabase',
        expectedIntent: 'bulk_insert',
        complexity: 'complex'
      },
      {
        query: 'Stream all changes from the last hour',
        expectedServer: 'supabase',
        expectedIntent: 'stream_changes',
        complexity: 'complex'
      },
      {
        query: 'Export entire database to CSV format',
        expectedServer: 'airtable',
        expectedIntent: 'export_data',
        complexity: 'complex'
      },
      {
        query: 'Run complex aggregation across 10 tables',
        expectedServer: 'supabase',
        expectedIntent: 'aggregate_data',
        complexity: 'complex'
      }
    ]
  },
  
  {
    id: 'edge-cases',
    name: 'Edge Cases and Error Handling',
    description: 'Test system behavior with unusual queries',
    queries: [
      {
        query: 'What is the weather today?',
        expectedServer: 'either',
        expectedIntent: 'unsupported',
        complexity: 'simple'
      },
      {
        query: 'Connect to MongoDB database',
        expectedServer: 'either',
        expectedIntent: 'unsupported_server',
        complexity: 'simple'
      },
      {
        query: '',
        expectedServer: 'either',
        expectedIntent: 'empty_query',
        complexity: 'simple'
      },
      {
        query: 'SELECT * FROM users; DROP TABLE users;',
        expectedServer: 'supabase',
        expectedIntent: 'sql_injection_attempt',
        complexity: 'complex'
      }
    ]
  }
];

export function getScenarioById(id: string): DemoScenario | undefined {
  return scenarios.find(s => s.id === id);
}

export function getAllQueries(): QueryTest[] {
  return scenarios.flatMap(s => s.queries);
}

export function getQueriesByComplexity(complexity: 'simple' | 'ambiguous' | 'complex'): QueryTest[] {
  return getAllQueries().filter(q => q.complexity === complexity);
}