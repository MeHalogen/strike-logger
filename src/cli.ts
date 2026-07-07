#!/usr/bin/env node

import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'process';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import {
  initDatabase,
  addStrike,
  getAllStrikes,
  getStatistics,
  resolveStrike,
  deleteStrike,
  findStrikeByIdPrefix,
} from './database/strike-log.js';
import {
  isGitRepo,
  getCommitDiff,
  getRecentFixCommits,
  getCombinedChanges,
  getPrimaryFile,
} from './parsers/git-parser.js';
import { categorizeByRules, suggestSeverity } from './categorizer/rules.js';
import { StrikeCategory, StrikeSeverity, SEVERITIES, Strike } from './database/schema.js';
import { generateAntiPatterns, exportAsCSV } from './templates/generator.js';
import { promptCommitStrike } from './interactive/prompter.js';
import { injectAntiPatternsIntoWorkspace } from './templates/injector.js';
import { registerPreCommitHook, unregisterPreCommitHook, checkStagedChanges } from './hooks/hook-manager.js';
import { loadConfig, getEffectiveRules, labelForCategory } from './config/config.js';
import { generateHtmlReport } from './reporting/html.js';
import { writeWorkflowFile, runCiCheck, WORKFLOW_PATH } from './ci/ci.js';

const program = new Command();

const SEVERITY_COLORS: Record<StrikeSeverity, (s: string) => string> = {
  critical: chalk.red,
  high: chalk.yellow,
  medium: chalk.blue,
  low: chalk.gray,
};

/** Prompt for a yes/no confirmation on the terminal. */
async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(chalk.cyan(`${question} [y/N]: `));
    return answer.trim().toLowerCase() === 'y';
  } finally {
    rl.close();
  }
}

program
  .name('strike-logger')
  .description('AI Code Review Strike Logger - Track and categorize AI-generated code errors')
  .version('0.3.0');

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
      console.log(chalk.gray('  • Run "strike-logger log --auto" to scan recent fix commits'));
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
  .option('-i, --interactive', 'Interactively review and select strikes to log')
  .option('-p, --path <path>', 'Database path', './data/strikes.json')
  .action(async (options) => {
    try {
      // Validate severity option up front.
      if (options.severity && !SEVERITIES.includes(options.severity)) {
        console.error(
          chalk.red(`Error: invalid severity "${options.severity}". Expected one of: ${SEVERITIES.join(', ')}`)
        );
        process.exit(1);
      }

      const isGit = await isGitRepo();
      if (!isGit) {
        console.error(chalk.red('Error: Not a git repository'));
        process.exit(1);
      }

      const config = await loadConfig();
      const rules = getEffectiveRules(config);

      if (options.auto) {
        // Auto-detect mode
        const spinner = ora('Scanning recent commits for fixes...').start();
        const fixCommits = await getRecentFixCommits(10);

        if (fixCommits.length === 0) {
          spinner.info('No fix commits found in recent history');
          return;
        }

        spinner.succeed(`Found ${fixCommits.length} fix commits.`);

        let logged = 0;
        for (const commit of fixCommits) {
          const diff = await getCommitDiff(commit);
          if (!diff) continue;

          // Categorize using the *entire* commit, not just the first file.
          const combined = getCombinedChanges(diff);
          const primary = getPrimaryFile(diff);
          const category = categorizeByRules(diff.message, combined, rules);
          const severity = suggestSeverity(category, diff.message, config.severityOverrides);

          if (options.interactive) {
            const strikeData = await promptCommitStrike(diff, category as StrikeCategory, severity);
            if (strikeData) {
              await addStrike(strikeData, options.path);
              logged++;
            }
          } else {
            await addStrike(
              {
                category,
                severity,
                source: {
                  commit,
                  file: primary?.file || 'unknown',
                  lines: [1, 1] as [number, number],
                  diff: primary?.changes || '',
                  files: diff.files.map((f) => f.file),
                },
                description: diff.message,
                tags: ['auto-detected'],
                resolved: false,
              },
              options.path
            );
            logged++;
          }
        }

        console.log(chalk.green(`\nLogged ${logged} strikes from recent commits`));
        return;
      }

      // Manual mode
      if (!options.commit) {
        console.error(chalk.red('Error: --commit is required (or use --auto)'));
        process.exit(1);
      }

      const diff = await getCommitDiff(options.commit);
      if (!diff) {
        console.error(chalk.red(`Failed to get diff for commit ${options.commit}`));
        process.exit(1);
      }

      const combined = getCombinedChanges(diff);
      const primary = getPrimaryFile(diff);
      const defaultMessage = options.message || diff.message;
      const category = options.category
        ? options.category
        : categorizeByRules(defaultMessage, combined, rules);

      const severity: StrikeSeverity =
        (options.severity as StrikeSeverity) ||
        suggestSeverity(category, defaultMessage, config.severityOverrides);

      let strikeData;
      if (options.interactive) {
        strikeData = await promptCommitStrike(diff, category as StrikeCategory, severity);
        if (!strikeData) {
          console.log(chalk.gray('Cancelled.'));
          return;
        }
      } else {
        if (!options.message) {
          console.error(chalk.red('Error: --message is required for non-interactive manual logging'));
          process.exit(1);
        }
        strikeData = {
          category,
          severity,
          source: {
            commit: options.commit,
            file: primary?.file || 'unknown',
            lines: [1, 1] as [number, number],
            diff: primary?.changes || '',
            files: diff.files.map((f) => f.file),
          },
          description: options.message,
          tags: [],
          resolved: false,
        };
      }

      const spinner = ora('Logging strike...').start();
      const strike = await addStrike(strikeData, options.path);

      spinner.succeed(chalk.green('Strike logged successfully!'));
      console.log(chalk.blue(`\nStrike ID: ${strike.id}`));
      console.log(chalk.gray(`Category: ${strike.category}`));
      console.log(chalk.gray(`Severity: ${strike.severity}\n`));
    } catch (error) {
      console.error(chalk.red('Error logging strike:'), error);
      process.exit(1);
    }
  });

