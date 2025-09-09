/**
 * Logger Utility
 */

import chalk from 'chalk';

export class Logger {
  constructor(private context: string) {}

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] [${this.context}] ${message}`;
  }

  debug(message: string, ...args: any[]): void {
    if (process.env.MCP_ORCHESTRATOR_LOG === 'debug') {
      console.log(chalk.gray(this.formatMessage('DEBUG', message)), ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    console.log(chalk.blue(this.formatMessage('INFO', message)), ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(chalk.yellow(this.formatMessage('WARN', message)), ...args);
  }

  error(message: string, error?: any): void {
    console.error(chalk.red(this.formatMessage('ERROR', message)));
    if (error) {
      console.error(chalk.red(error.stack || error));
    }
  }

  success(message: string): void {
    console.log(chalk.green(this.formatMessage('SUCCESS', message)));
  }
}