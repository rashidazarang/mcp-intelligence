/**
 * Natural Language Processor for MCP Intelligence
 * 
 * Understands natural language queries and converts them to structured intents
 * with special support for property management terminology.
 */

import * as natural from 'natural';
import compromise from 'compromise';
import { 
  Intent, 
  IntentAction, 
  Entity, 
  Filter, 
  TimeRange,
  QueryResult,
  QueryPattern,
  NLPError 
} from '../types/intelligence';
import { Logger } from '../utils/logger';

export class NLPProcessor {
  private logger: Logger;
  private tokenizer: natural.WordTokenizer;
  private classifier: natural.BayesClassifier;
  private tfidf: natural.TfIdf;
  
  // Property management specific patterns
  private propertyPatterns = {
    entities: {
      portfolio: /\b(portfolio|property group|collection)\b/gi,
      building: /\b(building|property|complex|tower)\b/gi,
      unit: /\b(unit|apartment|suite|room)\b/gi,
      tenant: /\b(tenant|resident|occupant|lessee)\b/gi,
      work_order: /\b(work order|maintenance request|repair|ticket)\b/gi,
      lease: /\b(lease|rental agreement|contract)\b/gi,
      vendor: /\b(vendor|contractor|service provider|technician)\b/gi
    },
    priorities: {
      emergency: /\b(emergency|urgent|critical|immediate)\b/gi,
      high: /\b(high priority|important|asap)\b/gi,
      medium: /\b(medium priority|normal|standard)\b/gi,
      low: /\b(low priority|when possible|non-urgent)\b/gi
    },
    timeframes: {
      today: /\b(today|current day)\b/gi,
      yesterday: /\b(yesterday|previous day)\b/gi,
      last_week: /\b(last week|past week|previous week)\b/gi,
      this_week: /\b(this week|current week)\b/gi,
      last_month: /\b(last month|past month|previous month)\b/gi,
      this_month: /\b(this month|current month)\b/gi
    },
    actions: {
      query: /\b(show|list|get|find|search|display|view)\b/gi,
      create: /\b(create|add|new|generate|make)\b/gi,
      update: /\b(update|modify|change|edit|revise)\b/gi,
      delete: /\b(delete|remove|cancel|void)\b/gi,
      sync: /\b(sync|synchronize|align|match)\b/gi,
      analyze: /\b(analyze|examine|investigate|review)\b/gi,
      compare: /\b(compare|contrast|diff|versus)\b/gi
    }
  };

  constructor() {
    this.logger = new Logger('NLPProcessor');
    this.tokenizer = new natural.WordTokenizer();
    this.classifier = new natural.BayesClassifier();
    this.tfidf = new natural.TfIdf();
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing NLP Processor...');
    
    // Train classifier with property management examples
    this.trainClassifier();
    
    // Load domain-specific vocabulary
    this.loadDomainVocabulary();
    
    this.logger.info('NLP Processor initialized');
  }

  /**
   * Parse natural language query into structured intent
   */
  async parseIntent(query: string, context?: any): Promise<Intent> {
    this.logger.debug(`Parsing query: "${query}"`);
    
    try {
      // Normalize and tokenize
      const normalizedQuery = this.normalizeQuery(query);
      const tokens = this.tokenizer.tokenize(normalizedQuery);
      
      // Extract components
      const action = this.extractAction(normalizedQuery, tokens);
      const entities = this.extractEntities(normalizedQuery, tokens);
      const filters = this.extractFilters(normalizedQuery, tokens);
      const timeframe = this.extractTimeframe(normalizedQuery);
      
      // Calculate confidence
      const confidence = this.calculateConfidence(action, entities, filters);
      
      // Build intent
      const intent: Intent = {
        action,
        entities,
        filters,
        timeframe,
        confidence,
        context
      };
      
      this.logger.debug('Parsed intent:', intent);
      return intent;
      
    } catch (error) {
      this.logger.error('Failed to parse intent:', error);
      throw new NLPError(`Failed to parse query: ${error.message}`);
    }
  }

  /**
   * Generate suggestions based on partial query
   */
  async generateSuggestions(
    partialQuery: string,
    patterns: QueryPattern[],
    limit: number = 5
  ): Promise<string[]> {
    const suggestions: string[] = [];
    
    // Common property management queries
    const commonQueries = [
      'Show all emergency work orders',
      'List vacant units in',
      'Get maintenance requests for',
      'Show tenant information for unit',
      'Display lease renewals this month',
      'Find overdue work orders',
      'Show vendor performance report',
      'List properties with upcoming inspections'
    ];
    
    // Filter based on partial match
    const filtered = commonQueries.filter(q => 
      q.toLowerCase().includes(partialQuery.toLowerCase())
    );
    
    // Add pattern-based suggestions
    patterns.forEach(pattern => {
      if (pattern.pattern.toLowerCase().includes(partialQuery.toLowerCase())) {
        suggestions.push(pattern.pattern);
      }
    });
    
    // Combine and deduplicate
    const combined = [...new Set([...filtered, ...suggestions])];
    
    return combined.slice(0, limit);
  }

