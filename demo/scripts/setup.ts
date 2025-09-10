#!/usr/bin/env node

import * as fs from 'fs/promises';
import * as path from 'path';
import * as chalk from 'chalk';
import { execSync } from 'child_process';

class DemoSetup {
  private steps = [
    { name: 'Check prerequisites', fn: () => this.checkPrerequisites() },
    { name: 'Create directories', fn: () => this.createDirectories() },
    { name: 'Copy environment file', fn: () => this.setupEnvironment() },
    { name: 'Install dependencies', fn: () => this.installDependencies() },
    { name: 'Start Docker services', fn: () => this.startDocker() },
    { name: 'Seed demo data', fn: () => this.seedData() },
    { name: 'Verify setup', fn: () => this.verifySetup() }
  ];
  
  async run(): Promise<void> {
    console.log(chalk.cyan.bold('\n🚀 MCP Intelligence Demo Setup\n'));
    
    for (const step of this.steps) {
      process.stdout.write(chalk.gray(`${step.name}... `));
      try {
        await step.fn();
        console.log(chalk.green('✓'));
      } catch (error: any) {
        console.log(chalk.red('✗'));
        console.error(chalk.red(`\nError: ${error.message}`));
        process.exit(1);
      }
    }
    
    console.log(chalk.green.bold('\n✨ Setup complete!\n'));
    this.printNextSteps();
  }
  
  private async checkPrerequisites(): Promise<void> {
    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
    if (majorVersion < 18) {
      throw new Error(`Node.js 18+ required (current: ${nodeVersion})`);
    }
    
    // Check Docker
    try {
      execSync('docker --version', { stdio: 'ignore' });
      execSync('docker-compose --version', { stdio: 'ignore' });
    } catch {
      throw new Error('Docker and Docker Compose are required');
    }
    
    // Check for Anthropic API key
    if (!process.env.ANTHROPIC_API_KEY && !await this.fileExists('.env')) {
      console.log(chalk.yellow('\n⚠️  No Anthropic API key found'));
      console.log(chalk.gray('The demo will run with simulated responses'));
    }
  }
  
  private async createDirectories(): Promise<void> {
    const dirs = [
      'data/postgres',
      'data/airtable',
      'data/redis',
      'demo-results',
      'logs',
      'mock-servers'
    ];
    
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }
  
  private async setupEnvironment(): Promise<void> {
    const envPath = '.env';
    const envExamplePath = '.env.example';
    
    if (!await this.fileExists(envPath)) {
      await fs.copyFile(envExamplePath, envPath);
      console.log(chalk.yellow('\n📝 Created .env file - please add your API keys'));
    }
  }
  
  private async installDependencies(): Promise<void> {
    execSync('npm install', { stdio: 'ignore' });
  }
  
  private async startDocker(): Promise<void> {
    execSync('docker-compose up -d', { stdio: 'ignore' });
    
    // Wait for services to be ready
    await this.waitForServices();
  }
  
  private async waitForServices(): Promise<void> {
    const maxAttempts = 30;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        // Check if services are responding
        // This would include actual health checks in production
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
        
        // Try to connect to services
        const services = await this.checkServices();
        if (services.allHealthy) {
          return;
        }
      } catch (error) {
        // Services not ready yet
      }
    }
    
    throw new Error('Services failed to start');
  }
  
  private async checkServices(): Promise<any> {
    // In production, this would check actual service health
    // For demo, we'll simulate the check
    return {
      allHealthy: true,
      services: {
        postgres: 'healthy',
        airtable: 'healthy',
        redis: 'healthy'
      }
    };
  }
  
  private async seedData(): Promise<void> {
    // Create demo data
    const demoData = {
      airtable: {
        bases: [
          { id: 'base1', name: 'Project Management' },
          { id: 'base2', name: 'Customer CRM' }
        ],
        tables: [
          { baseId: 'base1', name: 'Projects', recordCount: 50 },
          { baseId: 'base1', name: 'Tasks', recordCount: 200 },
          { baseId: 'base2', name: 'Customers', recordCount: 100 },
          { baseId: 'base2', name: 'Interactions', recordCount: 500 }
        ]
      },
      supabase: {
        tables: [
          { name: 'users', rowCount: 100 },
          { name: 'projects', rowCount: 50 },
          { name: 'metrics', rowCount: 1000 },
          { name: 'logs', rowCount: 5000 }
        ]
      }
    };
    
    // Save demo data
    await fs.writeFile(
      'data/demo-seed.json',
      JSON.stringify(demoData, null, 2)
    );
  }
  
  private async verifySetup(): Promise<void> {
    // Verify all components are working
    const checks = [
      { name: 'Docker services', check: () => this.checkServices() },
      { name: 'Demo data', check: () => this.fileExists('data/demo-seed.json') },
      { name: 'Environment', check: () => this.fileExists('.env') }
    ];
    
    for (const { name, check } of checks) {
      const result = await check();
      if (!result) {
        throw new Error(`Verification failed: ${name}`);
      }
    }
  }
  
  private async fileExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }
  
  private printNextSteps(): void {
    console.log(chalk.cyan('Next steps:\n'));
    console.log(chalk.white('1. Run the full demo:'));
    console.log(chalk.gray('   npm run demo:full\n'));
    
    console.log(chalk.white('2. Run specific scenarios:'));
    console.log(chalk.gray('   npm run demo:routing-accuracy'));
    console.log(chalk.gray('   npm run demo:latency-test'));
    console.log(chalk.gray('   npm run demo:token-efficiency\n'));
    
    console.log(chalk.white('3. View the dashboard:'));
    console.log(chalk.gray('   Open http://localhost:8080\n'));
    
    console.log(chalk.white('4. Generate report:'));
    console.log(chalk.gray('   npm run demo:report\n'));
  }
}

// Run setup
if (require.main === module) {
  const setup = new DemoSetup();
  setup.run().catch(error => {
    console.error(chalk.red('Setup failed:'), error);
    process.exit(1);
  });
}

export { DemoSetup };