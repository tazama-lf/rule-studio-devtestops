import {
  bootstrapHandler,
  populateHandler,
  promoteHandler,
  fetchLatestTestReportHandler,
  getUnitTestStatusHandler,
} from '../../src/services/github.logic.service';
import { FastifyRequest, FastifyReply } from 'fastify';

jest.mock('@tazama-lf/frms-coe-lib', () => ({
  LoggerService: jest.fn().mockImplementation(() => ({
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

jest.mock('@tazama-lf/auth-lib', () => ({
  validateTokenAndClaims: jest.fn(),
}));

jest.mock('../../src/config', () => ({
  processorConfig: {
    ENCRYPTION_KEY: '12345678901234567890123456789012',
    ENCRYPTION_IV: '1234567890123456',
  },
}));

jest.mock('../../src/index', () => {
  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  return {
    configuration: {
      GITHUB_TEMPLATE_REPO: 'template-repo',
      GITHUB_TEMPLATE_OWNER: 'template-owner',
      GITHUB_DEFAULT_BRANCH: 'main',
      GITHUB_TEST_REPORT_PATH: 'coverage/lcov-report/index.html',
      GITHUB_API_URL: 'https://api.github.com',
      GH_TOKEN: 'test-token',
    },
    loggerService: mockLogger,
  };
});

describe('GitHub Logic Service', () => {
  let request: Partial<FastifyRequest>;
  let reply: Partial<FastifyReply>;

  beforeEach(() => {
    request = {
      headers: {
        de_gh_token: 'test-token',
        organization_name: 'test-org',
      },
      body: {
        organization: 'test-org',
        ruleId: '123',
        ruleVersion: '1.0.0',
      },
    };

    reply = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      header: jest.fn().mockReturnThis(),
    };

    global.fetch = jest.fn();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('bootstrapHandler', () => {
    it('should handle missing GitHub token', async () => {
      request.headers = {} as any;

      await bootstrapHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'GitHub token not found in request headers',
        })
      );
    });

    it('should handle missing organization name', async () => {
      request.headers = {
        de_gh_token: 'test-token',
      } as any;

      await bootstrapHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Organization name not found in request headers',
        })
      );
    });

    it('should successfully bootstrap repository', async () => {
      const mockRepoResponse = {
        ok: true,
        json: async () => ({ html_url: 'https://github.com/test-org/rule-123' }),
        text: async () => '',
      };

      const mockContentsResponse = {
        ok: true,
        json: async () => [],
      };

      const mockPackageGetResponse = {
        ok: true,
        json: async () => ({
          content: Buffer.from(JSON.stringify({ name: 'old-name', version: '0.0.1' })).toString(
            'base64'
          ),
          sha: 'abc123',
        }),
      };

      const mockPackagePutResponse = {
        ok: true,
        json: async () => ({}),
        text: async () => '',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockRepoResponse)
        .mockResolvedValueOnce(mockContentsResponse)
        .mockResolvedValueOnce(mockPackageGetResponse)
        .mockResolvedValueOnce(mockPackagePutResponse);

      await bootstrapHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          repoUrl: 'https://github.com/test-org/rule-123',
        })
      );
    });

    it('should handle errors during bootstrap', async () => {
      const mockErrorResponse = {
        ok: false,
        text: async () => 'Error',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockErrorResponse);

      await bootstrapHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });

    it('should handle non-Error exceptions', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce('String error');

      await bootstrapHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'String error',
        })
      );
    });

    it('should handle package.json get error', async () => {
      const mockRepoResponse = {
        ok: true,
        json: async () => ({ html_url: 'https://github.com/test-org/rule-123' }),
      };

      const mockContentsResponse = {
        ok: true,
        json: async () => [],
      };

      const mockPackageGetError = {
        ok: false,
        text: async () => 'Package not found',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockRepoResponse)
        .mockResolvedValueOnce(mockContentsResponse)
        .mockResolvedValueOnce(mockPackageGetError);

      await bootstrapHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });

    it('should handle package.json update error', async () => {
      const mockRepoResponse = {
        ok: true,
        json: async () => ({ html_url: 'https://github.com/test-org/rule-123' }),
      };

      const mockContentsResponse = {
        ok: true,
        json: async () => [],
      };

      const mockPackageGetResponse = {
        ok: true,
        json: async () => ({
          content: Buffer.from(JSON.stringify({ name: 'old-name', version: '0.0.1' })).toString(
            'base64'
          ),
          sha: 'abc123',
        }),
      };

      const mockPackagePutError = {
        ok: false,
        text: async () => 'Update failed',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockRepoResponse)
        .mockResolvedValueOnce(mockContentsResponse)
        .mockResolvedValueOnce(mockPackageGetResponse)
        .mockResolvedValueOnce(mockPackagePutError);

      await bootstrapHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });

    it('should handle repository content retry', async () => {
      const mockRepoResponse = {
        ok: true,
        json: async () => ({ html_url: 'https://github.com/test-org/rule-123' }),
        text: async () => '',
      };

      const mockContentsErrorResponse = {
        ok: false,
      };

      const mockContentsSuccessResponse = {
        ok: true,
        json: async () => [],
      };

      const mockPackageGetResponse = {
        ok: true,
        json: async () => ({
          content: Buffer.from(JSON.stringify({ name: 'old-name', version: '0.0.1' })).toString(
            'base64'
          ),
          sha: 'abc123',
        }),
      };

      const mockPackagePutResponse = {
        ok: true,
        json: async () => ({}),
        text: async () => '',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockRepoResponse)
        .mockResolvedValueOnce(mockContentsErrorResponse)
        .mockResolvedValueOnce(mockContentsSuccessResponse)
        .mockResolvedValueOnce(mockPackageGetResponse)
        .mockResolvedValueOnce(mockPackagePutResponse);

      await bootstrapHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
    });

    it('should handle repository content timeout', async () => {
      const mockRepoResponse = {
        ok: true,
        json: async () => ({ html_url: 'https://github.com/test-org/rule-123' }),
        text: async () => '',
      };

      const mockContentsErrorResponse = {
        ok: false,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockRepoResponse);

      for (let i = 0; i < 20; i++) {
        (global.fetch as jest.Mock).mockResolvedValueOnce(mockContentsErrorResponse);
      }

      await bootstrapHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    }, 20000);
  });

  describe('populateHandler', () => {
    beforeEach(() => {
      request.body = {
        organization: 'test-org',
        ruleId: '123',
        ruleCode: Buffer.from('rule code').toString('base64'),
        testCode: Buffer.from('test code').toString('base64'),
      };
    });

    it('should handle missing GitHub token', async () => {
      request.headers = {} as any;

      await populateHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'GitHub token not found in request headers',
        })
      );
    });

    it('should handle missing organization name', async () => {
      request.headers = {
        de_gh_token: 'test-token',
      } as any;

      await populateHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Organization name not found in request headers',
        })
      );
    });

    it('should successfully populate files', async () => {
      const mockGetRuleResponse = {
        ok: true,
        json: async () => ({ sha: 'rule-sha' }),
      };

      const mockGetTestResponse = {
        ok: true,
        json: async () => ({ sha: 'test-sha' }),
      };

      const mockPutRuleResponse = {
        ok: true,
        json: async () => ({}),
      };

      const mockPutTestResponse = {
        ok: true,
        json: async () => ({}),
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockGetRuleResponse)
        .mockResolvedValueOnce(mockPutRuleResponse)
        .mockResolvedValueOnce(mockGetTestResponse)
        .mockResolvedValueOnce(mockPutTestResponse);

      await populateHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
    });

    it('should handle missing file sha', async () => {
      const mockGetRuleError = {
        ok: false,
      };

      const mockPutRuleResponse = {
        ok: true,
        json: async () => ({}),
      };

      const mockGetTestError = {
        ok: false,
      };

      const mockPutTestResponse = {
        ok: true,
        json: async () => ({}),
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockGetRuleError)
        .mockResolvedValueOnce(mockPutRuleResponse)
        .mockResolvedValueOnce(mockGetTestError)
        .mockResolvedValueOnce(mockPutTestResponse);

      await populateHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
    });

    it('should handle populate errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Update failed'));

      await populateHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });

    it('should handle rule file update error', async () => {
      const mockGetRuleResponse = {
        ok: true,
        json: async () => ({ sha: 'rule-sha' }),
      };

      const mockPutRuleError = {
        ok: false,
        status: 422,
        text: async () => 'Rule update failed',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockGetRuleResponse)
        .mockResolvedValueOnce(mockPutRuleError);

      await populateHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });

    it('should handle test file update error', async () => {
      const mockGetRuleResponse = {
        ok: true,
        json: async () => ({ sha: 'rule-sha' }),
      };

      const mockPutRuleResponse = {
        ok: true,
        json: async () => ({}),
      };

      const mockGetTestResponse = {
        ok: true,
        json: async () => ({ sha: 'test-sha' }),
      };

      const mockPutTestError = {
        ok: false,
        status: 422,
        text: async () => 'Test update failed',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockGetRuleResponse)
        .mockResolvedValueOnce(mockPutRuleResponse)
        .mockResolvedValueOnce(mockGetTestResponse)
        .mockResolvedValueOnce(mockPutTestError);

      await populateHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });
  });

  describe('promoteHandler', () => {
    beforeEach(() => {
      request.body = {
        organization: 'test-org',
        ruleId: '123',
        branchName: 'feature-branch',
      };
    });

    it('should handle missing GitHub token', async () => {
      request.headers = {} as any;

      await promoteHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'GitHub token not found in request headers',
        })
      );
    });

    it('should handle missing organization name', async () => {
      request.headers = {
        de_gh_token: 'test-token',
      } as any;

      await promoteHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Organization name not found in request headers',
        })
      );
    });

    it('should create new branch from default', async () => {
      const mockGetDefaultBranchResponse = {
        ok: true,
        json: async () => ({
          object: {
            sha: 'default-sha',
          },
        }),
      };

      const mockGetFeatureBranchNotFound = {
        ok: false,
      };

      const mockCreateBranchResponse = {
        ok: true,
        json: async () => ({}),
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockGetDefaultBranchResponse)
        .mockResolvedValueOnce(mockGetFeatureBranchNotFound)
        .mockResolvedValueOnce(mockCreateBranchResponse);

      await promoteHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
    });

    it('should sync existing branch with default', async () => {
      const mockGetDefaultBranchResponse = {
        ok: true,
        json: async () => ({
          object: {
            sha: 'default-sha',
          },
        }),
      };

      const mockGetExistingBranchResponse = {
        ok: true,
        json: async () => ({
          object: {
            sha: 'existing-branch-sha',
          },
        }),
      };

      const mockLatestCommitResponse = {
        ok: true,
        json: async () => ({
          commit: {
            tree: {
              sha: 'tree-sha',
            },
          },
        }),
      };

      const mockNewCommitResponse = {
        ok: true,
        json: async () => ({
          sha: 'new-commit-sha',
        }),
      };

      const mockUpdateBranchResponse = {
        ok: true,
        json: async () => ({}),
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockGetDefaultBranchResponse)
        .mockResolvedValueOnce(mockGetExistingBranchResponse)
        .mockResolvedValueOnce(mockLatestCommitResponse)
        .mockResolvedValueOnce(mockNewCommitResponse)
        .mockResolvedValueOnce(mockUpdateBranchResponse);

      await promoteHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
    });

    it('should handle promote errors', async () => {
      const mockGetDefaultBranchError = {
        ok: false,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockGetDefaultBranchError);

      await promoteHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });

    it('should handle branch creation error', async () => {
      const mockDefaultBranchResponse = {
        ok: true,
        json: async () => ({
          object: { sha: 'default-sha' },
        }),
      };

      const mockBranchResponse = {
        ok: false,
        status: 404,
      };

      const mockCreateError = {
        ok: false,
        status: 422,
        text: async () => 'Branch creation failed',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockDefaultBranchResponse)
        .mockResolvedValueOnce(mockBranchResponse)
        .mockResolvedValueOnce(mockCreateError);

      await promoteHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });

    it('should handle latest commit fetch error', async () => {
      const mockDefaultBranchResponse = {
        ok: true,
        json: async () => ({
          object: { sha: 'default-sha' },
        }),
      };

      const mockBranchResponse = {
        ok: true,
        json: async () => ({
          object: { sha: 'branch-sha' },
        }),
      };

      const mockCommitError = {
        ok: false,
        status: 404,
        text: async () => 'Commit not found',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockDefaultBranchResponse)
        .mockResolvedValueOnce(mockBranchResponse)
        .mockResolvedValueOnce(mockCommitError);

      await promoteHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });

    it('should handle new commit creation error', async () => {
      const mockDefaultBranchResponse = {
        ok: true,
        json: async () => ({
          object: { sha: 'default-sha' },
        }),
      };

      const mockBranchResponse = {
        ok: true,
        json: async () => ({
          object: { sha: 'branch-sha' },
        }),
      };

      const mockCommitResponse = {
        ok: true,
        json: async () => ({
          commit: {
            tree: {
              sha: 'tree-sha',
            },
          },
        }),
      };

      const mockNewCommitError = {
        ok: false,
        status: 422,
        text: async () => 'Commit creation failed',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockDefaultBranchResponse)
        .mockResolvedValueOnce(mockBranchResponse)
        .mockResolvedValueOnce(mockCommitResponse)
        .mockResolvedValueOnce(mockNewCommitError);

      await promoteHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });

    it('should handle branch update error', async () => {
      const mockDefaultBranchResponse = {
        ok: true,
        json: async () => ({
          object: { sha: 'default-sha' },
        }),
      };

      const mockBranchResponse = {
        ok: true,
        json: async () => ({
          object: { sha: 'branch-sha' },
        }),
      };

      const mockCommitResponse = {
        ok: true,
        json: async () => ({
          commit: {
            tree: {
              sha: 'tree-sha',
            },
          },
        }),
      };

      const mockNewCommitResponse = {
        ok: true,
        json: async () => ({
          sha: 'new-commit-sha',
        }),
      };

      const mockBranchUpdateError = {
        ok: false,
        status: 422,
        text: async () => 'Branch update failed',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockDefaultBranchResponse)
        .mockResolvedValueOnce(mockBranchResponse)
        .mockResolvedValueOnce(mockCommitResponse)
        .mockResolvedValueOnce(mockNewCommitResponse)
        .mockResolvedValueOnce(mockBranchUpdateError);

      await promoteHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });
  });

  describe('fetchLatestTestReportHandler', () => {
    beforeEach(() => {
      request.query = {
        organization: 'test-org',
        ruleId: '123',
      } as any;
    });

    it('should handle missing GitHub token', async () => {
      request.headers = {} as any;

      await fetchLatestTestReportHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'GitHub token not found in request headers',
        })
      );
    });

    it('should handle missing organization name', async () => {
      request.headers = {
        de_gh_token: 'test-token',
      } as any;

      await fetchLatestTestReportHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Organization name not found in request headers',
        })
      );
    });

    it('should successfully fetch test report', async () => {
      const mockWorkflowRunsResponse = {
        ok: true,
        json: async () => ({
          workflow_runs: [
            {
              id: 12345,
              status: 'completed',
              conclusion: 'success',
            },
          ],
        }),
      };

      const mockBranchResponse = {
        ok: true,
        json: async () => ({
          object: {
            sha: 'branch-sha',
          },
        }),
      };

      const mockFileResponse = {
        ok: true,
        json: async () => ({
          content: Buffer.from('<html>Test Report</html>').toString('base64'),
          encoding: 'base64',
        }),
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockWorkflowRunsResponse)
        .mockResolvedValueOnce(mockBranchResponse)
        .mockResolvedValueOnce(mockFileResponse);

      await fetchLatestTestReportHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.header).toHaveBeenCalledWith('Content-Type', 'text/html');
      expect(reply.send).toHaveBeenCalledWith('<html>Test Report</html>');
    });

    it('should successfully fetch test report with branch name', async () => {
      request.query = {
        organization: 'test-org',
        ruleId: '123',
        branchName: 'feature',
      } as any;

      const mockWorkflowRunsResponse = {
        ok: true,
        json: async () => ({
          workflow_runs: [
            {
              id: 12345,
              status: 'completed',
              conclusion: 'success',
            },
          ],
        }),
      };

      const mockBranchResponse = {
        ok: true,
        json: async () => ({
          object: {
            sha: 'branch-sha',
          },
        }),
      };

      const mockFileResponse = {
        ok: true,
        json: async () => ({
          content: Buffer.from('<html>Test Report</html>').toString('base64'),
          encoding: 'base64',
        }),
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockWorkflowRunsResponse)
        .mockResolvedValueOnce(mockBranchResponse)
        .mockResolvedValueOnce(mockFileResponse);

      await fetchLatestTestReportHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.header).toHaveBeenCalledWith('Content-Type', 'text/html');
      expect(reply.send).toHaveBeenCalledWith('<html>Test Report</html>');
    });

    it('should handle workflow fetch error', async () => {
      const mockErrorResponse = {
        ok: false,
        text: async () => 'Error',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockErrorResponse);

      await fetchLatestTestReportHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });

    it('should handle no workflow runs', async () => {
      const mockWorkflowRunsResponse = {
        ok: true,
        json: async () => ({
          workflow_runs: [],
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockWorkflowRunsResponse);

      await fetchLatestTestReportHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });

    it('should handle running workflow', async () => {
      const mockWorkflowRunsResponse = {
        ok: true,
        json: async () => ({
          workflow_runs: [
            {
              id: 12345,
              status: 'in_progress',
              conclusion: null,
            },
          ],
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockWorkflowRunsResponse);

      await fetchLatestTestReportHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(201);
    });

    it('should handle queued workflow', async () => {
      const mockWorkflowRunsResponse = {
        ok: true,
        json: async () => ({
          workflow_runs: [
            {
              id: 12345,
              status: 'queued',
              conclusion: null,
            },
          ],
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockWorkflowRunsResponse);

      await fetchLatestTestReportHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(201);
    });

    it('should handle cancelled workflow', async () => {
      const mockWorkflowRunsResponse = {
        ok: true,
        json: async () => ({
          workflow_runs: [
            {
              id: 12345,
              status: 'completed',
              conclusion: 'cancelled',
            },
          ],
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockWorkflowRunsResponse);

      await fetchLatestTestReportHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(422);
    });

    it('should handle failed workflow', async () => {
      const mockWorkflowRunsResponse = {
        ok: true,
        json: async () => ({
          workflow_runs: [
            {
              id: 12345,
              status: 'completed',
              conclusion: 'failure',
            },
          ],
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockWorkflowRunsResponse);

      await fetchLatestTestReportHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(422);
    });

    it('should handle unknown workflow status', async () => {
      const mockWorkflowRunsResponse = {
        ok: true,
        json: async () => ({
          workflow_runs: [
            {
              id: 12345,
              status: 'completed',
              conclusion: 'timed_out',
            },
          ],
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockWorkflowRunsResponse);

      await fetchLatestTestReportHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });

    it('should handle branch not found', async () => {
      const mockWorkflowRunsResponse = {
        ok: true,
        json: async () => ({
          workflow_runs: [
            {
              id: 12345,
              status: 'completed',
              conclusion: 'success',
            },
          ],
        }),
      };

      const mockBranchError = {
        ok: false,
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockWorkflowRunsResponse)
        .mockResolvedValueOnce(mockBranchError);

      await fetchLatestTestReportHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });

    it('should handle file not found', async () => {
      const mockWorkflowRunsResponse = {
        ok: true,
        json: async () => ({
          workflow_runs: [
            {
              id: 12345,
              status: 'completed',
              conclusion: 'success',
            },
          ],
        }),
      };

      const mockBranchResponse = {
        ok: true,
        json: async () => ({
          object: {
            sha: 'branch-sha',
          },
        }),
      };

      const mockFileNotFound = {
        ok: false,
        status: 404,
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockWorkflowRunsResponse)
        .mockResolvedValueOnce(mockBranchResponse)
        .mockResolvedValueOnce(mockFileNotFound);

      await fetchLatestTestReportHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });

    it('should handle file fetch error', async () => {
      const mockWorkflowRunsResponse = {
        ok: true,
        json: async () => ({
          workflow_runs: [
            {
              id: 12345,
              status: 'completed',
              conclusion: 'success',
            },
          ],
        }),
      };

      const mockBranchResponse = {
        ok: true,
        json: async () => ({
          object: {
            sha: 'branch-sha',
          },
        }),
      };

      const mockFileError = {
        ok: false,
        status: 500,
        text: async () => 'Server error',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockWorkflowRunsResponse)
        .mockResolvedValueOnce(mockBranchResponse)
        .mockResolvedValueOnce(mockFileError);

      await fetchLatestTestReportHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });

    it('should handle directory instead of file', async () => {
      const mockWorkflowRunsResponse = {
        ok: true,
        json: async () => ({
          workflow_runs: [
            {
              id: 12345,
              status: 'completed',
              conclusion: 'success',
            },
          ],
        }),
      };

      const mockBranchResponse = {
        ok: true,
        json: async () => ({
          object: {
            sha: 'branch-sha',
          },
        }),
      };

      const mockDirectoryResponse = {
        ok: true,
        json: async () => [],
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockWorkflowRunsResponse)
        .mockResolvedValueOnce(mockBranchResponse)
        .mockResolvedValueOnce(mockDirectoryResponse);

      await fetchLatestTestReportHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it('should handle invalid file response', async () => {
      const mockWorkflowRunsResponse = {
        ok: true,
        json: async () => ({
          workflow_runs: [
            {
              id: 12345,
              status: 'completed',
              conclusion: 'success',
            },
          ],
        }),
      };

      const mockBranchResponse = {
        ok: true,
        json: async () => ({
          object: {
            sha: 'branch-sha',
          },
        }),
      };

      const mockInvalidFileResponse = {
        ok: true,
        json: async () => ({}),
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockWorkflowRunsResponse)
        .mockResolvedValueOnce(mockBranchResponse)
        .mockResolvedValueOnce(mockInvalidFileResponse);

      await fetchLatestTestReportHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });

    it('should handle fetch exception during file fetch', async () => {
      const mockWorkflowRunsResponse = {
        ok: true,
        json: async () => ({
          workflow_runs: [
            {
              id: 12345,
              status: 'completed',
              conclusion: 'success',
            },
          ],
        }),
      };

      const mockBranchResponse = {
        ok: true,
        json: async () => ({
          object: {
            sha: 'branch-sha',
          },
        }),
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockWorkflowRunsResponse)
        .mockResolvedValueOnce(mockBranchResponse)
        .mockRejectedValueOnce(new Error('Network error'));

      await fetchLatestTestReportHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });

    it('should handle general errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await fetchLatestTestReportHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getUnitTestStatusHandler', () => {
    beforeEach(() => {
      request.query = {
        organization: 'test-org',
        ruleId: '123',
      } as any;
    });

    it('should handle missing GitHub token', async () => {
      request.headers = {} as any;

      await getUnitTestStatusHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'GitHub token not found in request headers',
        })
      );
    });

    it('should handle missing organization name', async () => {
      request.headers = {
        de_gh_token: 'test-token',
      } as any;

      await getUnitTestStatusHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Organization name not found in request headers',
        })
      );
    });

    it('should return completed status', async () => {
      const mockWorkflowRunsResponse = {
        ok: true,
        json: async () => ({
          workflow_runs: [
            {
              id: 12345,
              status: 'completed',
              conclusion: 'success',
              html_url: 'https://github.com/test-org/rule-123/actions/runs/12345',
              run_number: 42,
            },
          ],
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockWorkflowRunsResponse);

      await getUnitTestStatusHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          status: 'completed',
          reportAvailable: true,
        })
      );
    });

    it('should return running status', async () => {
      const mockWorkflowRunsResponse = {
        ok: true,
        json: async () => ({
          workflow_runs: [
            {
              id: 12345,
              status: 'in_progress',
              conclusion: null,
              html_url: 'https://github.com/test-org/rule-123/actions/runs/12345',
              run_number: 42,
            },
          ],
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockWorkflowRunsResponse);

      await getUnitTestStatusHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          status: 'running',
          reportAvailable: false,
        })
      );
    });

    it('should return queued status', async () => {
      const mockWorkflowRunsResponse = {
        ok: true,
        json: async () => ({
          workflow_runs: [
            {
              id: 12345,
              status: 'queued',
              conclusion: null,
              html_url: 'https://github.com/test-org/rule-123/actions/runs/12345',
              run_number: 42,
            },
          ],
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockWorkflowRunsResponse);

      await getUnitTestStatusHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          status: 'queued',
          reportAvailable: false,
        })
      );
    });

    it('should return failed status', async () => {
      const mockWorkflowRunsResponse = {
        ok: true,
        json: async () => ({
          workflow_runs: [
            {
              id: 12345,
              status: 'completed',
              conclusion: 'failure',
              html_url: 'https://github.com/test-org/rule-123/actions/runs/12345',
              run_number: 42,
            },
          ],
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockWorkflowRunsResponse);

      await getUnitTestStatusHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          status: 'failed',
          reportAvailable: false,
        })
      );
    });

    it('should return cancelled status', async () => {
      const mockWorkflowRunsResponse = {
        ok: true,
        json: async () => ({
          workflow_runs: [
            {
              id: 12345,
              status: 'completed',
              conclusion: 'cancelled',
              html_url: 'https://github.com/test-org/rule-123/actions/runs/12345',
              run_number: 42,
            },
          ],
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockWorkflowRunsResponse);

      await getUnitTestStatusHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          status: 'cancelled',
          reportAvailable: false,
        })
      );
    });

    it('should return not_found for unknown conclusion', async () => {
      const mockWorkflowRunsResponse = {
        ok: true,
        json: async () => ({
          workflow_runs: [
            {
              id: 12345,
              status: 'completed',
              conclusion: 'timed_out',
              html_url: 'https://github.com/test-org/rule-123/actions/runs/12345',
              run_number: 42,
            },
          ],
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockWorkflowRunsResponse);

      await getUnitTestStatusHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          status: 'not_found',
          reportAvailable: false,
        })
      );
    });

    it('should return not_found status when no runs', async () => {
      const mockWorkflowRunsResponse = {
        ok: true,
        json: async () => ({
          workflow_runs: [],
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockWorkflowRunsResponse);

      await getUnitTestStatusHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          status: 'not_found',
        })
      );
    });

    it('should handle workflow not found', async () => {
      const mockErrorResponse = {
        ok: false,
        status: 404,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockErrorResponse);

      await getUnitTestStatusHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });

    it('should handle fetch error', async () => {
      const mockErrorResponse = {
        ok: false,
        status: 500,
        text: async () => 'Server error',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockErrorResponse);

      await getUnitTestStatusHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });

    it('should handle errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await getUnitTestStatusHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });
  });
});
