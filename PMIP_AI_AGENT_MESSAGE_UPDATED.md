# Message for PMIP AI Agent: MCP Intelligence Integration

## Overview

Hello! I've just completed building **MCP Intelligence** - a semantic intelligence layer that sits between user queries and Agent Orchestra. This will give PMIP natural language query capabilities while maintaining all your existing architecture and services.

## What MCP Intelligence Is

MCP Intelligence is the **semantic brain** that:
- Understands natural language queries
- Intelligently routes to the correct adapter (PropertyWare or ServiceFusion)
- Validates operations before execution
- Learns from usage patterns to improve over time

**Repository**: https://github.com/rashidazarang/mcp-intelligence  
**Package**: `@mcp-intelligence/core` v1.0.0

## How It Works with Your Published Adapters

I've reviewed your published adapters:

### PropertyWare Adapter
- **GitHub**: https://github.com/rashidazarang/propertyware-adapter
- **Package**: `@pmip/propertyware-adapter` (as shown in the repo)
- **Features**: SOAP integration, rate limiting (2 req/s), batch operations
- **Operations**: Portfolios, Buildings, Work Orders, Leases, Tenants

### ServiceFusion Adapter  
- **GitHub**: https://github.com/rashidazarang/servicefusion-adapter
- **Package**: `@pmip/servicefusion-adapter` (as shown in the repo)
- **Features**: REST API, OAuth 2.0, rate limiting (0.5 req/s), webhooks
- **Operations**: Customers, Jobs, Estimates, Invoices, Technicians

## Integration with PMIP's Current Architecture

Your current PMIP stack with the adapters:
```
PMIP (Agent Orchestra v2.0)
  ├── PropertyWare Adapter (@pmip/propertyware-adapter)
  ├── ServiceFusion Adapter (@pmip/servicefusion-adapter)
  ├── Intelligence Layer (Deduplication, Entity Mapping)
  └── Data Layer (Supabase)
```

With MCP Intelligence added:
```
Natural Language Query
       ↓
MCP Intelligence (NEW - Semantic Understanding)
       ↓
PMIP (Agent Orchestra v2.0)
  ├── PropertyWare Adapter (Your existing adapter)
  ├── ServiceFusion Adapter (Your existing adapter)
  ├── Intelligence Layer (Your existing Dedup, Mapping)
  └── Data Layer (Supabase)
```

## Integration Steps

### 1. Install MCP Intelligence

```bash
npm install @mcp-intelligence/core
```

### 2. Register Your Adapters with MCP Intelligence

