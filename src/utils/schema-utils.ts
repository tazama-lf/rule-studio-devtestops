// SPDX-License-Identifier: Apache-2.0

import type { FastifyReply, FastifyRequest, RouteHandlerMethod } from 'fastify';
import type { FastifySchema } from 'fastify/types/schema';
import type { TSchema } from '@sinclair/typebox';
import { validateTenantMiddleware } from '../middleware/tenantMiddleware';
import { tokenHandler } from '../auth/authHandler';
import { loggerService } from '../index';

type PreHandler = (request: FastifyRequest, reply: FastifyReply) => void | Promise<void>;

export const SetOptionsBodyAndParams = (
  handler: RouteHandlerMethod,
  claims: string | string[],
  bodySchema?: TSchema,
  querySchema?: TSchema,
  responseSchema?: TSchema
): {
  preHandler: PreHandler[];
  handler: RouteHandlerMethod;
  schema: FastifySchema;
} => {
  loggerService.debug(`Authentication ENABLED for ${handler.name}`);

  const preHandlers: PreHandler[] = [validateTenantMiddleware, tokenHandler(claims)];

  const schema: FastifySchema = {
    ...(bodySchema && { body: bodySchema }),
    ...(querySchema && { querystring: querySchema }),
    ...(responseSchema && {
      response: {
        200: responseSchema,
        400: responseSchema,
        401: responseSchema,
        403: responseSchema,
        500: responseSchema,
      },
    }),
  };

  return { preHandler: preHandlers, handler, schema };
};

export default SetOptionsBodyAndParams;
