import type { FastifyRequest, FastifyReply } from 'fastify';
import { loggerService } from '..';
import type { ITenantRequest } from '../interfaces/ITenantRequest.interface';
import { TenantTokenService } from '../utils/decrypt-utilis';
import { extractAndDecodeToken } from '../auth/authHandler';
import type { JWTPayload } from '../interfaces/index';

export const validateTenantMiddleware = async (
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const logContext = 'validateTenantMiddleware()';

  try {
    const { payload } = extractAndDecodeToken(req.headers.authorization);

    const { tenantId } = payload as JWTPayload;

    if (!tenantId || typeof tenantId !== 'string') {
      loggerService.error('Tenant validation failed: No tenantId found in token', logContext);
      reply.code(401).send({ success: false, message: 'Unauthorized' });
      return;
    }

    const credentials = TenantTokenService.getTenantCredentials(tenantId);
    const tenantRequest = req as ITenantRequest;
    tenantRequest.tenantId = tenantId;
    tenantRequest.tenantToken = credentials.token;
    tenantRequest.organizationName = credentials.organizationName;
  } catch (error) {
    const err = error as Error;
    loggerService.error(`${err.name}: ${err.message}\n${err.stack}`, logContext);
    reply.code(401).send({ success: false, message: 'Unauthorized' });
  }
};
