import { describe, it } from 'vitest';
import { expect } from 'vitest';
import { normalizePath } from '../transformers/path-normalizer.js';

describe('Path Normalizer', () => {
  const projectDir = '/Users/shelfwood/Projects/myapp';

  describe('Basic normalization', () => {
    it('should normalize absolute path to relative', () => {
      const result = normalizePath(
        '/Users/shelfwood/Projects/myapp/src/index.ts',
        projectDir
      );
      expect(result).toBe('src/index.ts');
    });

    it('should normalize nested paths', () => {
      const result = normalizePath(
        '/Users/shelfwood/Projects/myapp/src/components/Button.tsx',
        projectDir
      );
      expect(result).toBe('src/components/Button.tsx');
    });

    it('should handle root-level files', () => {
      const result = normalizePath(
        '/Users/shelfwood/Projects/myapp/package.json',
        projectDir
      );
      expect(result).toBe('package.json');
    });
  });

  describe('Edge cases', () => {
    it('should return "." for project root', () => {
      const result = normalizePath(projectDir, projectDir);
      expect(result).toBe('.');
    });

    it('should return original path if outside project', () => {
      const outsidePath = '/Users/shelfwood/other-project/file.js';
      const result = normalizePath(outsidePath, projectDir);
      expect(result).toBe(outsidePath);
    });

    it('should handle project dir with trailing slash', () => {
      const result = normalizePath(
        '/Users/shelfwood/Projects/myapp/src/index.ts',
        '/Users/shelfwood/Projects/myapp/'
      );
      expect(result).toBe('src/index.ts');
    });

    it('should handle Windows-style paths', () => {
      const result = normalizePath(
        'C:\\Users\\user\\projects\\myapp\\src\\index.ts',
        'C:\\Users\\user\\projects\\myapp'
      );
      expect(result).toBe('src\\index.ts');
    });
  });

  describe('Invalid input', () => {
    it('should return original path if absolutePath is null', () => {
      const result = normalizePath(null, projectDir);
      expect(result).toBe(null);
    });

    it('should return original path if projectDir is null', () => {
      const absolutePath = '/Users/shelfwood/Projects/myapp/src/index.ts';
      const result = normalizePath(absolutePath, null);
      expect(result).toBe(absolutePath);
    });

    it('should return original path if both are null', () => {
      const result = normalizePath(null, null);
      expect(result).toBe(null);
    });
  });
});
