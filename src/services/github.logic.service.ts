import type { FastifyReply, FastifyRequest } from 'fastify';
import type {
  BootstrapBody,
  PopulateBody,
  PromoteBody,
  FetchLatestTestReportQuery,
} from '../schemas/index';
import { configuration, loggerService } from '../index';
import type {
  GitHubFileResponse,
  ITenantRequest,
  GitHubCommit,
  GitHubNewCommit,
  GitHubWorkflowRun,
  GitHubWorkflowRunsResponse,
  GitHubUnitTestStatus,
  PackageJson,
} from '../interfaces/index';
import simpleGit from 'simple-git';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

function isGitHubFileResponse(data: unknown): data is GitHubFileResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'content' in data &&
    'encoding' in data &&
    typeof (data as { content?: unknown }).content === 'string' &&
    (data as { encoding?: unknown }).encoding === 'base64'
  );
}

function isBase64Content(content: string): boolean {
  if (content.trim() === '') {
    return true;
  }

  try {
    return Buffer.from(content, 'base64').toString('base64') === content;
  } catch {
    return false;
  }
}

function toGitHubContent(content: string): string {
  return isBase64Content(content) ? content : Buffer.from(content).toString('base64');
}

const getGitHubApiConfig = (token: string): { api: string; headers: Record<string, string> } => ({
  api: configuration.GITHUB_API_URL,
  headers: {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  },
});

const getRepoName = (ruleId: string): string => ruleId;

const getTokenFromHeaders = (request: FastifyRequest): string => {
  const tenantRequest = request as ITenantRequest;

  const token = tenantRequest.tenantToken ?? '';

  if (!token) {
    throw new Error('GitHub token not found in request headers');
  }

  return token;
};

const getOrganizationFromHeaders = (request: FastifyRequest): string => {
  const tenantRequest = request as ITenantRequest;

  const organization =
    tenantRequest.organizationName ?? (request.headers.organization_name as string);

  if (!organization) {
    throw new Error('Organization name not found in request headers');
  }

  return organization;
};

const getInitBranchFromRequest = (request: FastifyRequest): string => {
  const tenantRequest = request as ITenantRequest;

  const initBranchName = tenantRequest.initBranchName ?? '';

  if (!initBranchName) {
    throw new Error('GitHub init branch not found for tenant');
  }

  return initBranchName;
};

const scrubToken = (s: string): string =>
  // eslint-disable-next-line require-unicode-regexp -- 'v' flag requires ES2024 target
  s.replace(/https:\/\/x-access-token:[^@\s]+@/g, 'https://x-access-token:***@');

const handleError = (error: unknown, reply: FastifyReply): void => {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const message = scrubToken(rawMessage);
  loggerService.error(message);
  reply.status(500).send({ success: false, message });
};

export const bootstrapHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  try {
    const token = getTokenFromHeaders(request);
    const organization = getOrganizationFromHeaders(request);
    const initBranch = getInitBranchFromRequest(request);

    const { api, headers } = getGitHubApiConfig(token);
    const { ruleId, ruleVersion } = request.body as BootstrapBody;

    const repo = getRepoName(ruleId);
    const exists = await repoExists(organization, repo, headers);

    if (exists) {
      loggerService.log(`Repository ${organization}/${repo} already exists`);
    } else {
      loggerService.log(`Repository ${organization}/${repo} does not exist`);

      const createRes = await fetch(`${api}/orgs/${organization}/repos`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: repo, private: false }),
      });

      if (!createRes.ok) {
        throw new Error(`Failed to create repo: ${await createRes.text()}`);
      }
      loggerService.log(`Created empty repository ${organization}/${repo}`);
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bootstrap-'));

      try {
        const git = simpleGit();
        const templateRepoUrl = `https://github.com/${configuration.GITHUB_TEMPLATE_OWNER}/${configuration.GITHUB_TEMPLATE_REPO}.git`;
        await git
          .env('GIT_TERMINAL_PROMPT', '0')
          .clone(templateRepoUrl, tempDir, [
            '-c',
            `http.extraheader=Authorization: bearer ${token}`,
            '--single-branch',
            '--branch',
            configuration.GITHUB_BRANCH,
          ]);
        const repoGit = simpleGit(tempDir).env('GIT_TERMINAL_PROMPT', '0');
        await repoGit.removeRemote('origin');
        const newRepoUrl = `https://github.com/${organization}/${repo}.git`;
        await repoGit.addRemote('origin', newRepoUrl);
        await repoGit.branch(['-M', initBranch]);
        await repoGit.raw([
          '-c',
          `http.extraheader=Authorization: bearer ${token}`,
          'push',
          '-u',
          'origin',
          initBranch,
        ]);
        loggerService.log(
          `Copied ${configuration.GITHUB_BRANCH} to ${organization}/${repo} as ${initBranch}`
        );
        await setDefaultBranch(organization, repo, initBranch, headers);
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    }

    await copyTemplateFiles(organization, repo, ruleVersion, initBranch, headers);

    reply.status(200).send({
      success: true,
      message: exists
        ? `Updated version to ${ruleVersion} in ${organization}/${repo} on branch ${initBranch}`
        : `Created ${organization}/${repo} v${ruleVersion} on branch ${initBranch}`,
    });
  } catch (error) {
    handleError(error, reply);
  }
};

