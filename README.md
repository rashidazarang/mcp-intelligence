# MCP Intelligence

> The Semantic Intelligence Layer for Model Context Protocol Servers

[![MCP](https://img.shields.io/badge/MCP-Native-blue)](https://modelcontextprotocol.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Part of Orchestra Suite](https://img.shields.io/badge/Orchestra-Suite-purple)]()

## What It Is

MCP Intelligence is the **semantic brain** for MCP servers. It understands natural language queries, intelligently routes to the right MCP server, validates responses, and learns from usage patterns. 

While [Agent Orchestra](https://github.com/rashidazarang/agent-orchestra) handles the plumbing (protocol connections), MCP Intelligence provides the reasoning (what to connect and why).

## The Problem It Solves

Current MCP usage requires users to:
- Know which server has what data
- Specify exact tool names and parameters
- Handle server selection manually
- Validate results themselves

**MCP Intelligence changes this:**
- Natural language queries
- Automatic server and tool selection
- Built-in validation and reasoning
- Learning from usage patterns

## How It Works

```typescript
// Without MCP Intelligence (current way)
await orchestra.execute('mcp', 'airtable.list_records', { 
  table: 'Maintenance',
  filter: 'priority = "high"'
});

// With MCP Intelligence (new way)
await intelligence.query("Show me high priority maintenance tickets");
// Intelligence figures out the rest
```

## Architecture

```
Your Query → MCP Intelligence → Agent Orchestra → MCP Servers
                    ↓                   ↓              ↓
              (Understands)       (Executes)      (Provides)
                 "What"             "How"           "Data"
```

### The Complete Stack

| Layer | Component | Purpose |
|-------|-----------|---------|
| **Application** | PropSync, HealthSync, etc. | Business logic |
| **Intelligence** | MCP Intelligence | Understanding & reasoning |
| **Orchestration** | Agent Orchestra | Protocol execution |
| **Data** | MCP Servers | Data sources |

## Key Features

### 🧠 Natural Language Understanding
```typescript
// Ask in plain English
"Compare last month's revenue across all properties"

// MCP Intelligence understands:
// - Intent: Comparison query
// - Metric: Revenue
// - Timeframe: Previous month
// - Scope: All properties
// - Sources: PropertyWare, QuickBooks MCPs
```

### 🎯 Intelligent Routing
```typescript
// Automatically selects the right server
"Get tenant information" → Routes to PropertyWare MCP
"Check invoice status" → Routes to QuickBooks MCP
"View team tasks" → Routes to Airtable MCP
```

### ✅ Semantic Validation
```typescript
// Validates business logic
Query: "Transfer $1M from checking to savings"

// MCP Intelligence validates:
// - Sufficient balance?
// - Transfer limits?
// - Authorization?
// - Business rules?
```

### 📚 Learning & Optimization
```typescript
// Learns from patterns
- Frequently asked questions
- Common workflows
- Performance optimizations
- Error patterns
```

## Quick Start

### Installation

```bash
npm install @mcp-intelligence/core
```

### Basic Usage

```typescript
import { MCPIntelligence } from '@mcp-intelligence/core';
import { AgentOrchestra } from '@agent-orchestra/core';

// Initialize with Agent Orchestra
const orchestra = new AgentOrchestra();
const intelligence = new MCPIntelligence(orchestra);

// Register MCP servers and their capabilities
await intelligence.registerServer({
  name: 'airtable',
  capabilities: {
    tables: ['Projects', 'Tasks', 'Maintenance'],
    operations: ['query', 'create', 'update'],
    domain: 'project_management'
  }
});

// Use natural language
const result = await intelligence.query(
  "Show me all incomplete tasks for the Anderson property"
);
```

### Integration with PMIP (Property Management Integration Platform)

```typescript
class PMIP {
  private intelligence: MCPIntelligence;
  private deduplicationService: DeduplicationService;
  
  async handleRequest(naturalLanguageRequest: string) {
    // Let intelligence understand and route
    const result = await this.intelligence.query(naturalLanguageRequest);
    
    // Apply PMIP's advanced deduplication
    const deduplicated = await this.deduplicationService.process(result);
    
    // Execute through workflow manager
    return this.workflowManager.execute(deduplicated);
  }
}
```

## Core Components

### 1. Natural Language Processor
Understands user intent from natural language queries

### 2. Server Registry
Maintains capabilities and schemas for all MCP servers

### 3. Semantic Router
Intelligently routes queries to appropriate servers

### 4. Validation Engine
Ensures data integrity and business rule compliance

### 5. Learning System
Improves routing and responses over time

## Real-World Example

```typescript
// Property manager asks:
"Which vendors handled emergency calls last weekend?"

// MCP Intelligence process:
1. Parse Intent
   - Query type: Historical lookup
   - Entity: Vendors
   - Filter: Emergency calls
   - Timeframe: Last weekend

2. Identify Sources
   - ServiceFusion MCP: Has vendor dispatch data
   - PropertyWare MCP: Has emergency classifications
   
3. Plan Execution
   - Query ServiceFusion for weekend dispatches
   - Cross-reference with PropertyWare emergencies
   
4. Validate Results
   - Ensure data completeness
   - Check for discrepancies
   
5. Return Intelligence
   - List of vendors
   - Number of calls handled
   - Response times
```

## Comparison with Direct MCP Usage

| Aspect | Direct MCP | With MCP Intelligence |
|--------|------------|----------------------|
| **Query Style** | Technical, specific | Natural language |
| **Server Selection** | Manual | Automatic |
| **Tool Selection** | Must know exact name | Intelligent matching |
| **Parameters** | Must provide all | Inferred from context |
| **Validation** | Manual | Built-in |
| **Learning** | None | Continuous improvement |

## Roadmap

### Phase 1: Foundation ✅
- Basic routing logic
- Server registry
- Simple query parsing

### Phase 2: Intelligence (Current) 🚧
- Natural language processing
- Capability mapping
- Smart tool selection
- Validation framework

### Phase 3: Advanced Semantics
- Business rule engine
- Cross-server reasoning
- Context awareness
- Pattern learning

### Phase 4: AI Enhancement
- LLM integration for complex queries
- Predictive suggestions
- Anomaly detection
- Automated optimization

## Use Cases

### For PMIP (Property Management Integration Platform)
- "Show all maintenance requests pending vendor assignment"
- "Compare this month's expenses to budget"
- "Find all lease renewals due next quarter"

### For HealthSync (Healthcare)
- "List patients with appointments tomorrow"
- "Check insurance verification status"
- "Find available specialists for referral"

### For FinanceFlow (Financial)
- "Reconcile all pending transactions"
- "Generate cash flow forecast"
- "Identify unusual expenses"

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Related Projects

- [Agent Orchestra](https://github.com/rashidazarang/agent-orchestra) - Multi-protocol orchestration framework
- [PMIP](https://github.com/rashidazarang/property-management-integration-platform) - Property Management Integration Platform using this stack
- [Airtable MCP](https://github.com/rashidazarang/airtable-mcp) - Airtable MCP server

## License

MIT License - see [LICENSE](LICENSE) file

## Acknowledgments

- Built for the [Model Context Protocol](https://modelcontextprotocol.io/) ecosystem
- Inspired by the principles in "The Nature of Data and Business Intelligence"
- Part of the Orchestra Suite for intelligent orchestration

---

**The semantic brain for MCP servers** - Making MCP truly intelligent