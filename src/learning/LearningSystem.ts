/**
 * Learning System for MCP Intelligence
 * 
 * Learns from user interactions to improve routing, 
 * suggestions, and performance over time.
 */

import { EventEmitter } from 'events';
import { 
  LearningInteraction,
  QueryPattern,
  UserFeedback,
  Intent,
  RoutingDecision 
} from '../types/intelligence';
import { Logger } from '../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

export class LearningSystem extends EventEmitter {
  private logger: Logger;
  private interactions: LearningInteraction[];
  private patterns: Map<string, QueryPattern>;
  private serverPerformance: Map<string, ServerPerformance>;
  private dataPath: string;
  private maxHistorySize: number;

  constructor(dataPath: string = './data/learning', maxHistorySize: number = 1000) {
    super();
    this.logger = new Logger('LearningSystem');
    this.interactions = [];
    this.patterns = new Map();
    this.serverPerformance = new Map();
    this.dataPath = dataPath;
    this.maxHistorySize = maxHistorySize;
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing Learning System...');
    
    // Create data directory if it doesn't exist
    try {
      await fs.mkdir(this.dataPath, { recursive: true });
    } catch (error) {
      this.logger.warn('Could not create data directory:', error);
    }

    // Load existing learning data
    await this.loadLearningData();
    
    // Start periodic analysis
    this.startPeriodicAnalysis();
    
    this.logger.info('Learning System initialized');
  }

  /**
   * Record an interaction for learning
   */
  async recordInteraction(interaction: LearningInteraction): Promise<void> {
    // Add timestamp
    interaction.timestamp = new Date();
    
    // Add to history
    this.interactions.push(interaction);
    
    // Trim history if too large
    if (this.interactions.length > this.maxHistorySize) {
      this.interactions = this.interactions.slice(-this.maxHistorySize);
    }

    // Update patterns
    this.updatePatterns(interaction);
    
    // Update server performance
    this.updateServerPerformance(interaction);
    
    // Emit event for real-time processing
    this.emit('interaction:recorded', interaction);
    
    // Save periodically (every 10 interactions)
    if (this.interactions.length % 10 === 0) {
      await this.save();
    }
  }

  /**
   * Record user feedback
   */
  async recordFeedback(
    interactionId: string,
    feedback: UserFeedback
  ): Promise<void> {
    const interaction = this.interactions.find(
      i => `${i.timestamp?.getTime()}-${i.query}` === interactionId
    );
    
    if (interaction) {
      interaction.feedback = feedback;
      
      // Learn from feedback
      if (feedback.helpful === false && feedback.correctServer) {
        // User indicated a different server would be better
        this.adjustServerPreference(
          interaction.intent,
          feedback.correctServer,
          interaction.routing.server
        );
      }
      
      await this.save();
    }
  }

  /**
   * Get frequent query patterns
   */
  async getFrequentPatterns(limit: number = 10): Promise<QueryPattern[]> {
    const patterns = Array.from(this.patterns.values());
    
    // Sort by frequency and recency
    patterns.sort((a, b) => {
      const scoreA = a.frequency * 0.7 + (1 / (Date.now() - a.lastUsed.getTime())) * 0.3;
      const scoreB = b.frequency * 0.7 + (1 / (Date.now() - b.lastUsed.getTime())) * 0.3;
      return scoreB - scoreA;
    });
    
    return patterns.slice(0, limit);
  }

  /**
   * Get server performance metrics
   */
  getServerPerformance(serverName: string): ServerPerformance | undefined {
    return this.serverPerformance.get(serverName);
  }

  /**
   * Predict best server for intent
   */
  predictBestServer(intent: Intent): string | null {
    const patternKey = this.getPatternKey(intent);
    const pattern = this.patterns.get(patternKey);
    
    if (pattern && pattern.successRate > 0.8) {
      // Find most successful server for this pattern
      const serverStats = this.getServerStatsForPattern(patternKey);
      if (serverStats.length > 0) {
        return serverStats[0].server;
      }
    }
    
    return null;
  }

