// SPDX-License-Identifier: Apache-2.0

import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { type Configuration, processorConfig } from './config';
import initializeFastifyClient from './clients/fastify';
import * as util from 'node:util';

export const loggerService: LoggerService = new LoggerService(processorConfig);
let configuration: Configuration;

const connect = async (): Promise<void> => {
  const fastify = await initializeFastifyClient();

  const address = await fastify.listen({ port: processorConfig.PORT, host: processorConfig.HOST });
  loggerService.log(`Fastify listening on ${address}`);
};

(async () => {
  try {
    if (process.env.NODE_ENV !== 'test') {
      configuration = { ...processorConfig };
      loggerService.log(
        `Starting with org=${configuration.GITHUB_ORG_NAME} ` +
          `template=${configuration.GITHUB_TEMPLATE_OWNER}/${configuration.GITHUB_TEMPLATE_REPO}@${configuration.GITHUB_BRANCH} ` +
          `initBranch=${configuration.GITHUB_INIT_BRANCH} host=${configuration.HOST} port=${configuration.PORT}`
      );
      await connect();
    }
  } catch (err) {
    loggerService.error(`Error while starting server on Worker ${process.pid}`, util.inspect(err));
    loggerService.error(util.inspect(err));
    process.exit(1);
  }
})();

export { configuration };
