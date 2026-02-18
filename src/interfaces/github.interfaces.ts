export type GitHubUnitTestStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'not_found';

export interface GitHubCommit {
  sha: string;
  commit: { message: string; tree: { sha: string } };
}

export interface GitHubNewCommit {
  sha: string;
}

export interface GitHubFileResponse {
  content: string;
  encoding: 'base64';
}

export interface GitHubWorkflowRun {
  id: number;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | 'timed_out' | null;
  run_number: number;
  html_url: string;
}

export interface GitHubWorkflowRunsResponse {
  workflow_runs: GitHubWorkflowRun[];
}