  /**
   * Get optimization suggestions
   */
  getOptimizationSuggestions(): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    
    // Analyze patterns for optimization opportunities
    this.patterns.forEach((pattern, key) => {
      // Suggest caching for frequent queries
      if (pattern.frequency > 50 && pattern.avgDuration > 1000) {
        suggestions.push({
          type: 'cache',
          pattern: key,
          reason: `Pattern "${pattern.pattern}" is frequent and slow`,
          expectedImprovement: '50% faster response time'
        });
      }
      
      // Suggest alternative servers for poor performance
      if (pattern.successRate < 0.7) {
        suggestions.push({
          type: 'routing',
          pattern: key,
          reason: `Pattern "${pattern.pattern}" has low success rate`,
          expectedImprovement: 'Higher success rate'
        });
      }
    });
    
    // Analyze server performance
    this.serverPerformance.forEach((perf, server) => {
      if (perf.errorRate > 0.1) {
        suggestions.push({
          type: 'server',
          server,
          reason: `Server ${server} has high error rate (${(perf.errorRate * 100).toFixed(1)}%)`,
          expectedImprovement: 'Better reliability'
        });
      }
      
      if (perf.avgResponseTime > 3000) {
        suggestions.push({
          type: 'performance',
          server,
          reason: `Server ${server} is slow (${perf.avgResponseTime}ms average)`,
          expectedImprovement: 'Faster response times'
        });
      }
    });
    
