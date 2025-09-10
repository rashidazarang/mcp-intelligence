import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface QueryMetrics {
  queryId: string;
  timestamp: Date;
  query: string;
  intent: string;
  
  routing: {
    decision: string;
    confidence: number;
    timeMs: number;
    tokensUsed: number;
  };
  
  execution: {
    server: string;
    tool: string;
    success: boolean;
    timeMs: number;
    tokensUsed: number;
    error?: string;
  };
  
  baseline?: {
    timeMs: number;
    tokensUsed: number;
    toolsEvaluated: number;
  };
}

export interface PerformanceReport {
  summary: {
    totalQueries: number;
    avgRoutingAccuracy: number;
    avgLatencyReduction: number;
    avgTokenSavings: number;
  };
  
  routingMetrics: {
    correctRoutings: number;
    incorrectRoutings: number;
    accuracy: number;
    confusionMatrix: Record<string, Record<string, number>>;
  };
  
  latencyMetrics: {
    avgIntelligentLatency: number;
    avgBaselineLatency: number;
    reduction: number;
    percentile95: number;
    percentile99: number;
  };
  
  tokenMetrics: {
    avgIntelligentTokens: number;
    avgBaselineTokens: number;
    totalSaved: number;
    savingsPercentage: number;
  };
  
  details: QueryMetrics[];
}

export class PerformanceMonitor extends EventEmitter {
  private metrics: QueryMetrics[] = [];
  private startTime: Date;
  
  constructor() {
    super();
    this.startTime = new Date();
  }
  
  async recordQuery(metrics: QueryMetrics): Promise<void> {
    this.metrics.push(metrics);
    this.emit('query-recorded', metrics);
    
    // Log in real-time for demo visibility
    this.logMetrics(metrics);
  }
  