export const populateHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  try {
    const token = getTokenFromHeaders(request);
    const organization = getOrganizationFromHeaders(request);
    const initBranch = getInitBranchFromRequest(request);

    const { api, headers } = getGitHubApiConfig(token);
    const { ruleId, ruleCode, testCode } = request.body as PopulateBody;

    const repo = getRepoName(ruleId);

    await ensureBranchFromBase(
      organization,
      repo,
      initBranch,
      configuration.GITHUB_BRANCH,
      headers
    );

    const rulePath = 'src/rule.ts';
    const testPath = '__tests__/unit/rule.test.ts';
    const encodedRuleCode = toGitHubContent(ruleCode);
    const encodedTestCode = toGitHubContent(testCode);

    const ruleFileSha = await getFileSha(organization, repo, rulePath, initBranch, headers);

    const ruleRes = await fetch(`${api}/repos/${organization}/${repo}/contents/${rulePath}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: `Update ${rulePath}`,
        content: encodedRuleCode,
        branch: initBranch,
        ...(ruleFileSha && { sha: ruleFileSha }),
      }),
    });

    if (!ruleRes.ok) {
      throw new Error(`Rule update failed: ${await ruleRes.text()}`);
    }

    const testFileSha = await getFileSha(organization, repo, testPath, initBranch, headers);

    const testRes = await fetch(`${api}/repos/${organization}/${repo}/contents/${testPath}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: `Update ${testPath}`,
        content: encodedTestCode,
        branch: initBranch,
        ...(testFileSha && { sha: testFileSha }),
      }),
    });

    if (!testRes.ok) {
      throw new Error(`Test update failed: ${await testRes.text()}`);
    }

    reply.status(200).send({
      success: true,
      message: `Populated ${organization}/${repo} on ${initBranch}`,
    });
  } catch (error) {
    handleError(error, reply);
  }
};

