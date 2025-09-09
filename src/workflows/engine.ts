/**
 * Workflow Engine
 * 
 * Executes predefined workflows across multiple servers
 */

import { EventEmitter } from 'events';
import { WorkflowConfig, WorkflowStep, ToolExecutionResult } from '../types';
import { Logger } from '../utils/logger';

export class WorkflowEngine extends EventEmitter {
  private workflows: Map<string, WorkflowConfig> = new Map();
  private logger: Logger;

  constructor() {
    super();
    this.logger = new Logger('WorkflowEngine');
  }

  async initialize(workflows: WorkflowConfig[] = []) {
    for (const workflow of workflows) {
      this.registerWorkflow(workflow);
    }

    // Register default workflows
    this.registerDefaultWorkflows();

    this.logger.info(`Initialized with ${this.workflows.size} workflows`);
  }

  /**
   * Register a workflow
   */
  registerWorkflow(workflow: WorkflowConfig) {
    this.workflows.set(workflow.name, workflow);
    this.logger.info(`Registered workflow: ${workflow.name}`);
  }

  /**
   * Register default workflows
   */
  private registerDefaultWorkflows() {
    // Data sync workflow
    this.registerWorkflow({
      name: 'sync_databases',
      description: 'Sync data between Airtable and Supabase',
      steps: [
        {
          name: 'fetch_from_source',
          server: 'airtable',
          tool: 'list_records',
          params: { table: '${sourceTable}' },
        },
        {
          name: 'transform_data',
          server: 'orchestrator',
          tool: 'transform',
          transform: {
            mapping: {
              'id': 'record_id',
              'name': 'title',
              'status': 'state',
            },
          },
        },
        {
          name: 'push_to_destination',
          server: 'supabase',
          tool: 'batch_insert',
          params: { table: '${destTable}' },
        },
      ],
    });

    // Backup workflow
    this.registerWorkflow({
      name: 'backup_airtable',
      description: 'Backup Airtable data to multiple destinations',
      steps: [
        {
          name: 'fetch_all_tables',
          server: 'airtable',
          tool: 'list_tables',
        },
        {
          name: 'fetch_all_data',
          server: 'airtable',
          tool: 'export_base',
        },
        {
          name: 'store_backup',
          server: 'github',
          tool: 'create_gist',
          params: { 
            filename: 'airtable_backup_${timestamp}.json',
            public: false,
          },
        },
      ],
    });
  }

  /**
   * Execute a workflow
   */
  async execute(
    workflowName: string,
    params: any = {}
  ): Promise<ToolExecutionResult> {
    const workflow = this.workflows.get(workflowName);
    
    if (!workflow) {
      return {
        success: false,
        error: `Workflow ${workflowName} not found`,
      };
    }

    this.logger.info(`Executing workflow: ${workflowName}`);
    const startTime = Date.now();
    const results: any[] = [];

    try {
      let previousResult: any = null;

      for (const step of workflow.steps) {
        this.emit('step:start', { workflow: workflowName, step: step.name });
        
        // Replace variables in params
        const stepParams = this.replaceVariables(step.params || {}, {
          ...params,
          previousResult,
          timestamp: new Date().toISOString(),
        });

        // Check condition
        if (step.condition && !this.evaluateCondition(step.condition, previousResult)) {
          this.logger.info(`Skipping step ${step.name} due to condition`);
          continue;
        }

        // Execute step (this would normally call the orchestrator)
        const result = await this.executeStep(step, stepParams, previousResult);
        
        results.push({
          step: step.name,
          result,
        });

        previousResult = result;
        
        this.emit('step:complete', { 
          workflow: workflowName, 
          step: step.name,
          result,
        });
      }

      const duration = Date.now() - startTime;
      
      return {
        success: true,
        data: {
          workflow: workflowName,
          duration,
          steps: results,
        },
      };

    } catch (error) {
      this.logger.error(`Workflow ${workflowName} failed:`, error);
      
      return {
        success: false,
        error: error.message,
        data: {
          workflow: workflowName,
          failedAt: results.length,
          partialResults: results,
        },
      };
    }
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(
    step: WorkflowStep,
    params: any,
    previousResult: any
  ): Promise<any> {
    // This would normally call back to the orchestrator
    // For now, we'll simulate the execution
    
    this.logger.info(`Executing step: ${step.name} on ${step.server}`);
    
    // Apply transformation if specified
    let data = previousResult;
    if (step.transform && previousResult) {
      data = this.transform(previousResult, step.transform);
    }

    // Simulate execution
    return {
      step: step.name,
      server: step.server,
      tool: step.tool,
      params: params || data,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Replace variables in parameters
   */
  private replaceVariables(obj: any, context: any): any {
    if (typeof obj === 'string') {
      return obj.replace(/\${(\w+)}/g, (match, key) => {
        return context[key] || match;
      });
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.replaceVariables(item, context));
    }

    if (typeof obj === 'object' && obj !== null) {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.replaceVariables(value, context);
      }
      return result;
    }

    return obj;
  }

  /**
   * Evaluate a condition
   */
  private evaluateCondition(condition: any, context: any): boolean {
    // Simple condition evaluation
    if (typeof condition === 'function') {
      return condition(context);
    }

    if (typeof condition === 'object') {
      // Check if all conditions are met
      for (const [key, value] of Object.entries(condition)) {
        if (context[key] !== value) {
          return false;
        }
      }
      return true;
    }

    return true;
  }

  /**
   * Transform data
   */
  private transform(data: any, transformConfig: any): any {
    if (transformConfig.mapping) {
      if (Array.isArray(data)) {
        return data.map(item => this.mapFields(item, transformConfig.mapping));
      }
      return this.mapFields(data, transformConfig.mapping);
    }

    return data;
  }

  /**
   * Map fields
   */
  private mapFields(item: any, mapping: Record<string, string>): any {
    const result: any = {};
    
    for (const [dest, source] of Object.entries(mapping)) {
      result[dest] = item[source];
    }
    
    return result;
  }

  /**
   * Get all workflows
   */
  getWorkflows(): WorkflowConfig[] {
    return Array.from(this.workflows.values());
  }

  /**
   * Get workflow by name
   */
  getWorkflow(name: string): WorkflowConfig | undefined {
    return this.workflows.get(name);
  }
}