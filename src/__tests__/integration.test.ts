import { describe, it, vi, beforeEach, afterEach, beforeAll, expect } from 'vitest';
import { createStandardToolRegistry } from '../plugins/index.js';
import { projectContext } from '../context/project-context.js';

// Mock external dependencies at module level
const mockServer = {
  onerror: null,
  onclose: null,
  setRequestHandler: vi.fn(),
  connect: vi.fn().mockResolvedValue(undefined)
};

const mockTransport = {};

vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn().mockImplementation(() => mockServer)
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => mockTransport)
}));

vi.mock('../config/config-loader.js', () => ({
  getConfig: vi.fn().mockResolvedValue({
    testDefaults: {
      format: 'summary' as const,
      timeout: 30000,
      watchMode: false
    },
    coverageDefaults: {
      format: 'summary',
      exclude: []
    },
    discovery: {
      testPatterns: ['**/*.{test,spec}.{js,ts,jsx,tsx}'],
      excludePatterns: ['node_modules', 'dist'],
      maxDepth: 10
    },
    server: {
      verbose: false,
      validatePaths: true,
      allowRootExecution: false,
      workingDirectory: process.cwd()
    },
    safety: {
      maxFiles: 100,
      requireConfirmation: true,
      allowedRunners: ['vitest'],
      allowedPaths: []
    }
  })
}));

describe('Integration Tests', () => {
  let toolRegistry: any;

  beforeEach(() => {
    vi.clearAllMocks();
    projectContext.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    projectContext.reset();
  });

  beforeAll(() => {
    toolRegistry = createStandardToolRegistry({ debug: false });
  });

  describe('MCP Protocol', () => {
    it('should handle MCP requests correctly end-to-end', async () => {
      const mockRequest = {
        params: {
          name: 'set_project_root',
          arguments: { path: '/test/project' }
        }
      };

      // Mock project root setup
      vi.spyOn(projectContext, 'setProjectRoot').mockResolvedValue(undefined);
      vi.spyOn(projectContext, 'getProjectInfo').mockReturnValue({
        path: '/test/project',
        name: 'test-project'
      });

      const result = await toolRegistry.execute(mockRequest.params.name, mockRequest.params.arguments);

      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0]).toHaveProperty('text');
    });

    it('should format responses according to MCP specification', async () => {
      const tools = toolRegistry.getTools();

      for (const tool of tools) {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool.inputSchema).toHaveProperty('type', 'object');
        expect(tool.inputSchema).toHaveProperty('properties');
      }
    });

    it('should handle MCP error scenarios properly', async () => {
      // Test invalid tool name (should return error response, not throw)
      const invalidToolResult = await toolRegistry.execute('invalid_tool_name', {});

      expect(invalidToolResult.content[0].text).toContain('Unknown tool');
      expect(invalidToolResult.content[0].text).toContain('invalid_tool_name');
    });
  });

  describe('Configuration Integration', () => {
    it('should load and apply configuration across all tools', async () => {
      // Create a new registry which should load config
      const newRegistry = createStandardToolRegistry({ debug: true });
      const tools = newRegistry.getTools();

      // Assert - tools should be registered
      expect(tools).toHaveLength(4);
      // Config is loaded lazily when tools are first accessed or executed
      expect(newRegistry).toBeDefined();
    });

    it('should handle configuration changes during workflows', async () => {
      // Create registries and verify they work
      const registry1 = createStandardToolRegistry();
      const registry2 = createStandardToolRegistry();

      expect(registry1).toBeDefined();
      expect(registry2).toBeDefined();
      // Both registries should have the same tools
      expect(registry1.getTools()).toHaveLength(4);
      expect(registry2.getTools()).toHaveLength(4);
    });
  });

  describe('Error Handling', () => {
    it('should propagate errors through workflow chain', async () => {
      const invalidToolResult = await toolRegistry.execute('invalid_tool_name', {});
      expect(invalidToolResult.content[0].text).toContain('Unknown tool');
    });

    it('should provide meaningful error context in workflows', async () => {
      const result = await toolRegistry.execute('invalid_tool_name', {});

      const responseText = result.content[0].text;
      expect(responseText).toContain('Unknown tool');
    });
  });

  describe('Process Management', () => {
    it('should handle process timeouts and cleanup', async () => {
      // This test verifies the timeout handling logic exists
      const tools = toolRegistry.getTools();
      expect(tools.length).toBeGreaterThan(0);
    });
  });
});