/**
 * Example: Basic MCP Intelligence Usage
 * 
 * Shows how to use MCP Intelligence for natural language queries
 * and intelligent routing to MCP servers.
 */

import { createMCPIntelligence, ServerCapability } from '../src';

async function main() {
  console.log('🧠 MCP Intelligence Basic Usage Example\n');

  // Initialize MCP Intelligence
  const intelligence = await createMCPIntelligence({
    enabledProtocols: {
      mcp: true,
      rest: true
    },
    learning: {
      enabled: true
    },
    validation: {
      enabled: true
    }
  });

  // Register some MCP servers
  console.log('📝 Registering MCP servers...\n');

  // Register Airtable MCP
  await intelligence.registerServer('airtable', {
    protocol: 'mcp',
    package: '@rashidazarang/airtable-mcp',
    domains: ['project_management', 'data_storage'],
    entities: ['table', 'record', 'base', 'field'],
    operations: ['query', 'create', 'update', 'delete'],
    description: 'Airtable database with flexible schemas'
  } as ServerCapability);

  // Register Supabase MCP
  await intelligence.registerServer('supabase', {
    protocol: 'mcp',
    package: '@supabase/mcp-server',
    domains: ['database', 'analytics'],
    entities: ['table', 'row', 'function', 'view'],
    operations: ['query', 'insert', 'update', 'delete', 'upsert'],
    description: 'Supabase PostgreSQL database'
  } as ServerCapability);

  // Register GitHub MCP
  await intelligence.registerServer('github', {
    protocol: 'mcp',
    package: '@modelcontextprotocol/server-github',
    domains: ['development', 'version_control'],
    entities: ['repository', 'issue', 'pull_request', 'commit'],
    operations: ['query', 'create', 'update', 'close'],
    description: 'GitHub repository management'
  } as ServerCapability);

  console.log('✅ Servers registered\n');
  console.log('---\n');

  // Example 1: Simple query
  console.log('🔍 Example 1: Simple Query');
  console.log('Query: "Show all records from the Projects table"\n');

  const result1 = await intelligence.query("Show all records from the Projects table");
  
  console.log('Intent:', result1.intent);
  console.log('Routing:', result1.routing);
  console.log('Confidence:', result1.confidence);
  console.log('\n---\n');

  // Example 2: Cross-server query
  console.log('🔄 Example 2: Cross-Server Query');
  console.log('Query: "Copy issues from GitHub to Airtable tasks table"\n');

  const result2 = await intelligence.query("Copy issues from GitHub to Airtable tasks table");
  
  console.log('Intent:', result2.intent);
  console.log('Routing:', result2.routing);
  console.log('\n---\n');

  // Example 3: Query with filters
  console.log('🎯 Example 3: Filtered Query');
  console.log('Query: "Find high priority issues created last week"\n');

  const result3 = await intelligence.query("Find high priority issues created last week");
  
  console.log('Intent:', result3.intent);
  console.log('Filters:', result3.intent?.filters);
  console.log('Timeframe:', result3.intent?.timeframe);
  console.log('\n---\n');

  // Example 4: Get suggestions
  console.log('💡 Example 4: Query Suggestions');
  console.log('Partial: "create new"\n');

  const suggestions = await intelligence.getSuggestions("create new", 3);
  
  console.log('Suggestions:');
  suggestions.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
  console.log('\n---\n');

  // Example 5: Validation example
  console.log('✅ Example 5: Validation');
  console.log('Query: "Delete all records" (should trigger validation warning)\n');

  const result5 = await intelligence.query("Delete all records");
  
  console.log('Validation:', result5.validation);
  console.log('\n---\n');

  // Shutdown
  await intelligence.shutdown();
  console.log('✨ Examples completed!');
}

// Run the examples
main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});