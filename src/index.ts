/**
 * MCP Intelligence - Semantic Intelligence Layer for MCP Servers
 * 
 * The brain that understands natural language and intelligently
 * routes to appropriate MCP servers.
 */

// Core
export { MCPIntelligence } from './core/MCPIntelligence';

// NLP
export { NLPProcessor } from './nlp/NLPProcessor';

// Registry
export { ServerRegistry } from './registry/ServerRegistry';

// Routing
export { SemanticRouter } from './routing/SemanticRouter';

// Validation
export { ValidationEngine } from './validation/ValidationEngine';

// Learning
export { LearningSystem } from './learning/LearningSystem';

// Types
export * from './types/intelligence';

// Utils
export { Logger } from './utils/logger';

// Version
export const VERSION = '1.0.0';

/**
 * Quick start function to create MCP Intelligence instance
 */
export async function createMCPIntelligence(config?: any) {
  const { MCPIntelligence } = await import('./core/MCPIntelligence');
  const intelligence = new MCPIntelligence(config);
  await intelligence.initialize();
  return intelligence;
}

/**
 * Create MCP Intelligence with PMIP integration
 */
export async function createPMIPIntelligence() {
  return createMCPIntelligence({
    pmipIntegration: true,
    enabledProtocols: {
      mcp: true,
      rest: true,
      soap: true,
      lambda: true
    },
    learning: {
      enabled: true,
      minConfidence: 0.7,
      maxHistorySize: 1000
    },
    validation: {
      enabled: true,
      strict: false
    }
  });
}