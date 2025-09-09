/**
 * Type definitions for MCP Intelligence
 */

// Configuration
export interface MCPIntelligenceConfig {
  enabledProtocols?: {
    mcp?: boolean;
    rest?: boolean;
    soap?: boolean;
    graphql?: boolean;
    websocket?: boolean;
    lambda?: boolean;
  };
  pmipIntegration?: boolean;
  servers?: Record<string, ServerCapability>;
  learning?: {
    enabled?: boolean;
    minConfidence?: number;
    maxHistorySize?: number;
  };
  validation?: {
    enabled?: boolean;
    strict?: boolean;
  };
  cache?: {
    enabled?: boolean;
    ttl?: number;
  };
}

// Server capabilities
export interface ServerCapability {
  protocol: 'mcp' | 'rest' | 'soap' | 'graphql' | 'websocket' | 'lambda';
  package?: string;
  url?: string;
  domains: string[];
  entities: string[];
  operations: string[];
  description: string;
  auth?: {
    type: string;
    credentials?: any;
  };
  rateLimit?: {
    requests: number;
    window: number;
  };
}

// Natural Language Processing
export interface Intent {
  action: IntentAction;
  entities: Entity[];
  filters?: Filter[];
  timeframe?: TimeRange;
  aggregation?: AggregationType;
  confidence?: number;
  context?: any;
}

export type IntentAction = 
  | 'query'
  | 'create'
  | 'update'
  | 'delete'
  | 'sync'
  | 'analyze'
  | 'compare'
  | 'summarize'
  | 'validate';

export interface Entity {
  type: string;
  value: string;
  role?: 'subject' | 'object' | 'filter';
  confidence?: number;
}

export interface Filter {
  field: string;
  operator: FilterOperator;
  value: any;
}

export type FilterOperator = 
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'greater_than'
  | 'less_than'
  | 'in'
  | 'not_in';

export interface TimeRange {
  start?: Date;
  end?: Date;
  relative?: string; // "last_week", "yesterday", etc.
}

export type AggregationType = 
  | 'count'
  | 'sum'
  | 'average'
  | 'min'
  | 'max'
  | 'group_by';

// Routing
export interface RoutingDecision {
  server: string;
  tool?: string;
  params?: any;
  protocol: string;
  confidence?: number;
  alternates?: RoutingDecision[];
  reasoning?: string;
}

// Validation
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
  suggestions?: string[];
  metadata?: any;
}

export interface ValidationRule {
  id: string;
  name: string;
  type: 'business' | 'data' | 'permission' | 'integrity';
  condition: (data: any) => boolean;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

// Query Results
export interface QueryResult {
  success: boolean;
  data?: any;
  error?: string;
  intent?: Intent;
  routing?: RoutingDecision;
  validation?: ValidationResult;
  duration?: number;
  confidence?: number;
  explanation?: string;
}

// Learning System
export interface QueryPattern {
  pattern: string;
  frequency: number;
  avgDuration: number;
  successRate: number;
  lastUsed: Date;
}

export interface LearningInteraction {
  query: string;
  intent: Intent;
  routing: RoutingDecision;
  result: any;
  duration: number;
  validation: ValidationResult;
  timestamp?: Date;
  feedback?: UserFeedback;
}

export interface UserFeedback {
  helpful: boolean;
  rating?: number;
  comment?: string;
  correctServer?: string;
  correctAction?: string;
}

// Property Management Specific (PMIP)
export interface PropertyEntity {
  type: 'portfolio' | 'building' | 'unit' | 'tenant' | 'work_order' | 'lease' | 'vendor';
  id?: string;
  name?: string;
  metadata?: Record<string, any>;
}

export interface MaintenanceQuery extends Intent {
  priority?: 'emergency' | 'high' | 'medium' | 'low';
  property?: string;
  unit?: string;
  vendor?: string;
  status?: string;
}

export interface PMIPContext {
  portfolio?: string;
  currentUser?: {
    id: string;
    role: 'admin' | 'manager' | 'tenant' | 'vendor';
    permissions: string[];
  };
  activeWorkflow?: string;
  syncState?: {
    lastSync: Date;
    pendingChanges: number;
  };
}

// Server Registry
export interface ServerRegistration {
  name: string;
  capability: ServerCapability;
  status: 'active' | 'inactive' | 'error';
  lastHealthCheck?: Date;
  metrics?: {
    totalRequests: number;
    avgResponseTime: number;
    errorRate: number;
  };
}

// Cache
export interface CacheEntry {
  key: string;
  value: any;
  ttl: number;
  created: Date;
  hits: number;
}

// Errors
export class MCPIntelligenceError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'MCPIntelligenceError';
  }
}

export class ValidationError extends MCPIntelligenceError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class RoutingError extends MCPIntelligenceError {
  constructor(message: string, details?: any) {
    super(message, 'ROUTING_ERROR', details);
    this.name = 'RoutingError';
  }
}

export class NLPError extends MCPIntelligenceError {
  constructor(message: string, details?: any) {
    super(message, 'NLP_ERROR', details);
    this.name = 'NLPError';
  }
}