// SPDX-License-Identifier: Apache-2.0

const REDACTED = '[REDACTED]';
const SECRET_NAME_ENDINGS = new Set([
  'KEY',
  'IV',
  'TOKEN',
  'SECRET',
  'PASSWORD',
  'PASS',
  'PWD',
  'AUTH',
]);

const isSecretName = (name: string): boolean =>
  SECRET_NAME_ENDINGS.has(name.slice(name.lastIndexOf('_') + 1).toUpperCase());

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
};

const redactValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([name, inner]) => [
        name,
        isSecretName(name) ? REDACTED : redactValue(inner),
      ])
    );
  }
  return value;
};

export const redactConfiguration = (config: object): Record<string, unknown> =>
  redactValue(config) as Record<string, unknown>;
