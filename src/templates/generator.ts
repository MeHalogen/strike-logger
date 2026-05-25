import type { Strike } from '../database/schema.js';

/**
 * Generate anti-pattern prompt templates from strikes
 */
export async function generateAntiPatterns(
  strikes: Strike[],
  model: string = 'gpt'
): Promise<string> {
  // Group strikes by category
  const byCategory = new Map<string, Strike[]>();
  
  for (const strike of strikes) {
    const existing = byCategory.get(strike.category) || [];
    existing.push(strike);
    byCategory.set(strike.category, existing);
  }

  // Sort categories by frequency
  const sorted = Array.from(byCategory.entries())
    .sort(([, a], [, b]) => b.length - a.length);

  // Generate template
  let template = '';
  
  template += `# AI Coding Anti-Patterns\n\n`;
  template += `Based on ${strikes.length} logged code review failures.\n`;
  template += `Generated: ${new Date().toLocaleDateString()}\n\n`;
  template += `---\n\n`;

  if (model === 'claude') {
    template += generateClaudeFormat(sorted);
  } else if (model === 'copilot') {
    template += generateCopilotFormat(sorted);
  } else {
    template += generateGPTFormat(sorted);
  }

  return template;
}

/**
 * Generate GPT-style format
 */
function generateGPTFormat(categories: [string, Strike[]][]): string {
  let output = `## Instructions for ChatGPT/GPT-4\n\n`;
  output += `When generating code, avoid these patterns that have caused review failures:\n\n`;

  for (const [category, strikes] of categories) {
    output += `### ❌ ${formatCategoryName(category)} (${strikes.length} occurrence${strikes.length > 1 ? 's' : ''})\n\n`;
    
    // Show top 3 examples
    const examples = strikes.slice(0, 3);
    for (const strike of examples) {
      output += `**What went wrong:**\n`;
      output += `${strike.description}\n\n`;
      
      if (strike.source.diff) {
        output += `**Problematic code:**\n\`\`\`\n${extractCodeSample(strike.source.diff, 10)}\`\`\`\n\n`;
      }
      
      output += `**Severity:** ${strike.severity}\n\n`;
    }
    
    output += `---\n\n`;
  }

  return output;
}

/**
 * Generate Claude-style format
 */
function generateClaudeFormat(categories: [string, Strike[]][]): string {
  let output = `## Instructions for Claude\n\n`;
  output += `<anti_patterns>\n`;
  output += `The following patterns have caused code review failures. Please avoid them:\n\n`;

  for (const [category, strikes] of categories) {
    output += `<category name="${category}" occurrences="${strikes.length}">\n`;
    
    const examples = strikes.slice(0, 2);
    for (const strike of examples) {
      output += `  <failure>\n`;
      output += `    <description>${strike.description}</description>\n`;
      output += `    <severity>${strike.severity}</severity>\n`;
      if (strike.source.diff) {
        output += `    <code_sample>${extractCodeSample(strike.source.diff, 8)}</code_sample>\n`;
      }
      output += `  </failure>\n`;
    }
    
    output += `</category>\n\n`;
  }

  output += `</anti_patterns>\n`;
  return output;
}

/**
 * Generate GitHub Copilot style format
 */
function generateCopilotFormat(categories: [string, Strike[]][]): string {
  let output = `## GitHub Copilot Anti-Patterns\n\n`;
  output += `// Add to .github/copilot-instructions.md or as inline comments\n\n`;

  for (const [category, strikes] of categories) {
    output += `// AVOID: ${formatCategoryName(category)} (${strikes.length} past failures)\n`;
    
    const examples = strikes.slice(0, 2);
    for (const strike of examples) {
      output += `// ❌ ${strike.description}\n`;
    }
    
    output += `\n`;
  }

  return output;
}

/**
 * Format category name to human-readable
 */
function formatCategoryName(category: string): string {
  return category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Extract a sample of code from diff (limit lines)
 */
function extractCodeSample(diff: string, maxLines: number): string {
  const lines = diff.split('\n')
    .filter(line => !line.startsWith('diff --git') && !line.startsWith('index '))
    .slice(0, maxLines);
  
  return lines.join('\n');
}

/**
 * Export strikes as CSV
 */
export function exportAsCSV(strikes: Strike[]): string {
  let csv = 'ID,Timestamp,Category,Severity,File,Commit,Description\n';
  
  for (const strike of strikes) {
    csv += `${strike.id},${strike.timestamp},${strike.category},${strike.severity},`;
    csv += `${strike.source.file},${strike.source.commit},"${strike.description.replace(/"/g, '""')}"\n`;
  }
  
  return csv;
}
