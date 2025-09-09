/**
 * Validation Engine for MCP Intelligence
 * 
 * Validates operations, data integrity, and business rules
 * with special support for property management validations.
 */

import { 
  ValidationResult, 
  ValidationRule,
  Intent,
  RoutingDecision,
  ValidationError 
} from '../types/intelligence';
import { Logger } from '../utils/logger';

export class ValidationEngine {
  private logger: Logger;
  private rules: Map<string, ValidationRule[]>;
  private customValidators: Map<string, (data: any) => Promise<ValidationResult>>;

  constructor() {
    this.logger = new Logger('ValidationEngine');
    this.rules = new Map();
    this.customValidators = new Map();
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing Validation Engine...');
    
    // Load default validation rules
    this.loadDefaultRules();
    
    // Load property management specific rules
    this.loadPropertyManagementRules();
    
    this.logger.info('Validation Engine initialized');
  }

  /**
   * Validate an operation before execution
   */
  async validateOperation(
    routing: RoutingDecision,
    intent: Intent,
    context?: any
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check required parameters
    const paramValidation = this.validateParameters(routing.params, intent);
    errors.push(...paramValidation.errors);
    warnings.push(...(paramValidation.warnings || []));

    // Check permissions
    if (context?.currentUser) {
      const permissionValidation = this.validatePermissions(
        context.currentUser,
        intent.action,
        routing.server
      );
      errors.push(...permissionValidation.errors);
    }

    // Check business rules
    const businessRules = this.rules.get(`${routing.server}:${intent.action}`) || [];
    for (const rule of businessRules) {
      if (!rule.condition(routing.params)) {
        if (rule.severity === 'error') {
          errors.push(rule.message);
        } else if (rule.severity === 'warning') {
          warnings.push(rule.message);
        }
      }
    }

    // Run custom validators
    const customValidator = this.customValidators.get(routing.server);
    if (customValidator) {
      const customResult = await customValidator(routing.params);
      errors.push(...customResult.errors);
      warnings.push(...(customResult.warnings || []));
      suggestions.push(...(customResult.suggestions || []));
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      metadata: {
        validatedAt: new Date(),
        rulesApplied: businessRules.length,
        context
      }
    };
  }

  /**
   * Validate result after execution
   */
  async validateResult(result: any, intent: Intent): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check data integrity
    if (intent.action === 'query' && result) {
      // Validate query results
      if (Array.isArray(result)) {
        if (result.length === 0) {
          warnings.push('Query returned no results');
        }
        
        // Check for required fields in results
        result.forEach((item, index) => {
          if (!item.id && !item._id) {
            warnings.push(`Result item ${index} missing identifier`);
          }
        });
      }
    }

    // Validate data types
    if (intent.action === 'create' || intent.action === 'update') {
      if (!result || (!result.id && !result._id)) {
        errors.push('Operation did not return a valid identifier');
      }
    }

