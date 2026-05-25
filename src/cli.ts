#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { initDatabase, addStrike, getAllStrikes, getStatistics } from './database/strike-log.js';
import { isGitRepo, getCommitDiff, getRecentFixCommits } from './parsers/git-parser.js';
import { categorizeByRules, suggestSeverity } from './categorizer/rules.js';
import { StrikeCategory } from './database/schema.js';
import { generateAntiPatterns } from './templates/generator.js';

const program = new Command();

program
  .name('strike-logger')
  .description('AI Code Review Strike Logger - Track and categorize AI-generated code errors')
  .version('0.1.0');

/**
 * Init command - Initialize strike database
 */
program
  .command('init')
  .description('Initialize strike logger in current directory')
  .option('-p, --path <path>', 'Database path', './data/strikes.json')
  .action(async (options) => {
    const spinner = ora('Initializing strike logger...').start();

    try {
      // Check if git repo
      const isGit = await isGitRepo();
      if (!isGit) {
        spinner.warn('Warning: Not a git repository. Some features may be limited.');
      }

      // Initialize database
      await initDatabase(options.path);
      
      spinner.succeed(chalk.green('Strike logger initialized successfully!'));
      console.log(chalk.blue(`\nDatabase created at: ${options.path}`));
      console.log(chalk.gray('\nNext steps:'));
      console.log(chalk.gray('  • Run "strike-logger log --commit <hash>" to log a strike'));
      console.log(chalk.gray('  • Run "strike-logger report" to view statistics'));
      console.log(chalk.gray('  • Run "strike-logger generate" to create anti-pattern templates\n'));
    } catch (error) {
      spinner.fail(chalk.red('Failed to initialize strike logger'));
      console.error(error);
      process.exit(1);
    }
  });

/**
 * Log command - Log a new strike
 */
program
  .command('log')
  .description('Log a new strike from a commit or manual entry')
  .option('--commit <hash>', 'Git commit hash')
  .option('--category <category>', 'Strike category')
  .option('--severity <severity>', 'Severity level (low|medium|high|critical)')
  .option('--message <message>', 'Description of the error')
  .option('--auto', 'Auto-detect strikes from recent fix commits')
  .option('-p, --path <path>', 'Database path', './data/strikes.json')
  .action(async (options) => {
    try {
      const isGit = await isGitRepo();
      if (!isGit) {
        console.error(chalk.red('Error: Not a git repository'));
        process.exit(1);
      }

      if (options.auto) {
        // Auto-detect mode
        const spinner = ora('Scanning recent commits for fixes...').start();
        const fixCommits = await getRecentFixCommits(10);
        
        if (fixCommits.length === 0) {
          spinner.info('No fix commits found in recent history');
          return;
        }

        spinner.text = `Found ${fixCommits.length} fix commits. Analyzing...`;
        
        let logged = 0;
        for (const commit of fixCommits) {
          const diff = await getCommitDiff(commit);
          if (!diff) continue;

          const category = categorizeByRules(diff.message, diff.files[0]?.changes);
          const severity = suggestSeverity(category, diff.message);

          await addStrike(
            {
              category,
              severity,
              source: {
                commit,
                file: diff.files[0]?.file || 'unknown',
                lines: [1, 1],
                diff: diff.files[0]?.changes || '',
              },
              description: diff.message,
              tags: ['auto-detected'],
              resolved: false,
            },
            options.path
          );
          logged++;
        }

        spinner.succeed(chalk.green(`Logged ${logged} strikes from recent commits`));
        return;
      }

      // Manual mode
      if (!options.commit || !options.message) {
        console.error(chalk.red('Error: --commit and --message are required (or use --auto)'));
        process.exit(1);
      }

      const spinner = ora('Logging strike...').start();

      const diff = await getCommitDiff(options.commit);
      if (!diff) {
        spinner.fail(chalk.red(`Failed to get diff for commit ${options.commit}`));
        process.exit(1);
      }

      const category = options.category 
        ? (options.category as StrikeCategory)
        : categorizeByRules(options.message, diff.files[0]?.changes);
      
      const severity = options.severity || suggestSeverity(category, options.message);

      const strike = await addStrike(
        {
          category,
          severity: severity as any,
          source: {
            commit: options.commit,
            file: diff.files[0]?.file || 'unknown',
            lines: [1, 1],
            diff: diff.files[0]?.changes || '',
          },
          description: options.message,
          tags: [],
          resolved: false,
        },
        options.path
      );

      spinner.succeed(chalk.green('Strike logged successfully!'));
      console.log(chalk.blue(`\nStrike ID: ${strike.id}`));
      console.log(chalk.gray(`Category: ${category}`));
      console.log(chalk.gray(`Severity: ${severity}\n`));
    } catch (error) {
      console.error(chalk.red('Error logging strike:'), error);
      process.exit(1);
    }
  });

