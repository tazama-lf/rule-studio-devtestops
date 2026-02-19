// SPDX-License-Identifier: Apache-2.0
import * as path from 'node:path';
import * as dotenv from 'dotenv';
import {
  type AdditionalConfig,
  type ProcessorConfig,
  validateProcessorConfig,
} from '@tazama-lf/frms-coe-lib/lib/config/processor.config';
import type { IConfig } from './interfaces/index';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export type Configuration = ProcessorConfig & IConfig;

export const additionalEnvironmentVariables: AdditionalConfig[] = [
  { name: 'GITHUB_API_URL', type: 'string', optional: false },
  { name: 'GITHUB_TEMPLATE_OWNER', type: 'string', optional: false },
  { name: 'GITHUB_DEFAULT_BRANCH', type: 'string', optional: false },
  { name: 'GITHUB_TEMPLATE_REPO', type: 'string', optional: false },
  { name: 'GITHUB_TEST_REPORT_PATH', type: 'string', optional: false },
  { name: 'PORT', type: 'number', optional: false },
  { name: 'ENCRYPTION_KEY', type: 'string', optional: false },
  { name: 'ENCRYPTION_IV', type: 'string', optional: false },
];

const processorConfig = validateProcessorConfig(additionalEnvironmentVariables) as Configuration;

export { processorConfig };
