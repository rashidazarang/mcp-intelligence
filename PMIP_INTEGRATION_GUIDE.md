# PMIP Integration Guide for MCP Intelligence

## Overview

This guide explains how to integrate MCP Intelligence into the Property Management Integration Platform (PMIP) to add natural language query capabilities and intelligent routing.

## Installation

```bash
# In your PMIP repository
npm install @mcp-intelligence/core
```

## Integration Architecture

```
User Query (Natural Language)
        ↓
  MCP Intelligence
    - Understands intent
    - Selects server
    - Validates operation
        ↓
  Agent Orchestra (in PMIP)
    - Executes operation
        ↓
  PMIP Services
    - Deduplication
    - Entity Mapping
    - Business Logic
        ↓
  Property Management Systems
```

## Step-by-Step Integration

### 1. Update PMIP Dependencies

```json
// package.json
{
  "dependencies": {
    "@agent-orchestra/core": "^2.0.0",
    "@mcp-intelligence/core": "^1.0.0",
    // ... other dependencies
  }
}
```

### 2. Create Intelligence Service in PMIP

```typescript
// src/services/intelligence/IntelligenceService.ts

import { createPMIPIntelligence, MCPIntelligence } from '@mcp-intelligence/core';
import { PMIPContext } from '@mcp-intelligence/core';
import { Logger } from '../utils/logger';

export class IntelligenceService {
  private intelligence: MCPIntelligence;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('IntelligenceService');
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing MCP Intelligence...');
    
    // Create intelligence with PMIP configuration
    this.intelligence = await createPMIPIntelligence();
    
    // Register PMIP-specific validators
    this.registerValidators();
    
    this.logger.info('MCP Intelligence initialized');
  }

  async query(naturalLanguageQuery: string, user?: any): Promise<any> {
    // Build context from PMIP state
    const context: PMIPContext = {
      portfolio: this.getCurrentPortfolio(),
      currentUser: user || this.getCurrentUser(),
      activeWorkflow: this.getActiveWorkflow(),
      syncState: await this.getSyncState()
    };

    // Process query through intelligence
    const result = await this.intelligence.query(naturalLanguageQuery, context);
    
    // Log for learning
    this.logger.info(`Query processed: ${naturalLanguageQuery}`, {
      routing: result.routing,
      confidence: result.confidence
    });

    return result;
  }

  private registerValidators(): void {
    // Add PMIP-specific validation rules
    this.intelligence.validationEngine.registerValidator('propertyware', 
      async (data) => {
        // Custom PropertyWare validation
        const errors = [];
        const warnings = [];
        
        if (data.portfolio && !this.isValidPortfolio(data.portfolio)) {
          errors.push('Invalid portfolio specified');
        }
        
        return { isValid: errors.length === 0, errors, warnings };
      }
    );
  }

  // Helper methods
  private getCurrentPortfolio(): string {
    return process.env.DEFAULT_PORTFOLIO || 'Anderson Properties';
  }

  private getCurrentUser(): any {
    return {
      id: 'system',
      role: 'admin',
      permissions: ['read', 'write', 'sync', 'admin']
    };
  }

  private getActiveWorkflow(): string | undefined {
    // Get from workflow manager
    return undefined;
  }

  private async getSyncState(): Promise<any> {
    // Get from sync service
    return {
      lastSync: new Date(),
      pendingChanges: 0
    };
  }

  private isValidPortfolio(portfolio: string): boolean {
    // Validate against known portfolios
    return true;
  }
}
```

### 3. Integrate with PMIP Workflow Manager

```typescript
// src/workflows/IntelligentWorkflowManager.ts

import { WorkflowManager } from './WorkflowManager';
import { IntelligenceService } from '../services/intelligence/IntelligenceService';

export class IntelligentWorkflowManager extends WorkflowManager {
  private intelligenceService: IntelligenceService;

  constructor() {
    super();
    this.intelligenceService = new IntelligenceService();
  }

  async initialize(): Promise<void> {
    await super.initialize();
    await this.intelligenceService.initialize();
  }

  /**
   * Execute workflow from natural language
   */
  async executeNaturalLanguage(query: string): Promise<any> {
    // Get intelligence routing
    const result = await this.intelligenceService.query(query);
    
    if (!result.success) {
      throw new Error(`Failed to understand query: ${result.error}`);
    }

    // Map to workflow
    const workflow = this.mapToWorkflow(result);
    
    // Execute through normal workflow engine
    return await this.executeWorkflow(workflow);
  }

  private mapToWorkflow(intelligenceResult: any): any {
    const { routing, intent } = intelligenceResult;
    
    // Map intelligence routing to PMIP workflow
    return {
      name: `nl-${intent.action}-${Date.now()}`,
      steps: [
        {
          name: 'execute-operation',
          adapter: routing.server,
          operation: routing.tool,
          params: routing.params
        }
      ]
    };
  }
}
```

### 4. Add Natural Language API Endpoints