  /**
   * Generate human-readable explanation of query result
   */
  async generateExplanation(queryResult: QueryResult): Promise<string> {
    const { intent, routing, validation, duration } = queryResult;
    
    let explanation = `I understood your request as: ${this.describeIntent(intent)}. `;
    
    if (routing) {
      explanation += `I routed this to ${routing.server} using the ${routing.protocol} protocol. `;
    }
    
    if (validation && !validation.isValid) {
      explanation += `Note: There were some validation issues: ${validation.errors.join(', ')}. `;
    }
    
    if (duration) {
      explanation += `The query took ${duration}ms to complete.`;
    }
    
    return explanation;
  }

  /**
   * Extract action from query
   */
  private extractAction(query: string, tokens: string[]): IntentAction {
    // Check each action pattern
    for (const [action, pattern] of Object.entries(this.propertyPatterns.actions)) {
      if (pattern.test(query)) {
        return action as IntentAction;
      }
    }
    
    // Use classifier as fallback
    const classification = this.classifier.classify(tokens.join(' '));
    return (classification as IntentAction) || 'query';
  }

  /**
   * Extract entities from query
   */
  private extractEntities(query: string, tokens: string[]): Entity[] {
    const entities: Entity[] = [];
    
    // Check for property management entities
    for (const [type, pattern] of Object.entries(this.propertyPatterns.entities)) {
      const matches = query.match(pattern);
      if (matches) {
        matches.forEach(match => {
          // Extract the specific value (e.g., "Anderson Tower" from "building Anderson Tower")
          const valueMatch = query.match(new RegExp(`${match}\\s+([\\w\\s]+?)(?:\\s|$)`, 'i'));
          const value = valueMatch ? valueMatch[1].trim() : match;
          
          entities.push({
            type,
            value,
            role: 'subject',
            confidence: 0.8
          });
        });
      }
    }
    
    // Use NER for additional entities
    const doc = compromise(query);
    
    // Extract places (properties)
    doc.places().forEach((place: any) => {
      entities.push({
        type: 'location',
        value: place.text(),
        role: 'filter',
        confidence: 0.7
      });
    });
    
    // Extract people (tenants, vendors)
    doc.people().forEach((person: any) => {
      entities.push({
        type: 'person',
        value: person.text(),
        role: 'filter',
        confidence: 0.7
      });
    });
    
    // Extract numbers (unit numbers, amounts)
    doc.values().forEach((value: any) => {
      entities.push({
        type: 'number',
        value: value.text(),
        role: 'filter',
        confidence: 0.6
      });
    });
    
    return entities;
  }

  /**
   * Extract filters from query
   */
  private extractFilters(query: string, tokens: string[]): Filter[] {
    const filters: Filter[] = [];
    
    // Priority filters
    for (const [priority, pattern] of Object.entries(this.propertyPatterns.priorities)) {
      if (pattern.test(query)) {
        filters.push({
          field: 'priority',
          operator: 'equals',
          value: priority
        });
      }
    }
    
    // Status filters
    const statusPatterns = {
      pending: /\b(pending|waiting|queued)\b/gi,
      in_progress: /\b(in progress|working|active)\b/gi,
      completed: /\b(completed|done|finished|closed)\b/gi,
      overdue: /\b(overdue|late|past due)\b/gi
    };
    
    for (const [status, pattern] of Object.entries(statusPatterns)) {
      if (pattern.test(query)) {
        filters.push({
          field: 'status',
          operator: 'equals',
          value: status
        });
      }
    }
    
    // Comparison operators
    const comparisonPatterns = [
      { pattern: /greater than (\d+)/i, operator: 'greater_than' as const },
      { pattern: /less than (\d+)/i, operator: 'less_than' as const },
      { pattern: /equals? (\d+)/i, operator: 'equals' as const },
      { pattern: /contains? (.+)/i, operator: 'contains' as const }
    ];
    
    comparisonPatterns.forEach(({ pattern, operator }) => {
      const match = query.match(pattern);
      if (match) {
        filters.push({
          field: 'value',
          operator,
          value: match[1]
        });
      }
    });
    
    return filters;
  }

