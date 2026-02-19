// SPDX-License-Identifier: Apache-2.0

import Routes from '../router';
import { fastifyCors } from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';

const fastify = Fastify({ logger: true });

export default async function initializeFastifyClient(): Promise<FastifyInstance> {
  const methods = process.env.NODE_ENV === 'production' ? ['GET'] : ['GET', 'POST', 'PUT'];

  await fastify.register(fastifyCors, { origin: '*', methods, allowedHeaders: '*' });

  await fastify.register(Routes, { prefix: '/api' });

  await fastify.ready();

  return await fastify;
}
export async function destroyFastifyClient(): Promise<void> {
  await fastify.close();
}
