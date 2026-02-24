import { validateTokenAndClaims } from '@tazama-lf/auth-lib';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { loggerService } from '..';
import type { JwtPayloadWithClaims } from '../interfaces/index';

export const extractAndDecodeToken = (
  authHeader?: string
): { rawToken: string; payload: JwtPayloadWithClaims } => {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Invalid authorization header');
  }

  const [, token] = authHeader.split(' ');
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString()) as JwtPayloadWithClaims;

  return { rawToken: token, payload };
};

export const tokenHandler =
  (claims: string | string[]) =>
  async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const logContext = 'tokenHandler()';

    try {
      const { rawToken } = extractAndDecodeToken(request.headers.authorization);
      const claimsArray = Array.isArray(claims) ? claims : [claims];

      const validated = validateTokenAndClaims(rawToken, claimsArray);
      const hasRequiredClaim = claimsArray.some((c) => validated[c]);

      if (!hasRequiredClaim) {
        loggerService.error(`Missing required claims: ${claimsArray.join(', ')}`, logContext);
        reply
          .code(403)
          .send({ success: false, message: `Missing required claims: ${claimsArray.join(', ')}` });
        return;
      }

      loggerService.log(`Authenticated with claims: ${claimsArray.join(', ')}`, logContext);
    } catch (error) {
      const err = error as Error;

      loggerService.error(`${err.name}: ${err.message}\n${err.stack}`, logContext);

      reply.code(401).send({
        success: false,
        message: 'Unauthorized',
      });
    }
  };
