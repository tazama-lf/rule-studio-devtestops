// SPDX-License-Identifier: Apache-2.0

import Routes from '../router';
import { fastifyCors } from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';

let fastify: FastifyInstance | null = null;

export default async function initializeFastifyClient(): Promise<FastifyInstance> {
  fastify = Fastify({ logger: true });

  const methods = process.env.NODE_ENV === 'production' ? ['GET'] : ['GET', 'POST', 'PUT'];

  await fastify.register(fastifyCors, { origin: '*', methods, allowedHeaders: '*' });

  await fastify.register(Routes, { prefix: '/api' });

  await fastify.ready();

  return fastify;
}

export async function destroyFastifyClient(): Promise<void> {
  if (fastify) {
    await fastify.close();
  }
}
