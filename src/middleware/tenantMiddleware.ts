import type { FastifyRequest, FastifyReply } from 'fastify';
import { loggerService } from '..';
import { DecryptService } from '../utils/decrypt-utilis';
import { extractAndDecodeToken } from '../auth/authHandler';
import type { ITenantRequest } from '../interfaces/index';

export const validateTenantMiddleware = async (
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const logContext = 'validateTenantMiddleware()';

  try {
    const { payload } = extractAndDecodeToken(req.headers.authorization);

    if (!payload.tenantId || typeof payload.tenantId !== 'string') {
      loggerService.error('Tenant validation failed: No tenantId found in token', logContext);
      reply.code(401).send({ success: false, message: 'Unauthorized' });
      return;
    }

    const encryptedToken = process.env.GITHUB_TOKEN;
    const organizationName = process.env.GITHUB_ORG_NAME;
    const initBranchName = process.env.GITHUB_INIT_BRANCH;

    if (!encryptedToken || !organizationName || !initBranchName) {
      loggerService.error('GitHub token, organization name, or init branch is missing', logContext);
      reply.code(500).send({ success: false, message: 'GitHub configuration is missing' });
      return;
    }

    const tenantRequest = req as ITenantRequest;

    tenantRequest.tenantId = payload.tenantId;
    tenantRequest.tenantToken = DecryptService.decrypt(encryptedToken);
    tenantRequest.organizationName = organizationName;
    tenantRequest.initBranchName = initBranchName;
  } catch (error) {
    const err = error as Error;
    loggerService.error(`${err.name}: ${err.message}\n${err.stack}`, logContext);
    reply.code(401).send({ success: false, message: 'Unauthorized' });
  }
};