    // Property management specific validations
    if (this.isPropertyManagementData(result)) {
      const pmValidation = this.validatePropertyManagementData(result);
      errors.push(...pmValidation.errors);
      warnings.push(...(pmValidation.warnings || []));
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        resultType: Array.isArray(result) ? 'array' : typeof result,
        resultCount: Array.isArray(result) ? result.length : 1
      }
    };
  }

  /**
   * Validate parameters
   */
  private validateParameters(params: any, intent: Intent): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields based on action
    switch (intent.action) {
      case 'create':
        if (!params || Object.keys(params).length === 0) {
          errors.push('Create operation requires data');
        }
        break;
      
      case 'update':
        if (!params || !params.id) {
          errors.push('Update operation requires an ID');
        }
        break;
      
      case 'delete':
        if (!params || !params.id) {
          errors.push('Delete operation requires an ID');
        }
        break;
    }

    // Validate data types
    if (params) {
      // Check for SQL injection attempts
      const suspiciousPatterns = /(\bDROP\b|\bDELETE\b|\bUNION\b|\bSELECT\b.*\bFROM\b)/i;
      Object.values(params).forEach(value => {
        if (typeof value === 'string' && suspiciousPatterns.test(value)) {
          errors.push('Potentially malicious input detected');
        }
      });

      // Check for reasonable data sizes
      const jsonString = JSON.stringify(params);
      if (jsonString.length > 100000) {
        warnings.push('Large parameter size may affect performance');
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate permissions
   */
  private validatePermissions(user: any, action: string, server: string): ValidationResult {
    const errors: string[] = [];

    // Check role-based permissions
    const requiredPermissions: Record<string, string[]> = {
      create: ['write', 'admin'],
      update: ['write', 'admin'],
      delete: ['admin'],
      sync: ['admin'],
      query: ['read', 'write', 'admin']
    };

    const required = requiredPermissions[action] || ['admin'];
    const hasPermission = required.some(perm => 
      user.permissions?.includes(perm) || user.role === 'admin'
    );

    if (!hasPermission) {
      errors.push(`User lacks permission for ${action} operation`);
    }

    // Server-specific permissions
    if (server === 'propertyware' && user.role === 'tenant') {
      errors.push('Tenants cannot access PropertyWare directly');
    }

    return { isValid: errors.length === 0, errors, warnings: [] };
  }

  /**
   * Check if data is property management related
   */
  private isPropertyManagementData(data: any): boolean {
    if (!data) return false;
    
    const pmFields = [
      'portfolio', 'building', 'unit', 'tenant', 
      'lease', 'work_order', 'vendor', 'rent'
    ];
    
    const dataString = JSON.stringify(data).toLowerCase();
    return pmFields.some(field => dataString.includes(field));
  }

  /**
   * Validate property management specific data
   */
  private validatePropertyManagementData(data: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate work orders
    if (data.work_order || data.workOrder) {
      const wo = data.work_order || data.workOrder;
      
      if (wo.priority === 'emergency' && !wo.vendor) {
        warnings.push('Emergency work order should have a vendor assigned');
      }
      
      if (wo.status === 'completed' && !wo.completedDate) {
        errors.push('Completed work order must have a completion date');
      }
    }

    // Validate leases
    if (data.lease) {
      if (data.lease.endDate && data.lease.startDate) {
        const start = new Date(data.lease.startDate);
        const end = new Date(data.lease.endDate);
        
        if (end <= start) {
          errors.push('Lease end date must be after start date');
        }
      }
      
      if (data.lease.rentAmount && data.lease.rentAmount <= 0) {
        errors.push('Rent amount must be positive');
      }
    }

    // Validate units
    if (data.unit) {
      if (data.unit.status === 'occupied' && !data.unit.tenantId) {
        warnings.push('Occupied unit should have a tenant');
      }
      
      if (data.unit.status === 'vacant' && data.unit.tenantId) {
        errors.push('Vacant unit cannot have a tenant');
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Load default validation rules
   */
  private loadDefaultRules(): void {
    // Add general rules
    this.addRule('*', 'create', {
      id: 'require-data',
      name: 'Require data for create',
      type: 'data',
      condition: (data) => data && Object.keys(data).length > 0,
      message: 'Create operation requires data',
      severity: 'error'
    });

    this.addRule('*', 'update', {
      id: 'require-id',
      name: 'Require ID for update',
      type: 'data',
      condition: (data) => data && (data.id || data._id),
      message: 'Update operation requires an ID',
      severity: 'error'
    });
  }

  /**
   * Load property management specific rules
   */
  private loadPropertyManagementRules(): void {
    // PropertyWare rules
    this.addRule('propertyware', 'create', {
      id: 'pw-portfolio-required',
      name: 'Portfolio required',
      type: 'business',
      condition: (data) => data.portfolioId || data.portfolio,
      message: 'PropertyWare operations require a portfolio',
      severity: 'error'
    });

    // ServiceFusion rules
    this.addRule('servicefusion', 'create', {
      id: 'sf-customer-required',
      name: 'Customer required',
      type: 'business',
      condition: (data) => data.customerId || data.customer,
      message: 'ServiceFusion jobs require a customer',
      severity: 'error'
    });

    // Work order rules
    this.addRule('*', 'create', {
      id: 'wo-priority-valid',
      name: 'Valid work order priority',
      type: 'business',
      condition: (data) => {
        if (!data.work_order && !data.workOrder) return true;
        const wo = data.work_order || data.workOrder;
        const validPriorities = ['emergency', 'high', 'medium', 'low'];
        return !wo.priority || validPriorities.includes(wo.priority);
      },
      message: 'Invalid work order priority',
      severity: 'error'
    });
  }

  /**
   * Add a validation rule
   */
  addRule(server: string, action: string, rule: ValidationRule): void {
    const key = `${server}:${action}`;
    if (!this.rules.has(key)) {
      this.rules.set(key, []);
    }
    this.rules.get(key)!.push(rule);
  }

  /**
   * Register custom validator
   */
  registerValidator(server: string, validator: (data: any) => Promise<ValidationResult>): void {
    this.customValidators.set(server, validator);
    this.logger.info(`Registered custom validator for ${server}`);
  }

  /**
   * Get all rules for a server and action
   */
  getRules(server: string, action: string): ValidationRule[] {
    const specific = this.rules.get(`${server}:${action}`) || [];
    const general = this.rules.get(`*:${action}`) || [];
    return [...general, ...specific];
  }
}