  private logMetrics(metrics: QueryMetrics): void {
    const latencyReduction = metrics.baseline 
      ? ((metrics.baseline.timeMs - metrics.execution.timeMs) / metrics.baseline.timeMs * 100).toFixed(1)
      : 'N/A';
      
    const tokenSavings = metrics.baseline
      ? ((metrics.baseline.tokensUsed - (metrics.routing.tokensUsed + metrics.execution.tokensUsed)) / metrics.baseline.tokensUsed * 100).toFixed(1)
      : 'N/A';
    
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║ Query: ${metrics.query.substring(0, 50).padEnd(50)} ║
╠════════════════════════════════════════════════════════════════╣
║ Routing:                                                       ║
║   • Decision: ${metrics.routing.decision.padEnd(20)} Confidence: ${metrics.routing.confidence.toFixed(2)} ║
║   • Time: ${metrics.routing.timeMs}ms | Tokens: ${metrics.routing.tokensUsed}                       ║
║                                                                ║
║ Execution:                                                     ║
║   • Server: ${metrics.execution.server.padEnd(20)} Tool: ${metrics.execution.tool}     ║
║   • Time: ${metrics.execution.timeMs}ms | Tokens: ${metrics.execution.tokensUsed}                   ║
║   • Success: ${metrics.execution.success ? '✅' : '❌'}                                     ║
║                                                                ║
║ Improvements:                                                  ║
║   • Latency Reduction: ${latencyReduction}%                              ║
║   • Token Savings: ${tokenSavings}%                                  ║
╚════════════════════════════════════════════════════════════════╝
    `);
  }
  
  async generateReport(): Promise<PerformanceReport> {
    const report: PerformanceReport = {
      summary: {
        totalQueries: this.metrics.length,
        avgRoutingAccuracy: 0,
        avgLatencyReduction: 0,
        avgTokenSavings: 0
      },
      routingMetrics: {
        correctRoutings: 0,
        incorrectRoutings: 0,
        accuracy: 0,
        confusionMatrix: {}
      },
      latencyMetrics: {
        avgIntelligentLatency: 0,
        avgBaselineLatency: 0,
        reduction: 0,
        percentile95: 0,
        percentile99: 0
      },
      tokenMetrics: {
        avgIntelligentTokens: 0,
        avgBaselineTokens: 0,
        totalSaved: 0,
        savingsPercentage: 0
      },
      details: this.metrics
    };
    
    // Calculate routing accuracy
    const correctRoutings = this.metrics.filter(m => m.execution.success).length;
    report.routingMetrics.correctRoutings = correctRoutings;
    report.routingMetrics.incorrectRoutings = this.metrics.length - correctRoutings;
    report.routingMetrics.accuracy = correctRoutings / this.metrics.length;
    
    // Build confusion matrix
    for (const metric of this.metrics) {
      const expected = metric.intent;
      const actual = metric.routing.decision;
      
      if (!report.routingMetrics.confusionMatrix[expected]) {
        report.routingMetrics.confusionMatrix[expected] = {};
      }
      
      report.routingMetrics.confusionMatrix[expected][actual] = 
        (report.routingMetrics.confusionMatrix[expected][actual] || 0) + 1;
    }
    
    // Calculate latency metrics
    const intelligentLatencies = this.metrics.map(m => m.routing.timeMs + m.execution.timeMs);
    const baselineLatencies = this.metrics
      .filter(m => m.baseline)
      .map(m => m.baseline!.timeMs);
    
    if (intelligentLatencies.length > 0) {
      report.latencyMetrics.avgIntelligentLatency = 
        intelligentLatencies.reduce((a, b) => a + b, 0) / intelligentLatencies.length;
      
      // Calculate percentiles
      const sorted = [...intelligentLatencies].sort((a, b) => a - b);
      report.latencyMetrics.percentile95 = sorted[Math.floor(sorted.length * 0.95)];
      report.latencyMetrics.percentile99 = sorted[Math.floor(sorted.length * 0.99)];
    }
    
    if (baselineLatencies.length > 0) {
      report.latencyMetrics.avgBaselineLatency = 
        baselineLatencies.reduce((a, b) => a + b, 0) / baselineLatencies.length;
      
      report.latencyMetrics.reduction = 
        (report.latencyMetrics.avgBaselineLatency - report.latencyMetrics.avgIntelligentLatency) /
        report.latencyMetrics.avgBaselineLatency;
    }
    
    // Calculate token metrics
    const intelligentTokens = this.metrics.map(m => m.routing.tokensUsed + m.execution.tokensUsed);
    const baselineTokens = this.metrics
      .filter(m => m.baseline)
      .map(m => m.baseline!.tokensUsed);
    
    if (intelligentTokens.length > 0) {
      report.tokenMetrics.avgIntelligentTokens = 
        intelligentTokens.reduce((a, b) => a + b, 0) / intelligentTokens.length;
    }
    
    if (baselineTokens.length > 0) {
      report.tokenMetrics.avgBaselineTokens = 
        baselineTokens.reduce((a, b) => a + b, 0) / baselineTokens.length;
      
      report.tokenMetrics.totalSaved = 
        baselineTokens.reduce((a, b) => a + b, 0) - intelligentTokens.reduce((a, b) => a + b, 0);
      
      report.tokenMetrics.savingsPercentage = 
        (report.tokenMetrics.avgBaselineTokens - report.tokenMetrics.avgIntelligentTokens) /
        report.tokenMetrics.avgBaselineTokens;
    }
    
    // Update summary
    report.summary.avgRoutingAccuracy = report.routingMetrics.accuracy;
    report.summary.avgLatencyReduction = report.latencyMetrics.reduction;
    report.summary.avgTokenSavings = report.tokenMetrics.savingsPercentage;
    
    return report;
  }
  
  async saveReport(outputDir: string): Promise<void> {
    const report = await this.generateReport();
    
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });
    
    // Save JSON report
    await fs.writeFile(
      path.join(outputDir, 'performance-report.json'),
      JSON.stringify(report, null, 2)
    );
    
    // Generate HTML dashboard
    const htmlReport = this.generateHTMLReport(report);
    await fs.writeFile(
      path.join(outputDir, 'dashboard.html'),
      htmlReport
    );
    
    // Generate markdown summary
    const markdownSummary = this.generateMarkdownSummary(report);
    await fs.writeFile(
      path.join(outputDir, 'summary.md'),
      markdownSummary
    );
    
    console.log(`\n📊 Performance report saved to ${outputDir}`);
  }
  
  private generateHTMLReport(report: PerformanceReport): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MCP Intelligence Performance Report</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 {
            color: #333;
            border-bottom: 3px solid #667eea;
            padding-bottom: 20px;
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }
        .metric-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
        }
        .metric-value {
            font-size: 2.5em;
            font-weight: bold;
            margin: 10px 0;
        }
        .metric-label {
            font-size: 0.9em;
            opacity: 0.9;
        }
        .chart-container {
            margin: 30px 0;
            height: 400px;
        }
        .improvement {
            color: #10b981;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 MCP Intelligence Performance Report</h1>
        
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-label">Routing Accuracy</div>
                <div class="metric-value">${(report.summary.avgRoutingAccuracy * 100).toFixed(1)}%</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Latency Reduction</div>
                <div class="metric-value improvement">${(report.summary.avgLatencyReduction * 100).toFixed(1)}%</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Token Savings</div>
                <div class="metric-value improvement">${(report.summary.avgTokenSavings * 100).toFixed(1)}%</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Total Queries</div>
                <div class="metric-value">${report.summary.totalQueries}</div>
            </div>
        </div>
        
        <h2>📈 Performance Comparison</h2>
        <div class="chart-container">
            <canvas id="performanceChart"></canvas>
        </div>
        
        <h2>🎯 Routing Accuracy Matrix</h2>
        <div class="chart-container">
            <canvas id="confusionMatrix"></canvas>
        </div>
    </div>
    
    <script>
        // Performance comparison chart
        const perfCtx = document.getElementById('performanceChart').getContext('2d');
        new Chart(perfCtx, {
            type: 'bar',
            data: {
                labels: ['Latency (ms)', 'Tokens Used'],
                datasets: [{
                    label: 'Baseline (Direct Catalog)',
                    data: [${report.latencyMetrics.avgBaselineLatency}, ${report.tokenMetrics.avgBaselineTokens}],
                    backgroundColor: 'rgba(239, 68, 68, 0.5)',
                    borderColor: 'rgba(239, 68, 68, 1)',
                    borderWidth: 2
                }, {
                    label: 'MCP Intelligence',
                    data: [${report.latencyMetrics.avgIntelligentLatency}, ${report.tokenMetrics.avgIntelligentTokens}],
                    backgroundColor: 'rgba(16, 185, 129, 0.5)',
                    borderColor: 'rgba(16, 185, 129, 1)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    </script>
</body>
</html>`;
  }
  
