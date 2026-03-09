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

jest.mock('../../src/services/github.logic.service', () => {
  const original = jest.requireActual('../../src/services/github.logic.service');

  return {
    ...original,
    waitForRepoReady: jest.fn().mockResolvedValue(undefined),
  };
});

describe('GitHub Logic Service', () => {
  let request: any;
  let reply: Partial<FastifyReply>;

  beforeEach(() => {
    // Mock the ITenantRequest structure
    request = {
      tenantId: 'test-tenant',
      tenantToken: 'test-token',
      organizationName: 'test-org',
      headers: {},
      body: {},
      query: {},
    };

    reply = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      header: jest.fn().mockReturnThis(),
    };

    global.fetch = jest.fn();
    jest.clearAllMocks();
  });

  describe('bootstrapHandler', () => {
    it('should skip repo creation when repo already exists', async () => {
      request.body = { ruleId: '123', ruleVersion: '1.0.0' };

      const mockRepoExists = { ok: true };

      const mockPackageGet = {
        ok: true,
        json: async () => ({
          content: Buffer.from(JSON.stringify({ name: 'old', version: '0.0.1' })).toString(
            'base64'
          ),
          sha: 'abc123',
        }),
      };

      const mockPackagePut = {
        ok: true,
        json: async () => ({}),
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockRepoExists) // repoExists() -> true
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ default_branch: 'main' }),
        }) // waitForRepoReady
        .mockResolvedValueOnce(mockPackageGet)
        .mockResolvedValueOnce(mockPackagePut);

      await bootstrapHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
    });

    it('should successfully bootstrap repository', async () => {
      request.body = {
        ruleId: '123',
        ruleVersion: '1.0.0',
      };

      const mockRepoResponse = {
        ok: true,
        json: async () => ({ html_url: 'https://github.com/test-org/rule-123' }),
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
      };

      (global.fetch as jest.Mock)
        // repoExists()
        .mockResolvedValueOnce({ ok: false })

        // create repo
        .mockResolvedValueOnce(mockRepoResponse)

        // waitForRepoReady() poll
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ default_branch: 'staging' }),
        })

        // get package.json
        .mockResolvedValueOnce(mockPackageGetResponse)

        // update package.json
        .mockResolvedValueOnce(mockPackagePutResponse);

      await bootstrapHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        message: 'Created test-org/test-tenant-rule-123 v1.0.0',
      });
    });

    it('should handle missing token', async () => {
      request.tenantToken = undefined;
      request.body = { ruleId: '123', ruleVersion: '1.0.0' };

      await bootstrapHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        message: 'GitHub token not found in request headers',
      });
    });

    it('should handle missing organization', async () => {
      request.organizationName = undefined;
      request.body = { ruleId: '123', ruleVersion: '1.0.0' };

      await bootstrapHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        message: 'Organization name not found in request headers',
      });
    });

    it('should handle repo creation error', async () => {
      request.body = { ruleId: '123', ruleVersion: '1.0.0' };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        text: async () => 'Repo creation failed',
      });

      await bootstrapHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });

    it('should handle package.json fetch error', async () => {
      request.body = { ruleId: '123', ruleVersion: '1.0.0' };

      const mockRepoResponse = {
        ok: true,
        json: async () => ({ html_url: 'https://github.com/test-org/rule-123' }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockRepoResponse).mockResolvedValueOnce({
        ok: false,
        text: async () => 'Package fetch failed',
      });

      await bootstrapHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });

    it('should handle package.json update error', async () => {
      request.body = { ruleId: '123', ruleVersion: '1.0.0' };

      const mockRepoResponse = {
        ok: true,
        json: async () => ({ html_url: 'https://github.com/test-org/rule-123' }),
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

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockRepoResponse)
        .mockResolvedValueOnce(mockPackageGetResponse)
        .mockResolvedValueOnce({
          ok: false,
          text: async () => 'Package update failed',
        });

      await bootstrapHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });

    it('should handle non-Error exceptions', async () => {
      request.body = { ruleId: '123', ruleVersion: '1.0.0' };

      (global.fetch as jest.Mock).mockRejectedValueOnce('String error');

      await bootstrapHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        message: 'String error',
      });
    });
  });

  describe('populateHandler', () => {
    it('should successfully populate files', async () => {
      request.body = {
        ruleId: '123',
        ruleCode: 'cnVsZSBjb2Rl', // base64
        testCode: 'dGVzdCBjb2Rl', // base64
      };

      // Mock getFileSha calls
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ sha: 'rule-sha' }) }) // rule sha
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // rule update
        .mockResolvedValueOnce({ ok: true, json: async () => ({ sha: 'test-sha' }) }) // test sha
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }); // test update

      await populateHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        message: 'Populated test-org/test-tenant-rule-123 on main',
      });
    });

    it('should handle rule update error', async () => {
      request.body = {
        ruleId: '123',
        ruleCode: 'cnVsZSBjb2Rl',
        testCode: 'dGVzdCBjb2Rl',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ sha: 'rule-sha' }) })
        .mockResolvedValueOnce({ ok: false, text: async () => 'Rule update failed' });

      await populateHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });

    it('should handle test update error', async () => {
      request.body = {
        ruleId: '123',
        ruleCode: 'cnVsZSBjb2Rl',
        testCode: 'dGVzdCBjb2Rl',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ sha: 'rule-sha' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ sha: 'test-sha' }) })
        .mockResolvedValueOnce({ ok: false, text: async () => 'Test update failed' });

      await populateHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });

    it('should handle missing file sha (undefined response)', async () => {
      request.body = {
        ruleId: '123',
        ruleCode: 'cnVsZSBjb2Rl',
        testCode: 'dGVzdCBjb2Rl',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: false }) // rule sha not found
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // rule update
        .mockResolvedValueOnce({ ok: false }) // test sha not found
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }); // test update

      await populateHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
    });
  });

  describe('promoteHandler', () => {
    it('should create new branch from default', async () => {
      request.body = {
        ruleId: '123',
        branchName: 'feature-branch',
      };

      // Mock getBranchSha for default branch
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ object: { sha: 'base-sha' } }),
        })
        // Mock getBranchSha for feature branch (not found)
        .mockResolvedValueOnce({ ok: false })
        // Mock create branch
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await promoteHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        message: 'Branch feature-branch is synchronized with base-sha',
      });
    });

    it('should sync existing branch with default', async () => {
      request.body = {
        ruleId: '123',
        branchName: 'feature-branch',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ object: { sha: 'base-sha' } }),
        }) // getBranchSha for default
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ object: { sha: 'existing-sha' } }),
        }) // getBranchSha for feature (exists)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ commit: { tree: { sha: 'tree-sha' } } }),
        }) // get latest commit
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sha: 'new-commit-sha' }),
        }) // create new commit
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }); // update branch ref

      await promoteHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
    });

    it('should handle latest commit fetch error', async () => {
      request.body = {
        ruleId: '123',
        branchName: 'feature-branch',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ object: { sha: 'base-sha' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ object: { sha: 'existing-sha' } }),
        })
        .mockResolvedValueOnce({
          ok: false,
          text: async () => 'Commit fetch failed',
        });

      await promoteHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });

    it('should handle new commit creation error', async () => {
      request.body = {
        ruleId: '123',
        branchName: 'feature-branch',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ object: { sha: 'base-sha' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ object: { sha: 'existing-sha' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ commit: { tree: { sha: 'tree-sha' } } }),
        })
        .mockResolvedValueOnce({
          ok: false,
          text: async () => 'Commit creation failed',
        });

      await promoteHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });

    it('should handle branch update error', async () => {
      request.body = {
        ruleId: '123',
        branchName: 'feature-branch',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ object: { sha: 'base-sha' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ object: { sha: 'existing-sha' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ commit: { tree: { sha: 'tree-sha' } } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sha: 'new-commit-sha' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          text: async () => 'Branch update failed',
        });

      await promoteHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });

    it('should handle branch creation error', async () => {
      request.body = {
        ruleId: '123',
        branchName: 'feature-branch',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ object: { sha: 'base-sha' } }),
        })
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({
          ok: false,
          text: async () => 'Branch creation failed',
        });

      await promoteHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });
  });

  describe('fetchLatestTestReportHandler', () => {
    it('should successfully fetch test report', async () => {
      request.query = {
        ruleId: '123',
        branchName: 'main',
      };

      const mockWorkflowRun = {
        status: 'completed',
        conclusion: 'success',
      };

      const mockFileData = {
        content: Buffer.from('<html>Test Report</html>').toString('base64'),
        encoding: 'base64',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ workflow_runs: [mockWorkflowRun] }),
        }) // workflow runs
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ object: { sha: 'branch-sha' } }),
        }) // getBranchSha
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFileData,
        }); // file fetch

      await fetchLatestTestReportHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.header).toHaveBeenCalledWith('Content-Type', 'text/html');
      expect(reply.send).toHaveBeenCalledWith('<html>Test Report</html>');
    });

    it('should handle workflow fetch error', async () => {
      request.query = { ruleId: '123' };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        text: async () => 'Workflow fetch failed',
      });

      await fetchLatestTestReportHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });

    it('should handle no workflow runs', async () => {
      request.query = { ruleId: '123' };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ workflow_runs: [] }),
      });

      await fetchLatestTestReportHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });

    it('should handle running workflow', async () => {
      request.query = { ruleId: '123' };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          workflow_runs: [{ status: 'in_progress', conclusion: null }],
        }),
      });

      await fetchLatestTestReportHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(201);
    });

    it('should handle queued workflow', async () => {
      request.query = { ruleId: '123' };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          workflow_runs: [{ status: 'queued', conclusion: null }],
        }),
      });

      await fetchLatestTestReportHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(201);
    });

    it('should handle failed workflow', async () => {
      request.query = { ruleId: '123' };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          workflow_runs: [{ status: 'completed', conclusion: 'failure' }],
        }),
      });

      await fetchLatestTestReportHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(422);
    });

    it('should handle cancelled workflow', async () => {
      request.query = { ruleId: '123' };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          workflow_runs: [{ status: 'completed', conclusion: 'cancelled' }],
        }),
      });

      await fetchLatestTestReportHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(422);
    });

    it('should handle unknown workflow status', async () => {
      request.query = { ruleId: '123' };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          workflow_runs: [{ status: 'completed', conclusion: 'unknown' }],
        }),
      });

      await fetchLatestTestReportHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });

    it('should handle branch not found', async () => {
      request.query = { ruleId: '123' };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            workflow_runs: [{ status: 'completed', conclusion: 'success' }],
          }),
        })
        .mockResolvedValueOnce({ ok: false }); // getBranchSha fails

      await fetchLatestTestReportHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });

    it('should handle file not found', async () => {
      request.query = { ruleId: '123' };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            workflow_runs: [{ status: 'completed', conclusion: 'success' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ object: { sha: 'branch-sha' } }),
        })
        .mockResolvedValueOnce({ status: 404 });

      await fetchLatestTestReportHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });

    it('should handle file fetch error', async () => {
      request.query = { ruleId: '123' };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            workflow_runs: [{ status: 'completed', conclusion: 'success' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ object: { sha: 'branch-sha' } }),
        })
        .mockResolvedValueOnce({
          ok: false,
          text: async () => 'File fetch failed',
        });

      await fetchLatestTestReportHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });

    it('should handle directory instead of file', async () => {
      request.query = { ruleId: '123' };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            workflow_runs: [{ status: 'completed', conclusion: 'success' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ object: { sha: 'branch-sha' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ type: 'dir' }], // Array means directory
        });

      await fetchLatestTestReportHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it('should handle invalid file response', async () => {
      request.query = { ruleId: '123' };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            workflow_runs: [{ status: 'completed', conclusion: 'success' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ object: { sha: 'branch-sha' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ invalid: 'response' }), // Missing content/encoding
        });

      await fetchLatestTestReportHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });

    it('should handle fetch exception', async () => {
      request.query = { ruleId: '123' };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            workflow_runs: [{ status: 'completed', conclusion: 'success' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ object: { sha: 'branch-sha' } }),
        })
        .mockRejectedValueOnce(new Error('Network error'));

      await fetchLatestTestReportHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getUnitTestStatusHandler', () => {
    it('should return completed status', async () => {
      request.query = { ruleId: '123' };

      const mockRun = {
        run_number: 42,
        html_url: 'https://github.com/run/42',
        status: 'completed',
        conclusion: 'success',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ workflow_runs: [mockRun] }),
      });

      await getUnitTestStatusHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        workflow: 'Unit Tests',
        branch: 'main',
        status: 'completed',
        github: {
          runNumber: 42,
          runUrl: 'https://github.com/run/42',
          status: 'completed',
          conclusion: 'success',
        },
        reportAvailable: true,
      });
    });

    it('should return running status', async () => {
      request.query = { ruleId: '123' };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          workflow_runs: [{ status: 'in_progress', conclusion: null }],
        }),
      });

      await getUnitTestStatusHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'running',
          reportAvailable: false,
        })
      );
    });

    it('should return queued status', async () => {
      request.query = { ruleId: '123' };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          workflow_runs: [{ status: 'queued', conclusion: null }],
        }),
      });

      await getUnitTestStatusHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'queued',
          reportAvailable: false,
        })
      );
    });

    it('should return failed status', async () => {
      request.query = { ruleId: '123' };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          workflow_runs: [{ status: 'completed', conclusion: 'failure' }],
        }),
      });

      await getUnitTestStatusHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          reportAvailable: false,
        })
      );
    });

    it('should return cancelled status', async () => {
      request.query = { ruleId: '123' };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          workflow_runs: [{ status: 'completed', conclusion: 'cancelled' }],
        }),
      });

      await getUnitTestStatusHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'cancelled',
          reportAvailable: false,
        })
      );
    });

    it('should return not_found for unknown conclusion', async () => {
      request.query = { ruleId: '123' };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          workflow_runs: [{ status: 'completed', conclusion: 'unknown' }],
        }),
      });

      await getUnitTestStatusHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'not_found',
          reportAvailable: false,
        })
      );
    });

    it('should return not_found when no runs', async () => {
      request.query = { ruleId: '123' };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ workflow_runs: [] }),
      });

      await getUnitTestStatusHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        status: 'not_found',
        reportAvailable: false,
      });
    });

    it('should handle workflow not found', async () => {
      request.query = { ruleId: '123' };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 404,
        ok: false,
      });

      await getUnitTestStatusHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });

    it('should handle fetch error', async () => {
      request.query = { ruleId: '123' };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        text: async () => 'Fetch failed',
      });

      await getUnitTestStatusHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });
  });

  describe('Error handling', () => {
    it('should handle organization from headers fallback', async () => {
      request.organizationName = undefined;
      request.headers = { organization_name: 'header-org' };
      request.body = { ruleId: '123', ruleVersion: '1.0.0' };
      request.tenantToken = undefined; // Make sure token is also missing

      await bootstrapHandler(request as FastifyRequest, reply as FastifyReply);
      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        message: 'GitHub token not found in request headers',
      });
    });

    it('should handle Error exceptions in bootstrap', async () => {
      request.body = { ruleId: '123', ruleVersion: '1.0.0' };

      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await bootstrapHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        message: 'Network error',
      });
    });
  });
});
