const mockSecrets = {
  ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef',
  ENCRYPTION_IV: 'fedcba9876543210',
  GITHUB_TOKEN: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
  ELASTIC_PASSWORD: 'elastic-password-value',
};

const mockUnlisted = {
  GITHUB_API_URL: 'https://svc:url-password-value@api.github.com',
  REDIS_SERVERS: '[{"host":"redis-host-value","port":6379}]',
  NEW_FUTURE_SETTING: 'future-setting-value',
};

const mockLogger = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  trace: jest.fn(),
};

const mockListen = jest.fn();

jest.mock('@tazama-lf/frms-coe-lib', () => ({
  LoggerService: jest.fn().mockImplementation(() => mockLogger),
}));

jest.mock('../../src/config', () => ({
  processorConfig: {
    ...mockSecrets,
    ...mockUnlisted,
    GITHUB_ORG_NAME: 'tazama-uat-rules',
    GITHUB_TEMPLATE_OWNER: 'template-owner-value',
    GITHUB_TEMPLATE_REPO: 'rule-studio-example',
    GITHUB_BRANCH: 'main',
    GITHUB_INIT_BRANCH: 'staging',
    PORT: 3050,
    HOST: '0.0.0.0',
  },
}));

jest.mock('../../src/clients/fastify', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(async () => ({ listen: mockListen })),
}));

const everyLoggedValue = (): string =>
  JSON.stringify(Object.values(mockLogger).flatMap((logFn) => logFn.mock.calls));

const startServer = async (): Promise<typeof import('../../src/index')> => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  let loaded: typeof import('../../src/index') | undefined;
  try {
    await jest.isolateModulesAsync(async () => {
      loaded = await import('../../src/index');
    });
    for (let i = 0; i < 5; i += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  } finally {
    if (previous === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previous;
    }
  }
  return loaded as typeof import('../../src/index');
};

const expectNoSecretIn = (logged: string): void => {
  const leaked = Object.entries(mockSecrets)
    .filter(([, value]) => logged.includes(value))
    .map(([name]) => name);
  expect(leaked).toEqual([]);
};

const expectNoUnlistedValueIn = (logged: string): void => {
  const leaked = ['url-password-value', 'redis-host-value', 'future-setting-value'].filter(
    (value) => logged.includes(value)
  );
  expect(leaked).toEqual([]);
};

describe('server startup logging', () => {
  let exitSpy: jest.SpyInstance;

  beforeEach(() => {
    mockListen.mockResolvedValue('http://0.0.0.0:3050');
    exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  });

  afterEach(() => {
    exitSpy.mockRestore();
  });

  it('writes no secret value to any log call', async () => {
    await startServer();

    expectNoSecretIn(everyLoggedValue());
  });

  it('writes no value that is not on the startup log allowlist', async () => {
    await startServer();

    expectNoUnlistedValueIn(everyLoggedValue());
  });

  it('still logs the operational settings an operator needs', async () => {
    await startServer();

    const logged = everyLoggedValue();
    expect(logged).toContain('tazama-uat-rules');
    expect(logged).toContain('template-owner-value');
    expect(logged).toContain('rule-studio-example');
    expect(logged).toContain('staging');
    expect(logged).toContain('3050');
    expect(logged).toContain('Fastify listening on');
  });

  it('keeps the real secrets in the configuration the handlers use', async () => {
    const { configuration } = await startServer();
    const live = configuration as unknown as Record<string, unknown>;

    expect(live.GITHUB_TOKEN).toBe(mockSecrets.GITHUB_TOKEN);
    expect(live.ENCRYPTION_KEY).toBe(mockSecrets.ENCRYPTION_KEY);
  });

  it('writes no secret value to the log when the server fails to start', async () => {
    mockListen.mockRejectedValue(new Error('listen EADDRINUSE: address already in use'));

    await startServer();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(mockLogger.error).toHaveBeenCalled();
    expectNoSecretIn(everyLoggedValue());
    expectNoUnlistedValueIn(everyLoggedValue());
  });
});