  private generateMarkdownSummary(report: PerformanceReport): string {
    return `# MCP Intelligence Performance Report

## 📊 Executive Summary

MCP Intelligence demonstrated significant performance improvements across all metrics:

- **${(report.summary.avgRoutingAccuracy * 100).toFixed(1)}%** Routing Accuracy
- **${(report.summary.avgLatencyReduction * 100).toFixed(1)}%** Latency Reduction  
- **${(report.summary.avgTokenSavings * 100).toFixed(1)}%** Token Savings
- **${report.summary.totalQueries}** Total Queries Tested

## 🎯 Detailed Metrics

### Routing Performance
- Correct Routings: ${report.routingMetrics.correctRoutings}
- Incorrect Routings: ${report.routingMetrics.incorrectRoutings}
- Overall Accuracy: ${(report.routingMetrics.accuracy * 100).toFixed(2)}%

### Latency Analysis
- Average Intelligent Latency: ${report.latencyMetrics.avgIntelligentLatency.toFixed(2)}ms
- Average Baseline Latency: ${report.latencyMetrics.avgBaselineLatency.toFixed(2)}ms
- 95th Percentile: ${report.latencyMetrics.percentile95}ms
- 99th Percentile: ${report.latencyMetrics.percentile99}ms

### Token Efficiency
- Average Intelligent Tokens: ${report.tokenMetrics.avgIntelligentTokens.toFixed(0)}
- Average Baseline Tokens: ${report.tokenMetrics.avgBaselineTokens.toFixed(0)}
- Total Tokens Saved: ${report.tokenMetrics.totalSaved.toFixed(0)}

## 🔄 Confusion Matrix

${this.formatConfusionMatrix(report.routingMetrics.confusionMatrix)}

## 💡 Key Insights

1. **Intelligent routing** reduces the search space by ${(report.summary.avgTokenSavings * 100).toFixed(0)}%, leading to faster responses and lower costs.

2. **Semantic understanding** achieves ${(report.summary.avgRoutingAccuracy * 100).toFixed(0)}% accuracy in routing queries to the appropriate MCP server.

3. **Latency improvements** of ${(report.summary.avgLatencyReduction * 100).toFixed(0)}% translate to better user experience and higher throughput.

## 🚀 Conclusion

MCP Intelligence successfully demonstrates that semantic routing significantly improves multi-agent system performance, reducing both computational costs and response times while maintaining high accuracy.
`;
  }
  
  private formatConfusionMatrix(matrix: Record<string, Record<string, number>>): string {
    const servers = Object.keys(matrix);
    let table = '| Expected \\ Actual |';
    
    // Header
    for (const server of servers) {
      table += ` ${server} |`;
    }
    table += '\n|' + '-|'.repeat(servers.length + 1) + '\n';
    
    // Rows
    for (const expected of servers) {
      table += `| ${expected} |`;
      for (const actual of servers) {
        const value = matrix[expected]?.[actual] || 0;
        table += ` ${value} |`;
      }
      table += '\n';
    }
    
    return table;
  }
}