  /**
   * Extract timeframe from query
   */
  private extractTimeframe(query: string): TimeRange | undefined {
    const now = new Date();
    
    // Check relative timeframes
    for (const [period, pattern] of Object.entries(this.propertyPatterns.timeframes)) {
      if (pattern.test(query)) {
        return this.calculateTimeRange(period, now);
      }
    }
    
    // Check for date ranges
    const dateRangePattern = /from\s+(.+?)\s+to\s+(.+?)(?:\s|$)/i;
    const dateMatch = query.match(dateRangePattern);
    if (dateMatch) {
      return {
        start: new Date(dateMatch[1]),
        end: new Date(dateMatch[2])
      };
    }
    
    // Check for specific dates
    const specificDatePattern = /on\s+(.+?)(?:\s|$)/i;
    const specificMatch = query.match(specificDatePattern);
    if (specificMatch) {
      const date = new Date(specificMatch[1]);
      return {
        start: date,
        end: new Date(date.getTime() + 24 * 60 * 60 * 1000) // Next day
      };
    }
    
    return undefined;
  }

  /**
   * Calculate time range from relative period
   */
  private calculateTimeRange(period: string, now: Date): TimeRange {
    const ranges: Record<string, TimeRange> = {
      today: {
        start: new Date(now.setHours(0, 0, 0, 0)),
        end: new Date(now.setHours(23, 59, 59, 999))
      },
      yesterday: {
        start: new Date(now.setDate(now.getDate() - 1)),
        end: new Date(now.setHours(23, 59, 59, 999))
      },
      last_week: {
        start: new Date(now.setDate(now.getDate() - 7)),
        end: now
      },
      this_week: {
        start: new Date(now.setDate(now.getDate() - now.getDay())),
        end: now
      },
      last_month: {
        start: new Date(now.setMonth(now.getMonth() - 1)),
        end: now
      },
      this_month: {
        start: new Date(now.setDate(1)),
        end: now
      }
    };
    
    return ranges[period] || { relative: period };
  }

  /**
   * Calculate confidence score for parsed intent
   */
  private calculateConfidence(
    action: IntentAction,
    entities: Entity[],
    filters: Filter[]
  ): number {
    let confidence = 0.5; // Base confidence
    
    // Action confidence
    if (action) confidence += 0.2;
    
    // Entity confidence
    if (entities.length > 0) {
      const avgEntityConfidence = entities.reduce((sum, e) => sum + (e.confidence || 0), 0) / entities.length;
      confidence += avgEntityConfidence * 0.2;
    }
    
    // Filter confidence
    if (filters.length > 0) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Describe intent in human-readable format
   */
  private describeIntent(intent: Intent): string {
    const { action, entities, filters, timeframe } = intent;
    
    let description = `${action} `;
    
    if (entities.length > 0) {
      const entityDescriptions = entities.map(e => `${e.type} "${e.value}"`);
      description += entityDescriptions.join(', ') + ' ';
    }
    
    if (filters && filters.length > 0) {
      const filterDescriptions = filters.map(f => `${f.field} ${f.operator} ${f.value}`);
      description += `with filters: ${filterDescriptions.join(', ')} `;
    }
    
    if (timeframe) {
      if (timeframe.relative) {
        description += `for ${timeframe.relative}`;
      } else if (timeframe.start && timeframe.end) {
        description += `between ${timeframe.start.toLocaleDateString()} and ${timeframe.end.toLocaleDateString()}`;
      }
    }
    
    return description.trim();
  }

  /**
   * Normalize query for processing
   */
  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Train classifier with property management examples
   */
  private trainClassifier(): void {
    // Query examples
    this.classifier.addDocument('show list get find display', 'query');
    this.classifier.addDocument('what is are the show me', 'query');
    
    // Create examples
    this.classifier.addDocument('create add new make generate', 'create');
    this.classifier.addDocument('add a new create another', 'create');
    
    // Update examples
    this.classifier.addDocument('update modify change edit revise', 'update');
    this.classifier.addDocument('change the update this modify', 'update');
    
    // Delete examples
    this.classifier.addDocument('delete remove cancel void', 'delete');
    this.classifier.addDocument('remove the delete this cancel', 'delete');
    
    // Sync examples
    this.classifier.addDocument('sync synchronize align match', 'sync');
    this.classifier.addDocument('sync the data synchronize systems', 'sync');
    
    // Analyze examples
    this.classifier.addDocument('analyze examine investigate review', 'analyze');
    this.classifier.addDocument('analyze the data review performance', 'analyze');
    
    this.classifier.train();
  }

  /**
   * Load domain-specific vocabulary
   */
  private loadDomainVocabulary(): void {
    // Property management terms
    const pmTerms = [
      'portfolio', 'building', 'unit', 'tenant', 'lease', 'rent',
      'maintenance', 'work order', 'vendor', 'inspection', 'amenity',
      'deposit', 'eviction', 'renewal', 'vacancy', 'occupancy'
    ];
    
    // Add to TF-IDF for importance scoring
    pmTerms.forEach(term => {
      this.tfidf.addDocument(term);
    });
  }
}