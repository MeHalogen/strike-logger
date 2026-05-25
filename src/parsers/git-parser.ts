import simpleGit, { SimpleGit, DiffResult } from 'simple-git';

export interface GitDiffInfo {
  commit: string;
  files: GitFileChange[];
  message: string;
  author: string;
  date: string;
}

export interface GitFileChange {
  file: string;
  changes: string;
  additions: number;
  deletions: number;
}

/**
 * Initialize git client for current directory
 */
export function initGit(repoPath: string = process.cwd()): SimpleGit {
  return simpleGit(repoPath);
}

/**
 * Check if current directory is a git repository
 */
export async function isGitRepo(repoPath: string = process.cwd()): Promise<boolean> {
  try {
    const git = initGit(repoPath);
    await git.revparse(['--git-dir']);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get diff for a specific commit
 */
export async function getCommitDiff(
  commitHash: string,
  repoPath: string = process.cwd()
): Promise<GitDiffInfo | null> {
  try {
    const git = initGit(repoPath);
    
    // Get commit details
    const log = await git.log({ from: `${commitHash}~1`, to: commitHash, maxCount: 1 });
    if (!log.latest) {
      return null;
    }

    // Get diff
    const diff = await git.diff([`${commitHash}~1`, commitHash]);
    
    // Get file stats
    const diffSummary = await git.diffSummary([`${commitHash}~1`, commitHash]);

    const files: GitFileChange[] = diffSummary.files.map((file) => ({
      file: file.file,
      changes: '', // Will be filled with specific file diff
      additions: 'insertions' in file ? file.insertions : 0,
      deletions: 'deletions' in file ? file.deletions : 0,
    }));

    // Get individual file diffs
    for (const file of files) {
      const fileDiff = await git.diff([`${commitHash}~1`, commitHash, '--', file.file]);
      file.changes = fileDiff;
    }

    return {
      commit: commitHash,
      files,
      message: log.latest.message,
      author: log.latest.author_name,
      date: log.latest.date,
    };
  } catch (error) {
    console.error(`Failed to get diff for commit ${commitHash}:`, error);
    return null;
  }
}

/**
 * Get recent commits with keywords indicating fixes/bugs
 */
export async function getRecentFixCommits(
  maxCount: number = 10,
  repoPath: string = process.cwd()
): Promise<string[]> {
  try {
    const git = initGit(repoPath);
    const log = await git.log({ maxCount: 50 });

    const fixKeywords = ['fix:', 'bug:', 'hotfix:', 'patch:', 'resolve:', 'correct:'];
    
    return log.all
      .filter((commit) => 
        fixKeywords.some((keyword) => 
          commit.message.toLowerCase().includes(keyword)
        )
      )
      .slice(0, maxCount)
      .map((commit) => commit.hash);
  } catch (error) {
    console.error('Failed to get recent fix commits:', error);
    return [];
  }
}

/**
 * Get current branch name
 */
export async function getCurrentBranch(repoPath: string = process.cwd()): Promise<string> {
  try {
    const git = initGit(repoPath);
    const branch = await git.branch();
    return branch.current;
  } catch (error) {
    console.error('Failed to get current branch:', error);
    return 'unknown';
  }
}

/**
 * Extract code snippet from diff at specific line range
 */
export function extractCodeSnippet(
  diff: string,
  startLine: number,
  endLine: number
): string {
  const lines = diff.split('\n');
  return lines.slice(startLine - 1, endLine).join('\n');
}

/**
 * Parse diff to find changed line numbers
 */
export interface DiffLineRange {
  file: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
}

export function parseDiffRanges(diff: string): DiffLineRange[] {
  const ranges: DiffLineRange[] = [];
  const lines = diff.split('\n');
  let currentFile = '';

  for (const line of lines) {
    // Match file header: diff --git a/file b/file
    if (line.startsWith('diff --git')) {
      const match = line.match(/b\/(.+)$/);
      if (match) {
        currentFile = match[1];
      }
    }
    
    // Match range header: @@ -1,5 +1,6 @@
    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
      if (match && currentFile) {
        ranges.push({
          file: currentFile,
          oldStart: parseInt(match[1]),
          oldCount: parseInt(match[2] || '1'),
          newStart: parseInt(match[3]),
          newCount: parseInt(match[4] || '1'),
        });
      }
    }
  }

  return ranges;
}