export const promoteHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  try {
    const token = getTokenFromHeaders(request);
    const organization = getOrganizationFromHeaders(request);
    const sourceBranch = getInitBranchFromRequest(request);

    const { api, headers } = getGitHubApiConfig(token);
    const { ruleId, branchName } = request.body as PromoteBody;

    const repo = getRepoName(ruleId);

    if (branchName === sourceBranch) {
      reply.status(200).send({
        success: true,
        message: `Branch ${branchName} is already the tenant source branch`,
      });
      return;
    }

    const baseSha = await getBranchSha(organization, repo, sourceBranch, headers);

    if (!baseSha) {
      throw new Error(`Source branch "${sourceBranch}" was not found in ${organization}/${repo}`);
    }

    const existingBranchSha = await getBranchSha(organization, repo, branchName, headers);

    if (existingBranchSha) {
      const newCommitMessage = `Sync ${branchName} with latest commit from ${sourceBranch}`;

      const latestCommitRes = await fetch(
        `${api}/repos/${organization}/${repo}/commits/${baseSha}`,
        { headers }
      );

      if (!latestCommitRes.ok) {
        throw new Error(
          `Failed to fetch the latest commit from source branch "${sourceBranch}": ${await latestCommitRes.text()}`
        );
      }

      const latestCommit = await latestCommitRes.json();
      const treeSha = (latestCommit as GitHubCommit).commit.tree.sha;

      const newCommitRes = await fetch(`${api}/repos/${organization}/${repo}/git/commits`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: newCommitMessage,
          tree: treeSha,
          parents: [existingBranchSha],
        }),
      });

      if (!newCommitRes.ok) {
        throw new Error(`Failed to create commit: ${await newCommitRes.text()}`);
      }

      const newCommit = await newCommitRes.json();
      const newCommitSha = (newCommit as GitHubNewCommit).sha;

      const updateRes = await fetch(
        `${api}/repos/${organization}/${repo}/git/refs/heads/${branchName}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ sha: newCommitSha }),
        }
      );

      if (!updateRes.ok) {
        throw new Error(`Failed to update branch reference: ${await updateRes.text()}`);
      }

      loggerService.log(
        `Synchronized branch ${branchName} with ${sourceBranch} (${baseSha}) in ${organization}/${repo}`
      );
    } else {
      const createRes = await fetch(`${api}/repos/${organization}/${repo}/git/refs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseSha }),
      });

      if (!createRes.ok) {
        throw new Error(await createRes.text());
      }

      loggerService.log(
        `Created branch ${branchName} from ${sourceBranch} (${baseSha}) in ${organization}/${repo}`
      );
    }

    reply.status(200).send({
      success: true,
      message: `Branch ${branchName} is synchronized with ${sourceBranch} (${baseSha})`,
    });
  } catch (error) {
    handleError(error, reply);
  }
};

export const fetchLatestTestReportHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  try {
    const token = getTokenFromHeaders(request);
    const organization = getOrganizationFromHeaders(request);
    const initBranch = getInitBranchFromRequest(request);

    const { api, headers } = getGitHubApiConfig(token);
    const { ruleId, branchName } = request.query as FetchLatestTestReportQuery;

    const repo = getRepoName(ruleId);
    const branch = branchName ?? initBranch;
    const filePath = configuration.GITHUB_TEST_REPORT_PATH;
    const workflowFile = 'unit-test.yml';
    const encodedBranch = encodeURIComponent(branch);

    const runsRes = await fetch(
      `${api}/repos/${organization}/${repo}/actions/workflows/${workflowFile}/runs?branch=${encodedBranch}&per_page=1`,
      { headers }
    );

    if (!runsRes.ok) {
      return await reply.status(500).send({
        success: false,
        message: 'Failed to fetch unit test workflow status',
        details: await runsRes.text(),
      });
    }

    const runsData = (await runsRes.json()) as GitHubWorkflowRunsResponse;
    const latestRun = runsData.workflow_runs.at(0);

    if (!latestRun) {
      return await reply.status(404).send({
        success: false,
        message: 'No unit test workflow run found for this branch',
      });
    }

    const { status } = normalizeUnitTestStatus(latestRun);

    if (status === 'queued' || status === 'running') {
      return await reply.status(201).send({
        success: false,
        message: `Unit tests are still ${status}. Report is not available yet.`,
      });
    }

    if (status === 'failed' || status === 'cancelled') {
      return await reply.status(422).send({
        success: false,
        message: `Unit tests ${status}. Report cannot be generated.`,
      });
    }

    if (status !== 'completed') {
      return await reply.status(404).send({
        success: false,
        message: 'Unit test report is not available',
      });
    }

    const sha = await getBranchSha(organization, repo, branch, headers);

    if (!sha) {
      return await reply.status(404).send({
        success: false,
        message: `Branch "${branch}" was not found in ${organization}/${repo}`,
      });
    }

    let fileRes: Response;

    try {
      fileRes = await fetch(
        `${api}/repos/${organization}/${repo}/contents/${filePath}?ref=${encodeURIComponent(sha)}`,
        { headers }
      );
    } catch {
      return await reply.status(500).send({
        success: false,
        message: 'Failed to communicate with GitHub API',
      });
    }

    if (fileRes.status === 404) {
      return await reply.status(404).send({
        success: false,
        message: `The test report at path "${filePath}" does not exist in ${organization}/${repo} on branch "${branch}"`,
      });
    }

    if (!fileRes.ok) {
      return await reply.status(500).send({
        success: false,
        message: 'GitHub API returned an unexpected error',
        details: await fileRes.text(),
      });
    }

    const fileData = await fileRes.json();

    if (Array.isArray(fileData)) {
      return await reply.status(400).send({
        success: false,
        message: `Expected a file but found a directory at "${filePath}"`,
      });
    }

    if (!isGitHubFileResponse(fileData)) {
      return await reply.status(500).send({
        success: false,
        message: 'Invalid file response received from GitHub API',
      });
    }

    loggerService.log(`Serving unit test report from ${organization}/${repo} (${branch})`);

    const htmlContent = Buffer.from(fileData.content, 'base64').toString('utf8');
    await reply.header('Content-Type', 'text/html').send(htmlContent);
  } catch (error) {
    handleError(error, reply);
  }
};