/**
 * List command - List individual strikes (with ids for resolve/delete)
 */
program
  .command('list')
  .description('List logged strikes with their ids')
  .option('-p, --path <path>', 'Database path', './data/strikes.json')
  .option('-c, --category <category>', 'Filter by category')
  .option('-s, --severity <severity>', 'Filter by severity')
  .option('--open', 'Show only unresolved strikes')
  .option('--resolved', 'Show only resolved strikes')
  .option('-n, --limit <n>', 'Maximum strikes to show', '20')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    try {
      const config = await loadConfig();
      let strikes = await getAllStrikes(options.path);

      if (options.category) strikes = strikes.filter((s) => s.category === options.category);
      if (options.severity) strikes = strikes.filter((s) => s.severity === options.severity);
      if (options.open) strikes = strikes.filter((s) => !s.resolved);
      if (options.resolved) strikes = strikes.filter((s) => s.resolved);

      const limit = Math.max(0, parseInt(options.limit, 10) || 20);
      const shown = [...strikes].reverse().slice(0, limit);

      if (options.json) {
        console.log(JSON.stringify(shown, null, 2));
        return;
      }

      if (shown.length === 0) {
        console.log(chalk.gray('No strikes match the given filters.'));
        return;
      }

      console.log(chalk.bold.blue(`\n📋 Strikes (${shown.length} of ${strikes.length})\n`));
      for (const s of shown) {
        const color = SEVERITY_COLORS[s.severity] || chalk.white;
        const status = s.resolved ? chalk.green('✓ resolved') : chalk.red('● open');
        console.log(
          `${chalk.dim(s.id.substring(0, 8))}  ${color(`[${s.severity.toUpperCase()}]`)} ` +
            `${chalk.cyan(labelForCategory(config, String(s.category)))}  ${status}`
        );
        console.log(chalk.gray(`          ${(s.description || '').substring(0, 88)}`));
        console.log(
          chalk.dim(`          ${s.source.file} @ ${String(s.source.commit).substring(0, 7)}\n`)
        );
      }
      console.log(chalk.gray('Use "strike-logger resolve <id>" or "strike-logger delete <id>".\n'));
    } catch (error) {
      console.error(chalk.red('Error listing strikes:'), error);
      process.exit(1);
    }
  });

/**
 * Resolve command - Mark a strike as resolved
 */
