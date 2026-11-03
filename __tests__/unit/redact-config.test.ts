import { redactConfiguration } from '../../src/utils/redact-config';

describe('redactConfiguration', () => {
  it.each([
    'ENCRYPTION_KEY',
    'ENCRYPTION_IV',
    'GITHUB_TOKEN',
    'API_KEY',
    'APM_SECRET_TOKEN',
    'ELASTIC_PASSWORD',
    'REDIS_AUTH',
    'CONFIGURATION_DATABASE_PASSWORD',
    'X_SECRET',
    'DB_PASS',
    'DB_PWD',
    'KEY',
    'IV',
    'TOKEN',
    'SECRET',
    'PASSWORD',
    'PASS',
    'PWD',
    'AUTH',
    'api_key',
    'Github_Token',
  ])('redacts the value of %s', (name) => {
    const redacted = redactConfiguration({ [name]: 'sensitive-value' });

    expect(redacted[name]).toBe('[REDACTED]');
    expect(JSON.stringify(redacted)).not.toContain('sensitive-value');
  });

  it.each([
    ['GITHUB_ORG_NAME', 'tazama-uat-rules'],
    ['GITHUB_API_URL', 'https://api.github.com'],
    ['GITHUB_TEMPLATE_REPO', 'rule-studio-example'],
    ['GITHUB_INIT_BRANCH', 'staging'],
    ['CERT_PATH_PRIVATE', '/auth/private.pem'],
    ['CERT_PATH_PUBLIC', '/auth/test-public-key.pem'],
    ['TAZAMA_AUTH_URL', 'http://core.tazama.internal:3020/v1/auth'],
    ['HOST', '0.0.0.0'],
    ['PORT', 3050],
    ['MONKEY', 'banana'],
    ['AUTHOR', 'someone'],
    ['PASSPORT', 'AB123'],
    ['KEYBOARD', 'qwerty'],
    ['ARCHIV', 'old'],
    ['TOKENIZER', 'bpe'],
    ['SECRETARY', 'office'],
  ])('keeps the value of %s', (name, value) => {
    expect(redactConfiguration({ [name]: value })[name]).toBe(value);
  });

  it.each([
    ['a number', 12345678],
    ['null', null],
    ['undefined', undefined],
    ['an object', { inner: 'object-secret' }],
    ['an array', ['array-secret']],
  ])('replaces a secret value that is %s with the placeholder', (_label, value) => {
    const redacted = redactConfiguration({ GITHUB_TOKEN: value });

    expect(redacted.GITHUB_TOKEN).toBe('[REDACTED]');
    expect(JSON.stringify(redacted)).not.toContain('object-secret');
    expect(JSON.stringify(redacted)).not.toContain('array-secret');
  });

  it('redacts secrets inside nested objects and arrays and keeps the other values', () => {
    const redacted = redactConfiguration({
      db: { host: 'postgres', PASSWORD: 'nested-secret' },
      list: [{ TOKEN: 'array-secret', name: 'first' }, 'plain'],
    });

    expect(JSON.stringify(redacted)).not.toContain('nested-secret');
    expect(JSON.stringify(redacted)).not.toContain('array-secret');
    expect((redacted.db as Record<string, unknown>).host).toBe('postgres');
    expect((redacted.list as unknown[])[0]).toEqual({ TOKEN: '[REDACTED]', name: 'first' });
    expect((redacted.list as unknown[])[1]).toBe('plain');
  });

  it('redacts inside objects without a prototype and leaves non-plain objects as they are', () => {
    const bare = Object.create(null) as Record<string, unknown>;
    bare.TOKEN = 'bare-secret';
    bare.name = 'bare';
    const when = new Date('2026-11-03T00:00:00Z');

    const redacted = redactConfiguration({ bare, when });

    expect(redacted.bare).toEqual({ TOKEN: '[REDACTED]', name: 'bare' });
    expect(redacted.when).toBe(when);
  });

  it('copes with null and undefined values under non-secret keys', () => {
    expect(redactConfiguration({ A: null, B: undefined, C: 0, D: false })).toEqual({
      A: null,
      B: undefined,
      C: 0,
      D: false,
    });
  });

  it('returns a new object and leaves the input, including nested values, untouched', () => {
    const input = {
      GITHUB_TOKEN: 'live-token',
      ENCRYPTION_KEY: 'live-key',
      db: { host: 'postgres', PASSWORD: 'live-password' },
      list: [{ TOKEN: 'live-array-token' }],
    };
    const snapshot = JSON.parse(JSON.stringify(input));

    const redacted = redactConfiguration(input);

    expect(redacted).not.toBe(input);
    expect(redacted.db).not.toBe(input.db);
    expect(redacted.list).not.toBe(input.list);
    expect(input).toEqual(snapshot);
  });
});
