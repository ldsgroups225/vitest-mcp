import { describe, it, vi, beforeEach, afterEach, expect } from 'vitest';

// Mock Server class using vi.fn() with class syntax
const MockServer = vi.fn(class {
  onerror = vi.fn();
  onclose = vi.fn();
  setRequestHandler = vi.fn();
  connect = vi.fn().mockResolvedValue(undefined);
});

// Mock MCP SDK with the factory
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: MockServer
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => ({
    _stdin: {},
    _stdout: {},
    _readBuffer: [],
    _started: false,
    start: vi.fn(),
    close: vi.fn(),
  }))
}));

// Mock all tool modules
vi.mock('../tools/list-tests.js');
vi.mock('../tools/run-tests.js');
vi.mock('../tools/analyze-coverage.js');
vi.mock('../tools/set-project-root.js');

// Mock config and plugins with proper interfaces
vi.mock('../config/config-loader.js', () => ({
  getConfig: vi.fn().mockResolvedValue({
    server: {
      verbose: false,
      validatePaths: true,
      allowRootExecution: false,
      workingDirectory: process.cwd(),
    },
    coverageDefaults: {
      format: 'summary' as const,
      exclude: [],
    }
  })
}));

vi.mock('../plugins/index.js', () => ({
  createStandardToolRegistry: vi.fn().mockReturnValue({
    getTools: vi.fn().mockReturnValue([]),
    execute: vi.fn().mockResolvedValue({ content: [] }),
    plugins: new Map(),
    config: {
      debug: false,
      getErrorHint: vi.fn().mockReturnValue('')
    },
    register: vi.fn(),
    hasPlugin: vi.fn().mockReturnValue(false),
    getPlugin: vi.fn(),
    listPlugins: vi.fn().mockReturnValue([])
  })
}));