program
  .command('resolve')
  .description('Mark a strike as resolved by id (or unambiguous id prefix)')
  .argument('<id>', 'Strike id or id prefix')
  .option('-p, --path <path>', 'Database path', './data/strikes.json')
  .action(async (id, options) => {
    try {
      const found = await resolveArg(id, options.path);
      if (!found) return;

      if (found.resolved) {
        console.log(chalk.gray(`Strike ${found.id.substring(0, 8)} is already resolved.`));
        return;
      }

      await resolveStrike(found.id, options.path);
      console.log(chalk.green(`✓ Resolved strike ${found.id.substring(0, 8)} (${found.category}).`));
    } catch (error) {
      console.error(chalk.red('Error resolving strike:'), error);
      process.exit(1);
    }
  });

/**
 * Delete command - Delete a strike
 */
program
  .command('delete')
  .alias('rm')
  .description('Delete a strike by id (or unambiguous id prefix)')
  .argument('<id>', 'Strike id or id prefix')
  .option('-y, --yes', 'Skip confirmation prompt')
  .option('-p, --path <path>', 'Database path', './data/strikes.json')
  .action(async (id, options) => {
    try {
      const found = await resolveArg(id, options.path);
      if (!found) return;

      if (!options.yes) {
        console.log(chalk.gray(`  ${found.category} — ${(found.description || '').substring(0, 70)}`));
        const ok = await confirm(`Delete strike ${found.id.substring(0, 8)}?`);
        if (!ok) {
          console.log(chalk.gray('Cancelled.'));
          return;
        }
      }

      await deleteStrike(found.id, options.path);
      console.log(chalk.green(`✓ Deleted strike ${found.id.substring(0, 8)}.`));
    } catch (error) {
      console.error(chalk.red('Error deleting strike:'), error);
      process.exit(1);
    }
  });

/**
 * Resolve a user-supplied id/prefix to a single strike, printing helpful
 * output when it is missing or ambiguous. Returns null in those cases.
 */
async function resolveArg(id: string, path: string): Promise<Strike | null> {
  const { strike, ambiguous, matches } = await findStrikeByIdPrefix(id, path);
  if (ambiguous) {
    console.error(chalk.red(`Ambiguous id "${id}" matches ${matches!.length} strikes:`));
    for (const m of matches!) {
      console.error(chalk.gray(`  ${m.id}  ${m.category}`));
    }
    process.exitCode = 1;
    return null;
  }
  if (!strike) {
    console.error(chalk.red(`No strike found with id "${id}".`));
    process.exitCode = 1;
    return null;
  }
  return strike;
}

/**
 * Report command - View strike statistics
 */