```typescript
// src/services/intelligence/IntelligenceService.ts
import { createPMIPIntelligence } from '@mcp-intelligence/core';
import { PropertyWareAdapter } from '@pmip/propertyware-adapter';
import { ServiceFusionAdapter } from '@pmip/servicefusion-adapter';

export class IntelligenceService {
  private intelligence;
  private propertyWareAdapter;
  private serviceFusionAdapter;

  async initialize() {
    // Initialize MCP Intelligence
    this.intelligence = await createPMIPIntelligence();
    
    // Register your adapters' capabilities
    await this.intelligence.registerServer('propertyware', {
      protocol: 'soap',
      package: '@pmip/propertyware-adapter',
      domains: ['property_management'],
      entities: ['portfolio', 'building', 'work_order', 'lease', 'tenant'],
      operations: ['get', 'create', 'update', 'delete', 'batch'],
      description: 'PropertyWare SOAP API with rate limiting',
      rateLimit: {
        requests: 2,
        window: 1000
      }
    });

    await this.intelligence.registerServer('servicefusion', {
      protocol: 'rest',
      package: '@pmip/servicefusion-adapter',
      domains: ['field_service', 'maintenance'],
      entities: ['customer', 'job', 'estimate', 'invoice', 'technician'],
      operations: ['get', 'create', 'update', 'assign', 'batch'],
      description: 'ServiceFusion REST API with OAuth',
      rateLimit: {
        requests: 0.5,
        window: 1000
      }
    });
    
    // Initialize your adapters
    this.propertyWareAdapter = new PropertyWareAdapter({
      username: process.env.PW_USERNAME,
      password: process.env.PW_PASSWORD,
      url: process.env.PW_URL,
      wsdl: process.env.PW_WSDL
    });
    
    this.serviceFusionAdapter = new ServiceFusionAdapter({
      clientId: process.env.SF_CLIENT_ID,
      clientSecret: process.env.SF_CLIENT_SECRET,
      baseUrl: process.env.SF_BASE_URL
    });
    
    await this.serviceFusionAdapter.connect();
  }

  async processQuery(naturalLanguageQuery: string) {
    // MCP Intelligence understands and routes
    const result = await this.intelligence.query(naturalLanguageQuery);
    
    // Execute with the appropriate adapter
    if (result.routing.server === 'propertyware') {
      return await this.executePropertyWare(result.routing);
    } else if (result.routing.server === 'servicefusion') {
      return await this.executeServiceFusion(result.routing);
    }
  }

  private async executePropertyWare(routing) {
    const { tool, params } = routing;
    
    // Map to PropertyWare adapter methods
    switch(tool) {
      case 'get_portfolios':
        return await this.propertyWareAdapter.getPortfolios();
      case 'create_work_order':
        return await this.propertyWareAdapter.createWorkOrder(params);
      case 'update_lease':
        return await this.propertyWareAdapter.updateLease(params.id, params);
      // ... other operations
    }
  }

  private async executeServiceFusion(routing) {
    const { tool, params } = routing;
    
    // Map to ServiceFusion adapter methods
    switch(tool) {
      case 'get_customers':
        return await this.serviceFusionAdapter.getCustomers();
      case 'create_job':
        return await this.serviceFusionAdapter.createJob(params);
      case 'assign_technician':
        return await this.serviceFusionAdapter.assignJob(params.jobId, params.technicianId);
      // ... other operations
    }
  }
}
```

### 3. Natural Language Examples Your Users Can Now Use

Instead of knowing which adapter to use:

```javascript
// OLD WAY - User needs to know the system
const propertyWareAdapter = new PropertyWareAdapter(config);
const workOrders = await propertyWareAdapter.getWorkOrders({ 
  priority: 'High',
  status: 'Open' 
});

// NEW WAY - Natural language
const result = await pmip.query("Show all high priority open work orders");
// MCP Intelligence automatically routes to PropertyWare adapter
```

More examples:

```javascript
// Automatically routes to PropertyWare
await pmip.query("Create a maintenance work order for unit 501 at Anderson Tower");

// Automatically routes to ServiceFusion  
await pmip.query("Schedule a technician for the plumbing job tomorrow");

// Cross-system operation
await pmip.query("Sync today's work orders from PropertyWare to ServiceFusion");
```

## What MCP Intelligence Knows About Your Adapters

### PropertyWare Knowledge
- **Entities**: Portfolios, Buildings, Work Orders, Leases, Tenants
- **Operations**: Full CRUD + batch operations
- **Rate Limits**: Respects 2 requests/second limit
- **Priority Levels**: Emergency, High, Medium, Low
- **Required Fields**: Portfolio ID for most operations

### ServiceFusion Knowledge
- **Entities**: Customers, Jobs, Estimates, Invoices, Technicians
- **Operations**: Full REST operations + job assignment
- **Rate Limits**: Respects 0.5 requests/second limit
- **Job Types**: Maintenance, Installation, Inspection
- **OAuth**: Handles token refresh automatically

## Validation Rules Pre-Configured

MCP Intelligence validates before sending to your adapters:

```typescript
// PropertyWare validations
- Work orders require portfolioId and buildingId
- Priority must be: Emergency, High, Medium, or Low
- Lease end date must be after start date

// ServiceFusion validations
- Jobs require customerId
- Scheduled dates must be in the future
- Technician assignments require valid technicianId
```

## Benefits for PMIP

