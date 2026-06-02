import { existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import type { Strike } from '../database/schema.js';
import { generateAntiPatterns } from './generator.js';

interface TargetSpecFile {
  name: string;
  model: 'gpt' | 'claude' | 'copilot';
}

const SUPPORTED_SPEC_FILES: TargetSpecFile[] = [
  { name: '.cursorrules', model: 'gpt' },
  { name: '.clinespec', model: 'claude' },
  { name: '.windsurfrules', model: 'gpt' },
  { name: '.github/copilot-instructions.md', model: 'copilot' },
];

const START_TAG = '<!-- STRIKE-LOGGER-START -->';
const END_TAG = '<!-- STRIKE-LOGGER-END -->';

/**
 * Scan workspace for spec files and inject anti-patterns
 * @returns Array of file names successfully updated or created
 */
export async function injectAntiPatternsIntoWorkspace(
  strikes: Strike[],
  targetDir: string = process.cwd()
): Promise<string[]> {
  const updatedFiles: string[] = [];
  let foundAny = false;

  for (const spec of SUPPORTED_SPEC_FILES) {
    const filePath = join(targetDir, spec.name);
    if (existsSync(filePath)) {
      foundAny = true;
      const success = await injectIntoFile(filePath, strikes, spec.model);
      if (success) {
        updatedFiles.push(spec.name);
      }
    }
  }

  // Proactive feature: If no spec files exist, create a default .cursorrules file
  if (!foundAny && strikes.length > 0) {
    const defaultSpec = SUPPORTED_SPEC_FILES[0]; // .cursorrules
    const filePath = join(targetDir, defaultSpec.name);
    
    const antiPatterns = await generateAntiPatterns(strikes, defaultSpec.model);
    const content = `# Cursor Rules\n\n${START_TAG}\n${antiPatterns}\n${END_TAG}\n`;
    
    await writeFile(filePath, content, 'utf-8');
    updatedFiles.push(defaultSpec.name);
  }

  return updatedFiles;
}

/**
 * Inject anti-pattern guidelines into a single spec file
 */
async function injectIntoFile(
  filePath: string,
  strikes: Strike[],
  model: 'gpt' | 'claude' | 'copilot'
): Promise<boolean> {
  try {
    const fileContent = await readFile(filePath, 'utf-8');
    const antiPatterns = await generateAntiPatterns(strikes, model);
    const injectContent = `\n${START_TAG}\n${antiPatterns}\n${END_TAG}\n`;

    const startIdx = fileContent.indexOf(START_TAG);
    const endIdx = fileContent.indexOf(END_TAG);

    let newContent = '';
    if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
      // Replace existing block
      newContent = 
        fileContent.substring(0, startIdx) + 
        START_TAG + '\n' +
        antiPatterns + '\n' +
        fileContent.substring(endIdx);
    } else {
      // Append block at the end
      newContent = fileContent.trimEnd() + '\n\n' + injectContent;
    }

    await writeFile(filePath, newContent, 'utf-8');
    return true;
  } catch (error) {
    console.error(`Failed to inject into ${filePath}:`, error);
    return false;
  }
}