async function copyTemplateFiles(
  organization: string,
  repo: string,
  ruleVersion: string,
  initBranch: string,
  headers: Record<string, string>
): Promise<void> {
  const api = configuration.GITHUB_API_URL;
  const packagePath = 'package.json';

  const getRes = await fetch(
    `${api}/repos/${organization}/${repo}/contents/${packagePath}?ref=${encodeURIComponent(initBranch)}`,
    { headers }
  );

  if (!getRes.ok) {
    throw new Error(`Failed to fetch package.json: ${await getRes.text()}`);
  }

  const pkgData = (await getRes.json()) as { content: string; sha: string };

  const decoded = Buffer.from(pkgData.content, 'base64').toString('utf8');
  const pkg = JSON.parse(decoded) as PackageJson;

  pkg.name = `@${organization}/${repo}`;
  pkg.version = ruleVersion;

  const updatedContent = Buffer.from(JSON.stringify(pkg, null, 2)).toString('base64');

  const putRes = await fetch(`${api}/repos/${organization}/${repo}/contents/${packagePath}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: `Update package.json for ${repo}`,
      content: updatedContent,
      sha: pkgData.sha,
      branch: initBranch,
    }),
  });

  if (!putRes.ok) {
    throw new Error(`Failed to update package.json: ${await putRes.text()}`);
  }

  loggerService.log(`Updated package.json for ${organization}/${repo} on ${initBranch}`);
}

function normalizeUnitTestStatus(run: GitHubWorkflowRun): {
  status: GitHubUnitTestStatus;
  reportAvailable: boolean;
} {
  if (run.status === 'queued') {
    return { status: 'queued', reportAvailable: false };
  }

  if (run.status === 'in_progress') {
    return { status: 'running', reportAvailable: false };
  }

  switch (run.conclusion) {
    case 'success':
      return { status: 'completed', reportAvailable: true };
    case 'failure':
      return { status: 'failed', reportAvailable: false };
    case 'cancelled':
      return { status: 'cancelled', reportAvailable: false };
    default:
      return { status: 'not_found', reportAvailable: false };
  }
}

export const getUnitTestStatusHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  try {
    const token = getTokenFromHeaders(request);
    const organization = getOrganizationFromHeaders(request);
    const initBranch = getInitBranchFromRequest(request);

    const { api, headers } = getGitHubApiConfig(token);

    const { ruleId, branchName } = request.query as { ruleId: string; branchName?: string };

    const repo = getRepoName(ruleId);
    const branch = branchName ?? initBranch;
    const workflowFile = 'unit-test.yml';

    const res = await fetch(
      `${api}/repos/${organization}/${repo}/actions/workflows/${workflowFile}/runs?branch=${encodeURIComponent(branch)}&per_page=1`,
      { headers }
    );

    if (res.status === 404) {
      return await reply.status(404).send({
        success: false,
        message: `Workflow "${workflowFile}" not found in ${organization}/${repo}`,
      });
    }

    if (!res.ok) {
      throw new Error(await res.text());
    }

    const data = (await res.json()) as GitHubWorkflowRunsResponse;
    const latestRun = data.workflow_runs.at(0);

    loggerService.log(JSON.stringify(latestRun));

    if (!latestRun) {
      return await reply
        .status(200)
        .send({ success: true, status: 'not_found', reportAvailable: false });
    }

    const { status, reportAvailable } = normalizeUnitTestStatus(latestRun);

    await reply.status(200).send({
      success: true,
      workflow: 'Unit Tests',
      branch,
      status,
      github: {
        runNumber: latestRun.run_number,
        runUrl: latestRun.html_url,
        status: latestRun.status,
        conclusion: latestRun.conclusion,
      },
      reportAvailable,
    });
  } catch (error) {
    handleError(error, reply);
  }
};

async function getFileSha(
  org: string,
  repo: string,
  path: string,
  branch: string,
  headers: Record<string, string>
): Promise<string | undefined> {
  const res = await fetch(
    `${configuration.GITHUB_API_URL}/repos/${org}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`,
    { headers }
  );

  if (!res.ok) {
    return undefined;
  }

  const fileData = await res.json();

  if (Array.isArray(fileData)) {
    return undefined;
  }

  const { sha } = fileData as { sha: string };

  return sha;
}

async function getBranchSha(
  org: string,
  repo: string,
  branch: string,
  headers: Record<string, string>
): Promise<string | undefined> {
  const res = await fetch(
    `${configuration.GITHUB_API_URL}/repos/${org}/${repo}/git/ref/heads/${branch}`,
    { headers }
  );

  if (!res.ok) {
    return undefined;
  }

  const data = (await res.json()) as { object: { sha: string } };

  return data.object.sha;
}

async function repoExists(
  organization: string,
  repo: string,
  headers: Record<string, string>
): Promise<boolean> {
  const res = await fetch(`${configuration.GITHUB_API_URL}/repos/${organization}/${repo}`, {
    headers,
  });

  if (res.ok) {
    return true;
  }

  if (res.status === 404) {
    return false;
  }

  throw new Error(`Failed to check repository ${organization}/${repo}: ${await res.text()}`);
}

async function setDefaultBranch(
  organization: string,
  repo: string,
  branch: string,
  headers: Record<string, string>
): Promise<void> {
  const res = await fetch(`${configuration.GITHUB_API_URL}/repos/${organization}/${repo}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ default_branch: branch }),
  });

  if (!res.ok) {
    throw new Error(`Failed to set default branch: ${await res.text()}`);
  }

  loggerService.log(`Set default branch to ${branch} for ${organization}/${repo}`);
}

async function ensureBranchFromBase(
  org: string,
  repo: string,
  targetBranch: string,
  baseBranch: string,
  headers: Record<string, string>
): Promise<void> {
  if (targetBranch === baseBranch) {
    return;
  }

  const existingTargetSha = await getBranchSha(org, repo, targetBranch, headers);

  if (existingTargetSha) {
    return;
  }

  const baseSha = await getBranchSha(org, repo, baseBranch, headers);

  if (!baseSha) {
    throw new Error(`Base branch "${baseBranch}" was not found in ${org}/${repo}`);
  }

  const res = await fetch(`${configuration.GITHUB_API_URL}/repos/${org}/${repo}/git/refs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ref: `refs/heads/${targetBranch}`, sha: baseSha }),
  });

  if (!res.ok) {
    throw new Error(`Failed to create branch "${targetBranch}": ${await res.text()}`);
  }

  loggerService.log(`Created branch ${targetBranch} from ${baseBranch} in ${org}/${repo}`);
}

export const getOrganizationHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  try {
    const organization = getOrganizationFromHeaders(request);
    reply.status(200).send({ success: true, organization });
  } catch (error) {
    handleError(error, reply);
  }
};
