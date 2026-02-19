// SPDX-License-Identifier: Apache-2.0

import type { FastifyRequest, FastifyReply } from 'fastify';

export const handleHealthCheck = (_req: FastifyRequest, reply: FastifyReply): void => {
  reply.send({ status: 'UP' });
};
