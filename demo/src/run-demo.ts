#!/usr/bin/env node

import * as chalk from 'chalk';
import * as cliProgress from 'cli-progress';
import { Table } from 'console-table-printer';
import { PerformanceMonitor, QueryMetrics } from './performance/PerformanceMonitor';
import { scenarios, DemoScenario, QueryTest } from './scenarios';
import { BaselineRunner } from './baseline/BaselineRunner';
import { nanoid } from 'nanoid';

// Try to import real MCPIntelligence, fall back to mock if not available
let MCPIntelligence: any;
try {
  MCPIntelligence = require('../../src/core/MCPIntelligence').MCPIntelligence;
} catch {
  console.log(chalk.yellow('⚠️  Using mock MCP Intelligence for demo'));
  MCPIntelligence = require('./mock/MCPIntelligence.mock').MCPIntelligenceMock;
}

class DemoRunner {
  private intelligence: any;
  private monitor: PerformanceMonitor;
  private baseline: BaselineRunner;
  private progressBar: cliProgress.SingleBar;
  
  constructor() {
    this.intelligence = new MCPIntelligence();
    this.monitor = new PerformanceMonitor();
    this.baseline = new BaselineRunner();
    
    this.progressBar = new cliProgress.SingleBar({
      format: 'Demo Progress |{bar}| {percentage}% | {value}/{total} Queries | {scenario}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    });
  }
  
  async initialize(): Promise<void> {
    console.log(chalk.cyan.bold('\n🚀 MCP Intelligence Demo\n'));
    console.log(chalk.gray('Initializing systems...'));
    
    // Register MCP servers
    await this.intelligence.registerServer('airtable', {
      name: 'airtable',
      version: '1.0.0',
      capabilities: {
        tools: [
          { name: 'list_bases', description: 'List all Airtable bases' },
          { name: 'list_tables', description: 'List tables in a base' },
          { name: 'get_records', description: 'Get records from a table' },
          { name: 'create_record', description: 'Create a new record' },
          { name: 'update_record', description: 'Update an existing record' },
          { name: 'delete_record', description: 'Delete a record' }
        ]
      }
    });
    
    await this.intelligence.registerServer('supabase', {
      name: 'supabase',
      version: '1.0.0',
      capabilities: {
        tools: [
          { name: 'list_tables', description: 'List database tables' },
          { name: 'execute_sql', description: 'Execute SQL query' },
          { name: 'subscribe_realtime', description: 'Subscribe to real-time updates' },
          { name: 'insert_data', description: 'Insert data into table' },
          { name: 'update_data', description: 'Update table data' },
          { name: 'delete_data', description: 'Delete table data' }
        ]
      }
    });
    
    console.log(chalk.green('✓ Systems initialized\n'));
  }
  
  async runScenario(scenario: DemoScenario): Promise<void> {
    console.log(chalk.yellow.bold(`\n📋 Running Scenario: ${scenario.name}`));
    console.log(chalk.gray(scenario.description));
    console.log(chalk.gray('─'.repeat(60)));
    
    for (const query of scenario.queries) {
      await this.testQuery(query, scenario.name);
    }
  }
  
  async testQuery(query: QueryTest, scenarioName: string): Promise<void> {
    const queryId = nanoid();
    
    console.log(chalk.white(`\n🔍 Query: "${query.query}"`));
    
    // Run with MCP Intelligence
    const intelligentStart = Date.now();
    const intelligentResult = await this.runWithIntelligence(query);
    const intelligentTime = Date.now() - intelligentStart;
    
    // Run baseline (direct catalog)
    const baselineStart = Date.now();
    const baselineResult = await this.baseline.run(query);
    const baselineTime = Date.now() - baselineStart;
    
    // Record metrics
    const metrics: QueryMetrics = {
      queryId,
      timestamp: new Date(),
      query: query.query,
      intent: query.expectedIntent,
      routing: {
        decision: intelligentResult.server,
        confidence: intelligentResult.confidence,
        timeMs: intelligentResult.routingTime,
        tokensUsed: intelligentResult.routingTokens
      },
      execution: {
        server: intelligentResult.server,
        tool: intelligentResult.tool,
        success: intelligentResult.success,
        timeMs: intelligentTime - intelligentResult.routingTime,
        tokensUsed: intelligentResult.executionTokens
      },
      baseline: {
        timeMs: baselineTime,
        tokensUsed: baselineResult.tokensUsed,
        toolsEvaluated: baselineResult.toolsEvaluated
      }
    };
    
    await this.monitor.recordQuery(metrics);
    
    // Display results
    this.displayComparison(metrics);
  }
  
  private async runWithIntelligence(query: QueryTest): Promise<any> {
    // Process query through MCP Intelligence
    const result = await this.intelligence.processQuery(query.query, query.context);
    
    return {
      server: result.routing.server,
      tool: result.routing.tool,
      confidence: result.routing.confidence,
      routingTime: result.metrics.routingTime,
      routingTokens: result.metrics.routingTokens,
      executionTokens: result.metrics.executionTokens,
      success: result.success
    };
  }
  
  private displayComparison(metrics: QueryMetrics): void {
    const latencyImprovement = metrics.baseline 
      ? ((metrics.baseline.timeMs - (metrics.routing.timeMs + metrics.execution.timeMs)) / metrics.baseline.timeMs * 100)
      : 0;
      
    const tokenSavings = metrics.baseline
      ? ((metrics.baseline.tokensUsed - (metrics.routing.tokensUsed + metrics.execution.tokensUsed)) / metrics.baseline.tokensUsed * 100)
      : 0;
    
    const table = new Table({
      columns: [
        { name: 'metric', title: 'Metric', alignment: 'left' },
        { name: 'intelligent', title: 'MCP Intelligence', alignment: 'center' },
        { name: 'baseline', title: 'Baseline', alignment: 'center' },
        { name: 'improvement', title: 'Improvement', alignment: 'center' }
      ]
    });
    
    table.addRow({
      metric: 'Latency (ms)',
      intelligent: `${metrics.routing.timeMs + metrics.execution.timeMs}`,
      baseline: metrics.baseline?.timeMs || 'N/A',
      improvement: latencyImprovement > 0 
        ? chalk.green(`↓ ${latencyImprovement.toFixed(1)}%`)
        : chalk.red(`↑ ${Math.abs(latencyImprovement).toFixed(1)}%`)
    });
    
    table.addRow({
      metric: 'Tokens Used',
      intelligent: `${metrics.routing.tokensUsed + metrics.execution.tokensUsed}`,
      baseline: metrics.baseline?.tokensUsed || 'N/A',
      improvement: tokenSavings > 0
        ? chalk.green(`↓ ${tokenSavings.toFixed(1)}%`)
        : chalk.red(`↑ ${Math.abs(tokenSavings).toFixed(1)}%`)
    });
    
    table.addRow({
      metric: 'Server',
      intelligent: metrics.routing.decision,
      baseline: 'All Servers',
      improvement: chalk.blue(`${metrics.routing.confidence.toFixed(2)} confidence`)
    });
    
    table.printTable();
  }
  
  async runFullDemo(): Promise<void> {
    await this.initialize();
    
    const totalQueries = scenarios.reduce((sum, s) => sum + s.queries.length, 0);
    this.progressBar.start(totalQueries, 0, { scenario: 'Starting...' });
    
    let completedQueries = 0;
    
    for (const scenario of scenarios) {
      this.progressBar.update(completedQueries, { scenario: scenario.name });
      
      for (const query of scenario.queries) {
        await this.testQuery(query, scenario.name);
        completedQueries++;
        this.progressBar.update(completedQueries);
      }
    }
    
    this.progressBar.stop();
    
    // Generate and save report
    console.log(chalk.cyan.bold('\n📊 Generating Performance Report...\n'));
    await this.monitor.saveReport('./demo-results');
    
    // Display summary
    const report = await this.monitor.generateReport();
    this.displaySummary(report);
  }
  
  private displaySummary(report: any): void {
    console.log(chalk.green.bold('\n✨ Demo Complete!\n'));
    
    const summaryTable = new Table({
      title: 'Performance Summary',
      columns: [
        { name: 'metric', title: 'Metric', alignment: 'left' },
        { name: 'value', title: 'Value', alignment: 'center' }
      ]
    });
    
    summaryTable.addRow({
      metric: 'Total Queries Tested',
      value: report.summary.totalQueries
    });
    
    summaryTable.addRow({
      metric: 'Routing Accuracy',
      value: chalk.cyan(`${(report.summary.avgRoutingAccuracy * 100).toFixed(1)}%`)
    });
    
    summaryTable.addRow({
      metric: 'Average Latency Reduction',
      value: chalk.green(`${(report.summary.avgLatencyReduction * 100).toFixed(1)}%`)
    });
    
    summaryTable.addRow({
      metric: 'Average Token Savings',
      value: chalk.green(`${(report.summary.avgTokenSavings * 100).toFixed(1)}%`)
    });
    
    summaryTable.printTable();
    
    console.log(chalk.gray('\n📁 Full report available at: ./demo-results/dashboard.html'));
    console.log(chalk.gray('📄 Markdown summary at: ./demo-results/summary.md'));
    console.log(chalk.gray('📊 Raw data at: ./demo-results/performance-report.json\n'));
  }
}

// Main execution
if (require.main === module) {
  const runner = new DemoRunner();
  
  runner.runFullDemo().catch(error => {
    console.error(chalk.red('❌ Demo failed:'), error);
    process.exit(1);
  });
}

export { DemoRunner };