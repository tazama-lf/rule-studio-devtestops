// SPDX-License-Identifier: Apache-2.0

import crypto from 'node:crypto';
import { processorConfig } from '../config';

const algorithm = 'aes-256-cbc';
const key = Buffer.from(processorConfig.ENCRYPTION_KEY, 'utf8');
const iv = Buffer.from(processorConfig.ENCRYPTION_IV, 'utf8');
if (key.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be 32 bytes');
}
if (iv.length !== 16) {
  throw new Error('ENCRYPTION_IV must be 16 bytes');
}

export const DecryptService = {
  decrypt: (cipherText: string): string => {
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(cipherText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  },
};
