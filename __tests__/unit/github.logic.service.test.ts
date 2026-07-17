import {
  bootstrapHandler,
  populateHandler,
  promoteHandler,
  fetchLatestTestReportHandler,
  getUnitTestStatusHandler,
  getOrganizationHandler,
} from '../../src/services/github.logic.service';
import { FastifyRequest, FastifyReply } from 'fastify';
import simpleGit from 'simple-git';
import fs from 'node:fs/promises';

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
      GITHUB_BRANCH: 'main',
      GITHUB_TEST_REPORT_PATH: 'coverage/lcov-report/index.html',
      GITHUB_API_URL: 'https://api.github.com',
      GH_TOKEN: 'test-token',
    },
    loggerService: mockLogger,
  };
});

jest.mock('simple-git', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../../src/services/github.logic.service', () => {
  const original = jest.requireActual('../../src/services/github.logic.service');

  return {
    ...original,
    waitForRepoReady: jest.fn().mockResolvedValue(undefined),
  };
});

jest.mock('node:timers/promises', () => ({
  setTimeout: jest.fn().mockResolvedValue(undefined),
}));

describe('GitHub Logic Service', () => {
  let request: any;
  let reply: Partial<FastifyReply>;

  beforeEach(() => {
    // Mock the ITenantRequest structure
    request = {
      tenantId: 'test-tenant',
      tenantToken: 'test-token',
      organizationName: 'test-org',
      initBranchName: 'main',
      headers: {},
      body: {},
      query: {},
    };

    reply = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      header: jest.fn().mockReturnThis(),
    };

    (simpleGit as jest.Mock).mockReturnValue({
      clone: jest.fn().mockResolvedValue(undefined),
      removeRemote: jest.fn().mockResolvedValue(undefined),
      addRemote: jest.fn().mockResolvedValue(undefined),
      branch: jest.fn().mockResolvedValue(undefined),
      push: jest.fn().mockResolvedValue(undefined),
      raw: jest.fn().mockResolvedValue(undefined),
      env: jest.fn().mockReturnThis(),
    });

    global.fetch = jest.fn();
    jest.clearAllMocks();
  });

  describe('bootstrapHandler', () => {
    it('should skip repo creation when repo already exists', async () => {
      request.body = { ruleId: '123', ruleVersion: '1.0.0' };

      const mockPackageGetResponse = {
        ok: true,
        json: async () => ({
          sha: 'package-sha',
          content: Buffer.from(
            JSON.stringify({ name: 'rule-template', version: '1.0.0' })
          ).toString('base64'),
        }),
      };

      const mockPackagePutResponse = {
        ok: true,
        json: async () => ({}),
      };

      (global.fetch as jest.Mock)
        // repoExists()
        .mockResolvedValueOnce({ ok: true })
        // copyTemplateFiles -> get package.json
        .mockResolvedValueOnce(mockPackageGetResponse)
        // copyTemplateFiles -> update package.json
        .mockResolvedValueOnce(mockPackagePutResponse);

      await bootstrapHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        message: 'Updated version to 1.0.0 in test-org/123 on branch main',
      });
    });

    it('should successfully bootstrap repository', async () => {
      request.body = {
        ruleId: '123',
        ruleVersion: '1.0.0',
      };

      const mockRepoResponse = {
        ok: true,
        json: async () => ({ html_url: 'https://github.com/test-org/cbe-rule-123' }),
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
        .mockResolvedValueOnce({ ok: false, status: 404 })

        // create repo
        .mockResolvedValueOnce(mockRepoResponse)

        // setDefaultBranch
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) })

        // get package.json
        .mockResolvedValueOnce(mockPackageGetResponse)

        // update package.json
        .mockResolvedValueOnce(mockPackagePutResponse);

      await bootstrapHandler(request as FastifyRequest, reply as FastifyReply);

      const gitClient = (simpleGit as jest.Mock).mock.results[0].value as {
        addRemote: jest.Mock;
        raw: jest.Mock;
      };

      expect(gitClient.raw).toHaveBeenNthCalledWith(1, [
        '-c',
        'http.extraheader=Authorization: bearer test-token',
        'clone',
        '--single-branch',
        '--branch',
        'main',
        'https://github.com/template-owner/template-repo.git',
        expect.any(String),
      ]);
      expect(gitClient.addRemote).toHaveBeenCalledWith(
        'origin',
        'https://github.com/test-org/123.git'
      );
      expect(gitClient.raw).toHaveBeenNthCalledWith(2, [
        '-c',
        'http.extraheader=Authorization: bearer test-token',
        'push',
        '-u',
        'origin',
        'main',
      ]);
      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        message: 'Created test-org/123 v1.0.0 on branch main',
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

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: false, status: 404 }) // repoExists
        .mockResolvedValueOnce({
          ok: false,
          text: async () => 'Repo creation failed',
        }); // create repo fails

      await bootstrapHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });

    it('should handle package.json fetch error', async () => {
      request.body = { ruleId: '123', ruleVersion: '1.0.0' };

      const mockRepoResponse = {
        ok: true,
        json: async () => ({ html_url: 'https://github.com/test-org/rule-123' }),
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: false, status: 404 }) // repoExists
        .mockResolvedValueOnce(mockRepoResponse) // create repo
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // setDefaultBranch
        .mockResolvedValueOnce({
          ok: false,
          text: async () => 'Package fetch failed',
        }); // package.json fetch fails

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
        .mockResolvedValueOnce({ ok: false, status: 404 }) // repoExists
        .mockResolvedValueOnce(mockRepoResponse) // create repo
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // setDefaultBranch
        .mockResolvedValueOnce(mockPackageGetResponse) // package.json fetch
        .mockResolvedValueOnce({
          ok: false,
          text: async () => 'Package update failed',
        }); // package.json update fails

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

    it('should handle package fetch failure after repository initialization', async () => {
      // Get the real implementation for this test
      const actualService = jest.requireActual('../../src/services/github.logic.service');

      request.body = { ruleId: '123', ruleVersion: '1.0.0' };

      // Mock to create a new repo that never becomes ready
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: false, status: 404 }) // repoExists
        .mockResolvedValueOnce({
          // create repo
          ok: true,
          json: async () => ({ html_url: 'https://github.com/test-org/rule-transfer-amount' }),
        })
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // setDefaultBranch
        .mockResolvedValue({ ok: false, text: async () => 'Package fetch failed' });

      await actualService.bootstrapHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to fetch package.json: Package fetch failed',
      });
    });

    it('should handle repo existence check error', async () => {
      request.body = { ruleId: '123', ruleVersion: '1.0.0' };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'GitHub unavailable',
      });

      await bootstrapHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to check repository test-org/123: GitHub unavailable',
      });
    });

    it('should clean up temp dir and scrub token on clone failure', async () => {
      request.body = { ruleId: '123', ruleVersion: '1.0.0' };

      const rmSpy = jest.spyOn(fs, 'rm').mockResolvedValue(undefined);

      (simpleGit as jest.Mock).mockReturnValue({
        clone: jest.fn().mockResolvedValue(undefined),
        removeRemote: jest.fn().mockResolvedValue(undefined),
        addRemote: jest.fn().mockResolvedValue(undefined),
        branch: jest.fn().mockResolvedValue(undefined),
        push: jest.fn().mockResolvedValue(undefined),
        raw: jest
          .fn()
          .mockRejectedValueOnce(
            new Error(
              'fatal: could not read from https://x-access-token:secret-token@github.com/template-owner/template-repo.git'
            )
          ),
        env: jest.fn().mockReturnThis(),
      });

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: false, status: 404 }) // repoExists
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }); // create repo

      await bootstrapHandler(request as FastifyRequest, reply as FastifyReply);

      expect(rmSpy).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenNthCalledWith(3, 'https://api.github.com/repos/test-org/123', {
        method: 'DELETE',
        headers: expect.objectContaining({
          Authorization: 'token test-token',
        }),
      });
      expect(reply.status).toHaveBeenCalledWith(500);
      const sentMessage = (reply.send as jest.Mock).mock.calls[0][0].message;
      expect(sentMessage).not.toContain('secret-token');
      expect(sentMessage).toContain('***');

      rmSpy.mockRestore();
    });

    it('should clean up temp dir and scrub token on push failure', async () => {
      request.body = { ruleId: '123', ruleVersion: '1.0.0' };

      const rmSpy = jest.spyOn(fs, 'rm').mockResolvedValue(undefined);

      (simpleGit as jest.Mock).mockReturnValue({
        clone: jest.fn().mockResolvedValue(undefined),
        removeRemote: jest.fn().mockResolvedValue(undefined),
        addRemote: jest.fn().mockResolvedValue(undefined),
        branch: jest.fn().mockResolvedValue(undefined),
        push: jest.fn().mockResolvedValue(undefined),
        raw: jest
          .fn()
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(
            new Error(
              '! [rejected] main -> main (non-fast-forward) https://x-access-token:leaked-token@github.com/test-org/123.git'
            )
          ),
        env: jest.fn().mockReturnThis(),
      });

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: false, status: 404 }) // repoExists
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }); // create repo

      await bootstrapHandler(request as FastifyRequest, reply as FastifyReply);

      expect(rmSpy).toHaveBeenCalled();
      expect(reply.status).toHaveBeenCalledWith(500);
      const sentMessage = (reply.send as jest.Mock).mock.calls[0][0].message;
      expect(sentMessage).not.toContain('leaked-token');
      expect(sentMessage).toContain('***');

      rmSpy.mockRestore();
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

      const ruleUpdateBody = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);
      const testUpdateBody = JSON.parse((global.fetch as jest.Mock).mock.calls[3][1].body);

      expect(ruleUpdateBody.content).toBe('cnVsZSBjb2Rl');
      expect(testUpdateBody.content).toBe('dGVzdCBjb2Rl');
      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        message: 'Populated test-org/123 on main',
      });
    });

    it('should encode raw TypeScript before populating files', async () => {
      request.body = {
        ruleId: '123',
        ruleCode: 'export const rule = true;\n',
        testCode: "describe('rule', () => {});\n",
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await populateHandler(request as FastifyRequest, reply as FastifyReply);

      const ruleUpdateBody = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);
      const testUpdateBody = JSON.parse((global.fetch as jest.Mock).mock.calls[3][1].body);

      expect(ruleUpdateBody.content).toBe(Buffer.from(request.body.ruleCode).toString('base64'));
      expect(testUpdateBody.content).toBe(Buffer.from(request.body.testCode).toString('base64'));
      expect(reply.status).toHaveBeenCalledWith(200);
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

    it('should create tenant init branch from template branch before populating files', async () => {
      request.initBranchName = 'tenant-main';
      request.body = {
        ruleId: '123',
        ruleCode: 'cnVsZSBjb2Rl',
        testCode: 'dGVzdCBjb2Rl',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: false }) // tenant branch not found
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ object: { sha: 'template-sha' } }),
        }) // template branch exists
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // create tenant branch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ sha: 'rule-sha' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ sha: 'test-sha' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await populateHandler(request as FastifyRequest, reply as FastifyReply);

      expect((global.fetch as jest.Mock).mock.calls[2][1].body).toBe(
        JSON.stringify({ ref: 'refs/heads/tenant-main', sha: 'template-sha' })
      );
      expect(reply.status).toHaveBeenCalledWith(200);
    });

    it('should handle missing template branch while populating files', async () => {
      request.initBranchName = 'tenant-main';
      request.body = {
        ruleId: '123',
        ruleCode: 'cnVsZSBjb2Rl',
        testCode: 'dGVzdCBjb2Rl',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: false }) // tenant branch not found
        .mockResolvedValueOnce({ ok: false }); // template branch not found

      await populateHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        message: 'Base branch "main" was not found in test-org/123',
      });
    });

    it('should handle tenant branch creation failure while populating files', async () => {
      request.initBranchName = 'tenant-main';
      request.body = {
        ruleId: '123',
        ruleCode: 'cnVsZSBjb2Rl',
        testCode: 'dGVzdCBjb2Rl',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: false }) // tenant branch not found
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ object: { sha: 'template-sha' } }),
        })
        .mockResolvedValueOnce({ ok: false, text: async () => 'Create ref failed' });

      await populateHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to create branch "tenant-main": Create ref failed',
      });
    });
  });

  describe('promoteHandler', () => {
    it('should return success when branch is already the tenant source branch', async () => {
      request.body = {
        ruleId: '123',
        branchName: 'main',
      };

      await promoteHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        message: 'Branch main is already the tenant source branch',
      });
    });

    it('should handle missing source branch', async () => {
      request.body = {
        ruleId: '123',
        branchName: 'feature-branch',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false });

      await promoteHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        message: 'Source branch "main" was not found in test-org/123',
      });
    });

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
        message: 'Branch feature-branch is synchronized with main (base-sha)',
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

    it('should handle json parsing error', async () => {
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
          json: async () => {
            throw new Error('JSON parse error');
          },
        });

      await fetchLatestTestReportHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        message: 'JSON parse error',
      });
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

  describe('getOrganizationHandler', () => {
    it('should return organization successfully', async () => {
      await getOrganizationHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        organization: 'test-org',
      });
    });

    it('should handle missing organization', async () => {
      request.organizationName = undefined;

      await getOrganizationHandler(request as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        message: 'Organization name not found in request headers',
      });
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
