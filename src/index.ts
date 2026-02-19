// SPDX-License-Identifier: Apache-2.0

import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { type Configuration, processorConfig } from './config';
import initializeFastifyClient from './clients/fastify';
import * as util from 'node:util';

export const loggerService: LoggerService = new LoggerService(processorConfig);
let configuration: Configuration;

// export const dbInit = (): void => {
//   loggerService.log('Database initialization completed');
// };

const connect = async (): Promise<void> => {
  const fastify = await initializeFastifyClient();
  fastify.listen(
    { port: processorConfig.PORT, host: '0.0.0.0' },
    (err: Error | null, address: string) => {
      if (err) {
        throw Error(err.message);
      }
      loggerService.log(`Fastify listening on ${address}`);
    }
  );
};

(async () => {
  try {
    if (process.env.NODE_ENV !== 'test') {
      // dbInit();
      configuration = { ...processorConfig };
      loggerService.log(JSON.stringify(configuration));
      await connect();
    }
  } catch (err) {
    loggerService.error(`Error while starting server on Worker ${process.pid}`, util.inspect(err));
    loggerService.error(util.inspect(err));
    process.exit(1);
  }
})();

export { configuration };