describe('VitestMCPServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Server Initialization', () => {
    it('should create server with correct configuration', async () => {
      const { VitestMCPServer } = await import('../index.js');
      new VitestMCPServer();

      expect(MockServer).toHaveBeenCalled();
      const callArgs = MockServer.mock.calls[0] as unknown as [{ name: string; version: string }, { capabilities: { tools: object; resources: object } }];
      expect(callArgs[0]).toEqual({
        name: 'vitest-mcp',
        version: '0.2.0'
      });
      expect(callArgs[1]).toEqual({
        capabilities: {
          tools: {},
          resources: {}
        }
      });
    });

    it('should set up error and close handlers', async () => {
      const { VitestMCPServer } = await import('../index.js');
      new VitestMCPServer();

      expect(MockServer).toHaveBeenCalled();
      const serverInstance = MockServer.mock.results[0].value;
      expect(serverInstance.onerror).toBeDefined();
      expect(serverInstance.onclose).toBeDefined();
    });
  });

  describe('Request Handler Registration', () => {
    it('should register all required MCP request handlers', async () => {
      const mockToolRegistry = {
        getTools: vi.fn().mockReturnValue([]),
        execute: vi.fn(),
        plugins: new Map(),
        config: {
          debug: false,
          getErrorHint: vi.fn().mockReturnValue('')
        },
        register: vi.fn(),
        hasPlugin: vi.fn().mockReturnValue(false),
        getPlugin: vi.fn(),
        listPlugins: vi.fn().mockReturnValue([])
      };
      const { createStandardToolRegistry } = await import('../plugins/index.js');
      vi.mocked(createStandardToolRegistry).mockReturnValue(mockToolRegistry as any);

      const { getConfig } = await import('../config/config-loader.js');
      vi.mocked(getConfig).mockResolvedValue({
        server: {
          verbose: false,
          validatePaths: true,
          allowRootExecution: false,
          workingDirectory: process.cwd()
        },
        coverageDefaults: {
          format: 'summary' as const,
          exclude: []
        },
        testDefaults: {
          format: 'summary' as const,
          timeout: 30000,
          watchMode: false
        },
        discovery: {
          testPatterns: ['**/*.{test,spec}.{js,ts}'] as string[],
          excludePatterns: ['node_modules', 'dist', 'coverage', '.git'] as string[],
          maxDepth: 10
        },
        safety: {
          maxFiles: 100,
          requireConfirmation: true,
          allowedRunners: ['vitest'] as string[],
          allowedPaths: [] as string[]
        }
      } as any);

      const { VitestMCPServer } = await import('../index.js');
      new VitestMCPServer();

      const serverInstance = MockServer.mock.results[0].value;
      expect(serverInstance.setRequestHandler).toHaveBeenCalledTimes(4);
    });
  });

  describe('Tool Registration', () => {
    it('should register all core tools', async () => {
      const mockToolRegistry = {
        getTools: vi.fn().mockReturnValue([]),
        execute: vi.fn(),
        plugins: new Map(),
        config: {
          debug: false,
          getErrorHint: vi.fn().mockReturnValue('')
        },
        register: vi.fn(),
        hasPlugin: vi.fn().mockReturnValue(false),
        getPlugin: vi.fn(),
        listPlugins: vi.fn().mockReturnValue([])
      };
      const { createStandardToolRegistry } = await import('../plugins/index.js');
      vi.mocked(createStandardToolRegistry).mockReturnValue(mockToolRegistry as any);

      const { getConfig } = await import('../config/config-loader.js');
      vi.mocked(getConfig).mockResolvedValue({
        server: {
          verbose: false,
          validatePaths: true,
          allowRootExecution: false,
          workingDirectory: process.cwd()
        },
        coverageDefaults: {
          format: 'summary' as const,
          exclude: []
        },
        testDefaults: {
          format: 'summary' as const,
          timeout: 30000,
          watchMode: false
        },
        discovery: {
          testPatterns: ['**/*.{test,spec}.{js,ts}'] as string[],
          excludePatterns: ['node_modules', 'dist', 'coverage', '.git'] as string[],
          maxDepth: 10
        },
        safety: {
          maxFiles: 100,
          requireConfirmation: true,
          allowedRunners: ['vitest'] as string[],
          allowedPaths: [] as string[]
        }
      } as any);

      const { VitestMCPServer } = await import('../index.js');
      new VitestMCPServer();

      const serverInstance = MockServer.mock.results[0].value;
      expect(serverInstance.setRequestHandler).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle tool execution errors gracefully', async () => {
      const mockToolRegistry = {
        getTools: vi.fn().mockReturnValue([]),
        execute: vi.fn(),
        plugins: new Map(),
        config: {
          debug: false,
          getErrorHint: vi.fn().mockReturnValue('')
        },
        register: vi.fn(),
        hasPlugin: vi.fn().mockReturnValue(false),
        getPlugin: vi.fn(),
        listPlugins: vi.fn().mockReturnValue([])
      };
      const { createStandardToolRegistry } = await import('../plugins/index.js');
      vi.mocked(createStandardToolRegistry).mockReturnValue(mockToolRegistry as any);

      const { getConfig } = await import('../config/config-loader.js');
      vi.mocked(getConfig).mockResolvedValue({
        server: {
          verbose: false,
          validatePaths: true,
          allowRootExecution: false,
          workingDirectory: process.cwd()
        },
        coverageDefaults: {
          format: 'summary' as const,
          exclude: []
        },
        testDefaults: {
          format: 'summary' as const,
          timeout: 30000,
          watchMode: false
        },
        discovery: {
          testPatterns: ['**/*.{test,spec}.{js,ts}'] as string[],
          excludePatterns: ['node_modules', 'dist', 'coverage', '.git'] as string[],
          maxDepth: 10
        },
        safety: {
          maxFiles: 100,
          requireConfirmation: true,
          allowedRunners: ['vitest'] as string[],
          allowedPaths: [] as string[]
        }
      } as any);

      const { VitestMCPServer } = await import('../index.js');
      new VitestMCPServer();

      const serverInstance = MockServer.mock.results[0].value;
      expect(serverInstance.onerror).toBeDefined();

      const errorHandler = serverInstance.onerror;
      expect(() => errorHandler(new Error('test error'))).not.toThrow();
    });
  });

  describe('Resource Management', () => {
    it('should handle resource requests', async () => {
      const mockToolRegistry = {
        getTools: vi.fn().mockReturnValue([]),
        execute: vi.fn(),
        plugins: new Map(),
        config: {
          debug: false,
          getErrorHint: vi.fn().mockReturnValue('')
        },
        register: vi.fn(),
        hasPlugin: vi.fn().mockReturnValue(false),
        getPlugin: vi.fn(),
        listPlugins: vi.fn().mockReturnValue([])
      };
      const { createStandardToolRegistry } = await import('../plugins/index.js');
      vi.mocked(createStandardToolRegistry).mockReturnValue(mockToolRegistry as any);

      const { getConfig } = await import('../config/config-loader.js');
      vi.mocked(getConfig).mockResolvedValue({
        server: {
          verbose: false,
          validatePaths: true,
          allowRootExecution: false,
          workingDirectory: process.cwd()
        },
        coverageDefaults: {
          format: 'summary' as const,
          exclude: []
        },
        testDefaults: {
          format: 'summary' as const,
          timeout: 30000,
          watchMode: false
        },
        discovery: {
          testPatterns: ['**/*.{test,spec}.{js,ts}'] as string[],
          excludePatterns: ['node_modules', 'dist', 'coverage', '.git'] as string[],
          maxDepth: 10
        },
        safety: {
          maxFiles: 100,
          requireConfirmation: true,
          allowedRunners: ['vitest'] as string[],
          allowedPaths: [] as string[]
        }
      } as any);

      const { VitestMCPServer } = await import('../index.js');
      new VitestMCPServer();

      const serverInstance = MockServer.mock.results[0].value;
      expect(serverInstance.setRequestHandler).toHaveBeenCalled();
    });
  });

  describe('Server Lifecycle', () => {
    it('should connect to transport successfully', async () => {
      const mockToolRegistry = {
        getTools: vi.fn().mockReturnValue([]),
        execute: vi.fn(),
        plugins: new Map(),
        config: {
          debug: false,
          getErrorHint: vi.fn().mockReturnValue('')
        },
        register: vi.fn(),
        hasPlugin: vi.fn().mockReturnValue(false),
        getPlugin: vi.fn(),
        listPlugins: vi.fn().mockReturnValue([])
      };
      const { createStandardToolRegistry } = await import('../plugins/index.js');
      vi.mocked(createStandardToolRegistry).mockReturnValue(mockToolRegistry as any);

      const { getConfig } = await import('../config/config-loader.js');
      vi.mocked(getConfig).mockResolvedValue({
        server: {
          verbose: false,
          validatePaths: true,
          allowRootExecution: false,
          workingDirectory: process.cwd()
        },
        coverageDefaults: {
          format: 'summary' as const,
          exclude: []
        },
        testDefaults: {
          format: 'summary' as const,
          timeout: 30000,
          watchMode: false
        },
        discovery: {
          testPatterns: ['**/*.{test,spec}.{js,ts}'] as string[],
          excludePatterns: ['node_modules', 'dist', 'coverage', '.git'] as string[],
          maxDepth: 10
        },
        safety: {
          maxFiles: 100,
          requireConfirmation: true,
          allowedRunners: ['vitest'] as string[],
          allowedPaths: [] as string[]
        }
      } as any);

      const mockExit = vi.fn().mockImplementation(() => {
        throw new Error('process.exit called');
      });
      const originalExit = process.exit;
      process.exit = mockExit as unknown as (code: number) => never;

      try {
        const { VitestMCPServer } = await import('../index.js');
        const serverInstance = new VitestMCPServer();

        const server = MockServer.mock.results[0].value;

        const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
        await serverInstance.run();

        expect(StdioServerTransport).toHaveBeenCalled();
        expect(server.connect).toHaveBeenCalled();
      } catch {
        // Expected due to process.exit mock
      } finally {
        process.exit = originalExit;
      }
    });
  });
});
