/**
 * Example: PMIP Integration with MCP Intelligence
 * 
 * Shows how Property Management Integration Platform (PMIP) can use
 * MCP Intelligence for natural language processing and intelligent routing.
 */

import { createPMIPIntelligence } from '../src';
import { PMIPContext } from '../src/types/intelligence';

async function main() {
  console.log('🚀 PMIP + MCP Intelligence Integration Example\n');

  // Initialize MCP Intelligence with PMIP configuration
  const intelligence = await createPMIPIntelligence();

  // Set up PMIP context
  const context: PMIPContext = {
    portfolio: 'Anderson Properties',
    currentUser: {
      id: 'user-123',
      role: 'manager',
      permissions: ['read', 'write', 'sync']
    },
    activeWorkflow: 'daily-sync',
    syncState: {
      lastSync: new Date(Date.now() - 3600000), // 1 hour ago
      pendingChanges: 42
    }
  };

  // Example 1: Natural language query for emergency maintenance
  console.log('📋 Example 1: Emergency Maintenance Query');
  console.log('Query: "Show all emergency work orders from last week"\n');
  
  const emergencyResult = await intelligence.query(
    "Show all emergency work orders from last week",
    context
  );
  
  console.log('Result:', JSON.stringify(emergencyResult, null, 2));
  console.log('\n---\n');

  // Example 2: Sync between systems
  console.log('🔄 Example 2: System Synchronization');
  console.log('Query: "Sync tenant data from PropertyWare to ServiceFusion"\n');
  
  const syncResult = await intelligence.query(
    "Sync tenant data from PropertyWare to ServiceFusion",
    context
  );
  
  console.log('Result:', JSON.stringify(syncResult, null, 2));
  console.log('\n---\n');

  // Example 3: Complex property query
  console.log('🏢 Example 3: Property Analytics');
  console.log('Query: "Compare occupancy rates between Anderson Tower and Riverside Complex this month"\n');
  
  const analyticsResult = await intelligence.query(
    "Compare occupancy rates between Anderson Tower and Riverside Complex this month",
    context
  );
  
  console.log('Result:', JSON.stringify(analyticsResult, null, 2));
  console.log('\n---\n');

  // Example 4: Get suggestions for partial query
  console.log('💡 Example 4: Query Suggestions');
  console.log('Partial query: "maintenance req"\n');
  
  const suggestions = await intelligence.getSuggestions("maintenance req", 5);
  
  console.log('Suggestions:');
  suggestions.forEach((suggestion, index) => {
    console.log(`  ${index + 1}. ${suggestion}`);
  });
  console.log('\n---\n');

  // Example 5: Explain a result
  console.log('📖 Example 5: Result Explanation');
  console.log('Explaining the emergency maintenance result...\n');
  
  const explanation = await intelligence.explain(emergencyResult);
  
  console.log('Explanation:', explanation);
  console.log('\n---\n');

  // Example 6: Learning from feedback
  console.log('📈 Example 6: Learning from Feedback');
  console.log('Recording that ServiceFusion was the correct choice for vendor data...\n');
  
  // Simulate learning from user feedback
  // In real usage, this would be triggered by user actions
  console.log('Feedback recorded: ServiceFusion preferred for vendor queries');
  
  // Shutdown
  await intelligence.shutdown();
  console.log('\n✅ Examples completed successfully!');
}

// Run the examples
main().catch(error => {
  console.error('❌ Error running examples:', error);
  process.exit(1);
});