program
  .command('report')
  .description('View strike statistics and breakdown')
  .option('-p, --path <path>', 'Database path', './data/strikes.json')
  .option('--json', 'Output as JSON')
  .option('--html <file>', 'Write an HTML dashboard to a file')
  .option('--csv <file>', 'Write strikes as CSV to a file')
  .action(async (options) => {
    try {
      const config = await loadConfig();
      const stats = await getStatistics(options.path);
      const strikes = await getAllStrikes(options.path);

      if (options.html || options.csv) {
        const { writeFile } = await import('fs/promises');
        if (options.html) {
          await writeFile(options.html, generateHtmlReport(strikes, stats, config), 'utf-8');
          console.log(chalk.green(`✅ HTML report written to: ${options.html}`));
        }
        if (options.csv) {
          await writeFile(options.csv, exportAsCSV(strikes), 'utf-8');
          console.log(chalk.green(`✅ CSV written to: ${options.csv}`));
        }
        return;
      }

      if (options.json) {
        console.log(JSON.stringify({ stats, strikes }, null, 2));
        return;
      }

      const open = strikes.filter((s) => !s.resolved).length;

      console.log(chalk.bold.blue('\n📊 STRIKE REPORT\n'));
      console.log(chalk.gray(`Total Strikes: ${chalk.white(stats.totalStrikes)}  `) +
        chalk.gray(`(${chalk.white(open)} open, ${chalk.white(stats.totalStrikes - open)} resolved)`));

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
        console.log(chalk.gray(`  ${labelForCategory(config, category)}: ${count}`));
      }

      console.log(chalk.bold('\n📝 Recent Strikes:'));
      const recent = strikes.slice(-5).reverse();
      for (const strike of recent) {
        const severityColor = SEVERITY_COLORS[strike.severity] || chalk.white;
        console.log(severityColor(`  [${strike.severity.toUpperCase()}] ${labelForCategory(config, String(strike.category))}`));
        console.log(chalk.gray(`    ${strike.description.substring(0, 80)}...`));
        console.log(chalk.gray(`    Commit: ${strike.source.commit.substring(0, 7)}\n`));
      }

      console.log(chalk.gray('Tip: "strike-logger report --html report.html" for a visual dashboard.\n'));
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

/**
 * Inject command - Scan and auto-inject anti-patterns into workspace files
 */
program
  .command('inject')
  .description('Scan workspace for spec files and auto-inject anti-pattern rules')
  .option('-p, --path <path>', 'Database path', './data/strikes.json')
  .option('-d, --dir <dir>', 'Target workspace directory', process.cwd())
  .action(async (options) => {
    const spinner = ora('Scanning and injecting anti-patterns...').start();
    try {
      const strikes = await getAllStrikes(options.path);
      if (strikes.length === 0) {
        spinner.warn('No strikes found. Log some strikes first!');
        return;
      }

      const updated = await injectAntiPatternsIntoWorkspace(strikes, options.dir);
      if (updated.length > 0) {
        spinner.succeed(chalk.green(`Successfully updated/created spec files: ${updated.join(', ')}`));
      } else {
        spinner.info('No active spec files found to update.');
      }
    } catch (error) {
      spinner.fail(chalk.red('Failed to inject anti-patterns'));
      console.error(error);
      process.exit(1);
    }
  });

/**
 * Hook command - Manage or run the git pre-commit hook safeguard
 */
program
  .command('hook')
  .description('Manage or run the git pre-commit hook safeguard')
  .option('--register', 'Register pre-commit hook in local .git repository')
  .option('--unregister', 'Unregister pre-commit hook')
  .option('--check', 'Run anti-pattern checks on staged files (used by git hook)')
  .option('-p, --path <path>', 'Database path', './data/strikes.json')
  .action(async (options) => {
    try {
      if (options.register) {
        const success = await registerPreCommitHook();
        if (success) {
          console.log(chalk.green('Successfully registered pre-commit hook in .git/hooks/pre-commit'));
        } else {
          process.exit(1);
        }
        return;
      }
      if (options.unregister) {
        const success = await unregisterPreCommitHook();
        if (success) {
          console.log(chalk.green('Successfully unregistered pre-commit hook'));
        } else {
          process.exit(1);
        }
        return;
      }
      if (options.check) {
        const config = await loadConfig();
        const rules = getEffectiveRules(config);
        const clean = await checkStagedChanges(options.path, process.cwd(), rules);
        if (!clean) {
          process.exit(1);
        }
        console.log(chalk.green('✔ No recurring anti-patterns found in staged changes.'));
        return;
      }
      console.error(chalk.red('Error: Please specify --register, --unregister, or --check'));
      process.exit(1);
    } catch (error) {
      console.error(chalk.red('Hook command failed:'), error);
      process.exit(1);
    }
  });

/**
 * CI command - GitHub Actions integration
 */
program
  .command('ci')
  .description('CI/CD integration: scaffold a workflow or check a diff range')
  .option('--init', 'Write a GitHub Actions workflow file')
  .option('--check', 'Check the diff between two refs for recurring anti-patterns')
  .option('--base <ref>', 'Base ref for --check', 'origin/main')
  .option('--head <ref>', 'Head ref for --check', 'HEAD')
  .option('--force', 'Overwrite an existing workflow file on --init')
  .option('-p, --path <path>', 'Database path', './data/strikes.json')
  .action(async (options) => {
    try {
      if (options.init) {
        const written = await writeWorkflowFile(process.cwd(), options.force);
        if (written) {
          console.log(chalk.green(`✅ Wrote CI workflow: ${written}`));
          console.log(chalk.gray('  Commit data/strikes.json so CI can read your strike history.'));
        } else {
          console.log(chalk.yellow(`Workflow already exists at ${WORKFLOW_PATH}. Use --force to overwrite.`));
        }
        return;
      }

      if (options.check) {
        const config = await loadConfig();
        const rules = getEffectiveRules(config);
        const { clean } = await runCiCheck({
          base: options.base,
          head: options.head,
          dbPath: options.path,
          rules,
        });
        if (!clean) process.exit(1);
        return;
      }

      console.error(chalk.red('Error: Please specify --init or --check'));
      process.exit(1);
    } catch (error) {
      console.error(chalk.red('CI command failed:'), error);
      process.exit(1);
    }
  });

program.parse();