    return suggestions;
  }

  /**
   * Update query patterns
   */
  private updatePatterns(interaction: LearningInteraction): void {
    const key = this.getPatternKey(interaction.intent);
    
    if (!this.patterns.has(key)) {
      this.patterns.set(key, {
        pattern: interaction.query,
        frequency: 0,
        avgDuration: 0,
        successRate: 0,
        lastUsed: new Date()
      });
    }
    
    const pattern = this.patterns.get(key)!;
    
    // Update frequency
    pattern.frequency++;
    
    // Update average duration
    pattern.avgDuration = 
      (pattern.avgDuration * (pattern.frequency - 1) + interaction.duration) / 
      pattern.frequency;
    
    // Update success rate
    const success = interaction.validation.isValid ? 1 : 0;
    pattern.successRate = 
      (pattern.successRate * (pattern.frequency - 1) + success) / 
      pattern.frequency;
    
    // Update last used
    pattern.lastUsed = new Date();
  }

  /**
   * Update server performance metrics
   */
  private updateServerPerformance(interaction: LearningInteraction): void {
    const server = interaction.routing.server;
    
    if (!this.serverPerformance.has(server)) {
      this.serverPerformance.set(server, {
        totalRequests: 0,
        successfulRequests: 0,
        avgResponseTime: 0,
        errorRate: 0,
        patterns: new Map()
      });
    }
    
    const perf = this.serverPerformance.get(server)!;
    
    // Update metrics
    perf.totalRequests++;
    
    if (interaction.validation.isValid) {
      perf.successfulRequests++;
    }
    
    perf.avgResponseTime = 
      (perf.avgResponseTime * (perf.totalRequests - 1) + interaction.duration) / 
      perf.totalRequests;
    
    perf.errorRate = 1 - (perf.successfulRequests / perf.totalRequests);
    
    // Track pattern performance for this server
    const patternKey = this.getPatternKey(interaction.intent);
    if (!perf.patterns.has(patternKey)) {
      perf.patterns.set(patternKey, { count: 0, successRate: 0 });
    }
    
    const patternPerf = perf.patterns.get(patternKey)!;
    patternPerf.count++;
    patternPerf.successRate = 
      (patternPerf.successRate * (patternPerf.count - 1) + (interaction.validation.isValid ? 1 : 0)) / 
      patternPerf.count;
  }

  /**
   * Adjust server preference based on feedback
   */
  private adjustServerPreference(
    intent: Intent,
    preferredServer: string,
    currentServer: string
  ): void {
    this.logger.info(`Learning: User prefers ${preferredServer} over ${currentServer} for this type of query`);
    
    // Boost performance metrics for preferred server
    const preferred = this.serverPerformance.get(preferredServer);
    if (preferred) {
      preferred.successfulRequests++;
      preferred.totalRequests++;
    }
    
    // Decrease metrics for current server
    const current = this.serverPerformance.get(currentServer);
    if (current) {
      current.errorRate = Math.min(current.errorRate + 0.1, 1);
    }
    
    this.emit('preference:learned', { intent, preferredServer, currentServer });
  }

  /**
   * Get pattern key from intent
   */
  private getPatternKey(intent: Intent): string {
    return [
      intent.action,
      ...intent.entities.map(e => e.type).sort(),
      intent.timeframe?.relative || ''
    ].filter(Boolean).join(':');
  }

  /**
   * Get server statistics for a pattern
   */
  private getServerStatsForPattern(patternKey: string): ServerPatternStats[] {
    const stats: ServerPatternStats[] = [];
    
    this.serverPerformance.forEach((perf, server) => {
      const patternPerf = perf.patterns.get(patternKey);
      if (patternPerf && patternPerf.count > 0) {
        stats.push({
          server,
          count: patternPerf.count,
          successRate: patternPerf.successRate
        });
      }
    });
    
    // Sort by success rate
    stats.sort((a, b) => b.successRate - a.successRate);
    
    return stats;
  }

  /**
   * Start periodic analysis
   */
  private startPeriodicAnalysis(): void {
    // Analyze patterns every 5 minutes
    setInterval(() => {
      this.analyzePatterns();
    }, 5 * 60 * 1000);
  }

  /**
   * Analyze patterns for insights
   */
  private analyzePatterns(): void {
    this.logger.info('Analyzing patterns...');
    
    // Find patterns that could be optimized
    const suggestions = this.getOptimizationSuggestions();
    
    if (suggestions.length > 0) {
      this.logger.info(`Found ${suggestions.length} optimization opportunities`);
      this.emit('optimizations:found', suggestions);
    }
    
    // Clean up old patterns
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    this.patterns.forEach((pattern, key) => {
      if (pattern.lastUsed.getTime() < oneWeekAgo && pattern.frequency < 5) {
        this.patterns.delete(key);
      }
    });
  }

  /**
   * Load learning data from disk
   */
  private async loadLearningData(): Promise<void> {
    try {
      const dataFile = path.join(this.dataPath, 'learning.json');
      const data = await fs.readFile(dataFile, 'utf-8');
      const parsed = JSON.parse(data);
      
      // Restore interactions
      this.interactions = parsed.interactions?.map((i: any) => ({
        ...i,
        timestamp: new Date(i.timestamp)
      })) || [];
      
      // Restore patterns
      this.patterns = new Map(Object.entries(parsed.patterns || {}));
      
      // Restore server performance
      this.serverPerformance = new Map(Object.entries(parsed.serverPerformance || {}));
      
      this.logger.info(`Loaded ${this.interactions.length} interactions and ${this.patterns.size} patterns`);
    } catch (error) {
      this.logger.warn('Could not load learning data:', error);
    }
  }

  /**
   * Save learning data to disk
   */
  async save(): Promise<void> {
    try {
      const dataFile = path.join(this.dataPath, 'learning.json');
      const data = {
        interactions: this.interactions.slice(-100), // Keep last 100 for reference
        patterns: Object.fromEntries(this.patterns),
        serverPerformance: Object.fromEntries(this.serverPerformance),
        savedAt: new Date()
      };
      
      await fs.writeFile(dataFile, JSON.stringify(data, null, 2));
      this.logger.debug('Learning data saved');
    } catch (error) {
      this.logger.error('Failed to save learning data:', error);
    }
  }
}

// Types for the learning system
interface ServerPerformance {
  totalRequests: number;
  successfulRequests: number;
  avgResponseTime: number;
  errorRate: number;
  patterns: Map<string, { count: number; successRate: number }>;
}

interface ServerPatternStats {
  server: string;
  count: number;
  successRate: number;
}

interface OptimizationSuggestion {
  type: 'cache' | 'routing' | 'server' | 'performance';
  pattern?: string;
  server?: string;
  reason: string;
  expectedImprovement: string;
}