```typescript
// src/api/nlp.ts

import { Router } from 'express';
import { IntelligenceService } from '../services/intelligence/IntelligenceService';

const router = Router();
const intelligenceService = new IntelligenceService();

// Initialize on startup
intelligenceService.initialize();

/**
 * POST /api/nlp/query
 * Process natural language query
 */
router.post('/query', async (req, res) => {
  try {
    const { query, context } = req.body;
    
    if (!query) {
      return res.status(400).json({
        error: 'Query is required'
      });
    }

    const result = await intelligenceService.query(query, context);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * POST /api/nlp/suggestions
 * Get query suggestions
 */
router.post('/suggestions', async (req, res) => {
  try {
    const { partial, limit = 5 } = req.body;
    
    const suggestions = await intelligenceService.getSuggestions(partial, limit);
    
    res.json({ suggestions });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

export default router;
```

### 5. Update PMIP Main Application

```typescript
// src/index.ts

import { createOrchestraV2 } from '@agent-orchestra/core';
import { IntelligenceService } from './services/intelligence/IntelligenceService';
import { DeduplicationService } from './services/deduplication/DeduplicationService';
import { DataWarehouseService } from './services/data-warehouse/DataWarehouseService';

export class PMIP {
  private orchestra: any;
  private intelligence: IntelligenceService;
  private deduplication: DeduplicationService;
  private dataWarehouse: DataWarehouseService;

  async initialize(): Promise<void> {
    // Initialize Agent Orchestra
    this.orchestra = await createOrchestraV2({
      protocols: {
        mcp: true,
        rest: true,
        soap: true,
        lambda: true
      }
    });

    // Initialize MCP Intelligence
    this.intelligence = new IntelligenceService();
    await this.intelligence.initialize();

    // Initialize PMIP services
    this.deduplication = new DeduplicationService();
    this.dataWarehouse = new DataWarehouseService();
  }

  /**
   * Process natural language query
   */
  async query(naturalLanguageQuery: string): Promise<any> {
    // Use intelligence for understanding
    const intelligenceResult = await this.intelligence.query(naturalLanguageQuery);
    
    // Execute through orchestra
    const data = await this.orchestra.execute(
      intelligenceResult.routing.protocol,
      intelligenceResult.routing.tool,
      intelligenceResult.routing.params
    );
    
    // Apply PMIP processing
    const deduplicated = await this.deduplication.process(data);
    const result = await this.dataWarehouse.store(deduplicated);
    
    return result;
  }
}
```

## Usage Examples

### Example 1: Emergency Maintenance

```typescript
const pmip = new PMIP();
await pmip.initialize();

// Natural language query
const result = await pmip.query(
  "Create an emergency work order for flooding in unit 501 at Anderson Tower"
);

console.log('Work order created:', result);
```

### Example 2: Data Synchronization

```typescript
// Sync between systems using natural language
const syncResult = await pmip.query(
  "Sync all pending work orders from PropertyWare to ServiceFusion"
);

console.log('Synced:', syncResult.count, 'work orders');
```

### Example 3: Analytics Query

```typescript
// Complex analytics query
const analytics = await pmip.query(
  "Compare maintenance costs between Q3 and Q4 for all properties"
);

console.log('Cost comparison:', analytics);
```

## Configuration

### Environment Variables

```bash
# .env
MCP_INTELLIGENCE_LEARNING=true
MCP_INTELLIGENCE_CACHE_TTL=300000
MCP_INTELLIGENCE_MIN_CONFIDENCE=0.7
```

### Custom Configuration

```typescript
// config/intelligence.config.ts
export const intelligenceConfig = {
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
  },
  cache: {
    enabled: true,
    ttl: 300000
  }
};
```

## Benefits for PMIP

1. **Natural Language Interface**: Property managers can use plain English
2. **Intelligent Routing**: Automatically selects PropertyWare vs ServiceFusion
3. **Validation**: Built-in property management rule validation
4. **Learning**: Improves routing decisions over time
5. **Reduced Complexity**: No need to know which system has what data

## Monitoring and Optimization

### Track Query Performance

```typescript
// Monitor intelligence metrics
intelligence.on('query:completed', (event) => {
  metrics.record({
    query: event.query,
    duration: event.duration,
    confidence: event.confidence,
    server: event.routing.server
  });
});
```

### Learning from Feedback

```typescript
// Record user feedback for learning
await intelligence.recordFeedback(queryId, {
  helpful: true,
  rating: 5,
  comment: 'Correctly routed to ServiceFusion'
});
```

## Troubleshooting

### Low Confidence Scores

If queries consistently return low confidence:
1. Check server registrations are complete
2. Verify entity and operation mappings
3. Review learning data for patterns

### Routing Errors

If queries route to wrong servers:
1. Update server capabilities
2. Add more specific entity mappings
3. Provide feedback for learning

## Next Steps

1. **Implement the integration** in PMIP
2. **Test with real queries** from property managers
3. **Monitor and optimize** based on usage patterns
4. **Extend with custom validators** for your specific needs
5. **Train the system** with your domain terminology

## Support

For issues or questions about MCP Intelligence integration:
- GitHub Issues: https://github.com/rashidazarang/mcp-intelligence/issues
- Documentation: https://github.com/rashidazarang/mcp-intelligence

---

With MCP Intelligence integrated, PMIP becomes an intelligent platform that understands natural language and automatically routes to the appropriate property management system!