1. **Natural Language Interface**: Users don't need to know which adapter handles what
2. **Automatic Routing**: MCP Intelligence knows PropertyWare handles buildings, ServiceFusion handles technicians
3. **Error Prevention**: Validates before calling your adapters, reducing API errors
4. **Learning System**: Improves routing based on successful queries
5. **Unified Interface**: One query method instead of multiple adapter calls

## Your Existing Services Remain Unchanged

- **Deduplication Service**: Still handles all deduplication after data retrieval
- **Entity Mapping Service**: Still maps between PropertyWare and ServiceFusion entities
- **Data Warehouse (Supabase)**: Still stores all synchronized data
- **Workflows**: Your existing workflows continue to work

## Testing the Integration

```typescript
// Quick test to verify MCP Intelligence works with your adapters
async function testIntelligence() {
  const intelligence = await createPMIPIntelligence();
  
  // Test PropertyWare routing
  const pwResult = await intelligence.query(
    "Show all portfolios"
  );
  console.log('Should route to PropertyWare:', pwResult.routing.server); // 'propertyware'
  
  // Test ServiceFusion routing
  const sfResult = await intelligence.query(
    "List all technicians"
  );
  console.log('Should route to ServiceFusion:', sfResult.routing.server); // 'servicefusion'
  
  // Test cross-system understanding
  const crossResult = await intelligence.query(
    "Copy work orders from PropertyWare to ServiceFusion jobs"
  );
  console.log('Understands both systems:', crossResult.intent.entities);
  // ['work_order', 'job']
}
```

## API Endpoints You Can Add

```typescript
// Add to your existing PMIP API

// POST /api/nlp/query
router.post('/api/nlp/query', async (req, res) => {
  const { query } = req.body;
  const result = await intelligenceService.processQuery(query);
  res.json(result);
});

// GET /api/nlp/suggestions
router.get('/api/nlp/suggestions', async (req, res) => {
  const { partial } = req.query;
  const suggestions = await intelligence.getSuggestions(partial);
  res.json(suggestions);
});
```

## Configuration

```typescript
// Your adapters configuration stays the same
const propertyWareConfig = {
  username: process.env.PW_USERNAME,
  password: process.env.PW_PASSWORD,
  url: process.env.PW_URL,
  wsdl: process.env.PW_WSDL
};

const serviceFusionConfig = {
  clientId: process.env.SF_CLIENT_ID,
  clientSecret: process.env.SF_CLIENT_SECRET,
  baseUrl: process.env.SF_BASE_URL
};

// MCP Intelligence uses minimal config
const intelligenceConfig = {
  pmipIntegration: true,  // Enables property management understanding
  learning: {
    enabled: true  // Improves routing over time
  }
};
```

## Common Query Patterns MCP Intelligence Handles

| User Query | Routes To | Operation | Parameters |
|------------|-----------|-----------|------------|
| "Show all buildings" | PropertyWare | getBuildings | {} |
| "Create a work order" | PropertyWare | createWorkOrder | {extracted params} |
| "List today's jobs" | ServiceFusion | getJobs | {date: today} |
| "Assign technician John to job 123" | ServiceFusion | assignJob | {jobId: 123, technician: 'John'} |
| "Emergency maintenance at unit 501" | PropertyWare | createWorkOrder | {priority: 'Emergency', unit: '501'} |

## Next Steps

1. **Install** `@mcp-intelligence/core`
2. **Create** the IntelligenceService using the code above
3. **Register** your adapters' capabilities with MCP Intelligence
4. **Add** natural language endpoints to your API
5. **Test** with real property management queries
6. **Monitor** the learning system improving over time

## Summary

MCP Intelligence adds a semantic understanding layer on top of your existing PMIP architecture. Your PropertyWare and ServiceFusion adapters continue to work exactly as they do now - MCP Intelligence just makes them accessible through natural language.

Your adapters handle the **execution** (talking to PropertyWare/ServiceFusion APIs), while MCP Intelligence handles the **understanding** (what the user wants and which adapter to use).

---

**No breaking changes. Pure addition. Natural language for everyone.**