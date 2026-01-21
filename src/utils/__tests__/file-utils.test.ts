import { describe, it, expect, vi, beforeEach } from 'vitest';
import { promises as fs } from 'fs';
import type { Stats } from 'fs';
import { join, resolve } from 'path';

// Mock Dirent interface for testing
interface MockDirent {
  name: string;
  isDirectory(): boolean;
  isFile(): boolean;
}
import {
  fileExists,
  isDirectory,
  findTestFiles,
  findProjectRoot
} from '../file-utils';

vi.mock('fs', () => ({
  promises: {
    access: vi.fn(),
    stat: vi.fn(),
    readdir: vi.fn()
  }
}));

describe('file-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fileExists', () => {
    it('should return true when file exists', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const result = await fileExists('/path/to/file');

      expect(result).toBe(true);
      expect(fs.access).toHaveBeenCalledWith('/path/to/file');
    });

    it('should return false when file does not exist', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      const result = await fileExists('/path/to/nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('isDirectory', () => {
    it('should return true for directories', async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true
      } as Stats);

      const result = await isDirectory('/path/to/dir');

      expect(result).toBe(true);
      expect(fs.stat).toHaveBeenCalledWith('/path/to/dir');
    });

    it('should return false for files', async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => false
      } as Stats);

      const result = await isDirectory('/path/to/file');

      expect(result).toBe(false);
    });

    it('should return false when stat fails', async () => {
      vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT'));

      const result = await isDirectory('/path/to/nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('findTestFiles', () => {
    it('should find test files recursively', async () => {
      // Root level: file.spec.js, file.test.ts
      // src level: unit.test.js
      const mockRootEntries = [
        { name: 'src', isDirectory: () => true, isFile: () => false },
        { name: 'file.spec.js', isDirectory: () => false, isFile: () => true },
        { name: 'file.test.ts', isDirectory: () => false, isFile: () => true }
      ] as unknown as MockDirent[];

      // /project/src contains unit.test.js
      const mockSrcEntries = [
        { name: 'unit.test.js', isDirectory: () => false, isFile: () => true }
      ] as unknown as MockDirent[];

      vi.mocked(fs.readdir)
        .mockResolvedValueOnce(mockRootEntries as any)  // /project
        .mockResolvedValueOnce(mockSrcEntries as any);  // /project/src

      const result = await findTestFiles('/project');

      expect(result).toHaveLength(3);
      // Results are sorted alphabetically
      expect(result[0].relativePath).toBe('file.spec.js');
      expect(result[1].relativePath).toBe('file.test.ts');
      expect(result[2].relativePath).toBe(join('src', 'unit.test.js'));
    });

    it('should determine test types correctly', async () => {
      const mockEntries = [
        { name: 'unit.test.ts', isDirectory: () => false, isFile: () => true },
        { name: 'e2e', isDirectory: () => true, isFile: () => false },
        { name: 'integration', isDirectory: () => true, isFile: () => false }
      ] as unknown as MockDirent[];

      const mockE2EEntries = [
        { name: 'app.test.ts', isDirectory: () => false, isFile: () => true }
      ] as unknown as MockDirent[];

      const mockIntegrationEntries = [
        { name: 'api.test.ts', isDirectory: () => false, isFile: () => true }
      ] as unknown as MockDirent[];

      vi.mocked(fs.readdir)
        .mockResolvedValueOnce(mockEntries as any)
        .mockResolvedValueOnce(mockE2EEntries as any)
        .mockResolvedValueOnce(mockIntegrationEntries as any);

      const result = await findTestFiles('/project');

      expect(result.find(f => f.relativePath === 'unit.test.ts')?.type).toBe('unit');
      expect(result.find(f => f.relativePath.includes('e2e'))?.type).toBe('e2e');
      expect(result.find(f => f.relativePath.includes('integration'))?.type).toBe('integration');
    });

    it('should skip excluded directories', async () => {
      const mockEntries = [
        { name: 'node_modules', isDirectory: () => true, isFile: () => false },
        { name: 'dist', isDirectory: () => true, isFile: () => false },
        { name: 'build', isDirectory: () => true, isFile: () => false },
        { name: '.git', isDirectory: () => true, isFile: () => false },
        { name: 'test.spec.ts', isDirectory: () => false, isFile: () => true }
      ] as unknown as MockDirent[];

      vi.mocked(fs.readdir).mockResolvedValueOnce(mockEntries as any);

      const result = await findTestFiles('/project');

      expect(result).toHaveLength(1);
      expect(result[0].relativePath).toBe('test.spec.ts');
      expect(fs.readdir).toHaveBeenCalledTimes(1);
    });

    it('should handle read errors gracefully', async () => {
      vi.mocked(fs.readdir).mockRejectedValue(new Error('Permission denied'));

      const result = await findTestFiles('/restricted');

      expect(result).toEqual([]);
      expect(fs.readdir).toHaveBeenCalledWith('/restricted', { withFileTypes: true });
    });
  });

  describe('findProjectRoot', () => {
    it('should find project root with package.json', async () => {
      const originalCwd = process.cwd;
      process.cwd = vi.fn().mockReturnValue('/project/src/utils');

      vi.mocked(fs.access)
        .mockRejectedValueOnce(new Error('Not found'))
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce(undefined);

      const result = await findProjectRoot();

      expect(result).toBe(resolve('/project'));
      process.cwd = originalCwd;
    });

    it('should return start path if no package.json found', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('Not found'));

      const result = await findProjectRoot('/some/deep/path');

      expect(result).toBe('/some/deep/path');
    });

    it('should handle root directory correctly', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('Not found'));

      const result = await findProjectRoot('/');

      expect(result).toBe('/');
    });
  });
});