/**
 * Report command - View strike statistics
 */
program
  .command('report')
  .description('View strike statistics and breakdown')
  .option('-p, --path <path>', 'Database path', './data/strikes.json')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    try {
      const stats = await getStatistics(options.path);
      const strikes = await getAllStrikes(options.path);

      if (options.json) {
        console.log(JSON.stringify({ stats, strikes }, null, 2));
        return;
      }

      console.log(chalk.bold.blue('\n📊 STRIKE REPORT\n'));
      console.log(chalk.gray(`Total Strikes: ${chalk.white(stats.totalStrikes)}`));
      
      console.log(chalk.bold('\n🎯 By Severity:'));
      console.log(chalk.red(`  Critical: ${stats.bySeverity.critical}`));
      console.log(chalk.yellow(`  High: ${stats.bySeverity.high}`));
      console.log(chalk.blue(`  Medium: ${stats.bySeverity.medium}`));
      console.log(chalk.gray(`  Low: ${stats.bySeverity.low}`));

      console.log(chalk.bold('\n📁 By Category:'));
      const sortedCategories = Object.entries(stats.byCategory)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);
      
      for (const [category, count] of sortedCategories) {
        console.log(chalk.gray(`  ${category}: ${count}`));
      }

      console.log(chalk.bold('\n📝 Recent Strikes:'));
      const recent = strikes.slice(-5).reverse();
      for (const strike of recent) {
        const severityColor = {
          critical: chalk.red,
          high: chalk.yellow,
          medium: chalk.blue,
          low: chalk.gray,
        }[strike.severity];
        
        console.log(severityColor(`  [${strike.severity.toUpperCase()}] ${strike.category}`));
        console.log(chalk.gray(`    ${strike.description.substring(0, 80)}...`));
        console.log(chalk.gray(`    Commit: ${strike.source.commit.substring(0, 7)}\n`));
      }

      console.log();
    } catch (error) {
      console.error(chalk.red('Error generating report:'), error);
      process.exit(1);
    }
  });

/**
 * Generate command - Generate anti-pattern templates
 */
program
  .command('generate')
  .description('Generate anti-pattern prompt templates')
  .option('-m, --model <model>', 'AI model (claude|gpt|copilot)', 'gpt')
  .option('-p, --path <path>', 'Database path', './data/strikes.json')
  .option('-o, --output <file>', 'Output file (default: stdout)')
  .action(async (options) => {
    try {
      const spinner = ora('Generating anti-pattern templates...').start();
      const strikes = await getAllStrikes(options.path);

      if (strikes.length === 0) {
        spinner.warn('No strikes found. Log some strikes first!');
        return;
      }

      const template = await generateAntiPatterns(strikes, options.model);
      spinner.succeed('Anti-pattern template generated!');

      if (options.output) {
        const { writeFile } = await import('fs/promises');
        await writeFile(options.output, template, 'utf-8');
        console.log(chalk.green(`\n✅ Template saved to: ${options.output}\n`));
      } else {
        console.log('\n' + template + '\n');
      }
    } catch (error) {
      console.error(chalk.red('Error generating template:'), error);
      process.exit(1);
    }
  });

program.parse();
