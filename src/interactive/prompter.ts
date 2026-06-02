import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'process';
import chalk from 'chalk';
import { StrikeCategory, StrikeSeverity } from '../database/schema.js';
import type { GitDiffInfo } from '../parsers/git-parser.js';

/**
 * Prompt the developer interactively for details of a commit strike
 */
export async function promptCommitStrike(
  diffInfo: GitDiffInfo,
  suggestedCategory: StrikeCategory,
  suggestedSeverity: StrikeSeverity
): Promise<{
  category: StrikeCategory;
  severity: StrikeSeverity;
  description: string;
  tags: string[];
  resolved: boolean;
  source: {
    commit: string;
    file: string;
    lines: [number, number];
    diff: string;
  };
} | null> {
  const rl = readline.createInterface({ input, output });

  try {
    console.log('\n' + chalk.bold.blue('─'.repeat(50)));
    console.log(chalk.bold.yellow(`Commit: ${diffInfo.commit.substring(0, 7)}`));
    console.log(chalk.gray(`Author: ${diffInfo.author}`));
    console.log(chalk.gray(`Date:   ${diffInfo.date}`));
    console.log(chalk.gray(`Message: ${diffInfo.message}`));
    console.log(chalk.bold.blue('─'.repeat(50)));

    // 1. Confirm logging
    const confirmStr = await rl.question(chalk.cyan('Log this commit as an AI strike? [y/N]: '));
    if (confirmStr.trim().toLowerCase() !== 'y') {
      console.log(chalk.gray('Skipped commit.'));
      return null;
    }

    // Optional: Show diff snippet
    const viewDiff = await rl.question(chalk.cyan('View file change diff? [y/N]: '));
    if (viewDiff.trim().toLowerCase() === 'y') {
      console.log(chalk.bold.gray('\n--- DIFF START ---'));
      const firstFile = diffInfo.files[0];
      if (firstFile && firstFile.changes) {
        console.log(firstFile.changes);
      } else {
        console.log('No diff content available.');
      }
      console.log(chalk.bold.gray('--- DIFF END ---\n'));
    }

    // 2. Select Category
    const categories = Object.values(StrikeCategory);
    console.log(chalk.bold('\n📁 Select Strike Category:'));
    categories.forEach((cat, index) => {
      const isDefault = cat === suggestedCategory ? chalk.green(' (default)') : '';
      console.log(`  [${index + 1}] ${cat}${isDefault}`);
    });

    const categoryIdxStr = await rl.question(chalk.cyan(`Choose category number [default: ${suggestedCategory}]: `));
    let selectedCategory = suggestedCategory;
    if (categoryIdxStr.trim() !== '') {
      const idx = parseInt(categoryIdxStr.trim(), 10) - 1;
      if (idx >= 0 && idx < categories.length) {
        selectedCategory = categories[idx];
      } else {
        console.log(chalk.yellow(`Invalid selection. Using default: ${suggestedCategory}`));
      }
    }

    // 3. Select Severity
    const severities: StrikeSeverity[] = ['low', 'medium', 'high', 'critical'];
    console.log(chalk.bold('\n🎯 Select Severity:'));
    severities.forEach((sev, index) => {
      const isDefault = sev === suggestedSeverity ? chalk.green(' (default)') : '';
      console.log(`  [${index + 1}] ${sev}${isDefault}`);
    });

    const severityIdxStr = await rl.question(chalk.cyan(`Choose severity number [default: ${suggestedSeverity}]: `));
    let selectedSeverity = suggestedSeverity;
    if (severityIdxStr.trim() !== '') {
      const idx = parseInt(severityIdxStr.trim(), 10) - 1;
      if (idx >= 0 && idx < severities.length) {
        selectedSeverity = severities[idx];
      } else {
        console.log(chalk.yellow(`Invalid selection. Using default: ${suggestedSeverity}`));
      }
    }

    // 4. Enter Description
    const customDesc = await rl.question(chalk.cyan(`\nEnter description/explanation [default: ${diffInfo.message}]: `));
    const finalDescription = customDesc.trim() !== '' ? customDesc.trim() : diffInfo.message;

    // 5. Enter Tags
    const tagsStr = await rl.question(chalk.cyan('\nEnter comma-separated tags (optional, e.g. "auth, frontend"): '));
    const tags = tagsStr.trim() !== '' 
      ? tagsStr.split(',').map(t => t.trim()).filter(t => t.length > 0)
      : [];

    return {
      category: selectedCategory,
      severity: selectedSeverity,
      description: finalDescription,
      tags: [...tags, 'interactive'],
      resolved: false,
      source: {
        commit: diffInfo.commit,
        file: diffInfo.files[0]?.file || 'unknown',
        lines: [1, 1] as [number, number],
        diff: diffInfo.files[0]?.changes || '',
      },
    };
  } finally {
    rl.close();
  }
}
