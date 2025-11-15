import { describe, it } from 'vitest';
import { expect } from 'vitest';
import { categorizeCommand } from '../transformers/command-categorizer.js';

describe('Command Categorizer', () => {
  describe('Git operations', () => {
    it('should categorize git commands', () => {
      expect(categorizeCommand('git status')).toBe('git');
      expect(categorizeCommand('git commit -m "msg"')).toBe('git');
      expect(categorizeCommand('git push origin main')).toBe('git');
    });
  });

  describe('Package managers', () => {
    it('should categorize npm commands', () => {
      expect(categorizeCommand('npm install')).toBe('npm');
      expect(categorizeCommand('yarn add package')).toBe('npm');
      expect(categorizeCommand('pnpm install')).toBe('npm');
      expect(categorizeCommand('bun install')).toBe('npm');
    });

    it('should categorize python package managers', () => {
      expect(categorizeCommand('pip install requests')).toBe('python');
      expect(categorizeCommand('poetry add package')).toBe('python');
      expect(categorizeCommand('pipenv install')).toBe('python');
    });

    it('should categorize php package managers', () => {
      expect(categorizeCommand('composer install')).toBe('php');
      expect(categorizeCommand('composer require vendor/package')).toBe('php');
    });

    it('should categorize brew', () => {
      expect(categorizeCommand('brew install wget')).toBe('brew');
      expect(categorizeCommand('brew update')).toBe('brew');
    });
  });

  describe('Language runtimes', () => {
    it('should categorize node runtime', () => {
      expect(categorizeCommand('node index.js')).toBe('nodejs');
      expect(categorizeCommand('deno run main.ts')).toBe('nodejs');
      expect(categorizeCommand('bun run script.js')).toBe('nodejs');
    });

    it('should categorize python runtime', () => {
      expect(categorizeCommand('python script.py')).toBe('python');
      expect(categorizeCommand('python -m module')).toBe('python');
    });

    it('should categorize php runtime', () => {
      expect(categorizeCommand('php script.php')).toBe('php');
      expect(categorizeCommand('artisan migrate')).toBe('php');
    });

    it('should categorize ruby runtime', () => {
      expect(categorizeCommand('ruby script.rb')).toBe('ruby');
    });
  });

  describe('Build tools', () => {
    it('should categorize build commands', () => {
      expect(categorizeCommand('make all')).toBe('build');
      expect(categorizeCommand('cmake ..')).toBe('build');
      expect(categorizeCommand('ninja build')).toBe('build');
    });

    it('should categorize bundlers', () => {
      expect(categorizeCommand('webpack build')).toBe('bundler');
      expect(categorizeCommand('vite build')).toBe('bundler');
      expect(categorizeCommand('rollup -c')).toBe('bundler');
      expect(categorizeCommand('esbuild src/index.js')).toBe('bundler');
    });
  });

  describe('Testing', () => {
    it('should categorize test runners', () => {
      expect(categorizeCommand('jest tests/')).toBe('test');
      expect(categorizeCommand('vitest run')).toBe('test');
      expect(categorizeCommand('pytest tests/')).toBe('test');
      expect(categorizeCommand('phpunit tests/')).toBe('test');
      expect(categorizeCommand('cargo test')).toBe('test');
    });
  });

  describe('Filesystem', () => {
    it('should categorize filesystem commands', () => {
      expect(categorizeCommand('find . -name "*.js"')).toBe('filesystem');
      expect(categorizeCommand('ls -la')).toBe('filesystem');
      expect(categorizeCommand('tree src/')).toBe('filesystem');
      expect(categorizeCommand('du -sh .')).toBe('filesystem');
      expect(categorizeCommand('df -h')).toBe('filesystem');
    });

    it('should categorize search commands', () => {
      expect(categorizeCommand('grep "pattern" file.txt')).toBe('search');
      expect(categorizeCommand('rg "pattern"')).toBe('search');
      expect(categorizeCommand('ag "search"')).toBe('search');
      expect(categorizeCommand('ack "term"')).toBe('search');
    });

    it('should categorize file viewing commands', () => {
      expect(categorizeCommand('cat file.txt')).toBe('fileview');
      expect(categorizeCommand('head -n 10 file.txt')).toBe('fileview');
      expect(categorizeCommand('tail -f log.txt')).toBe('fileview');
      expect(categorizeCommand('less file.txt')).toBe('fileview');
      expect(categorizeCommand('more file.txt')).toBe('fileview');
    });
  });

  describe('System', () => {
    it('should categorize process commands', () => {
      expect(categorizeCommand('ps aux')).toBe('process');
      expect(categorizeCommand('top')).toBe('process');
      expect(categorizeCommand('htop')).toBe('process');
      expect(categorizeCommand('kill 1234')).toBe('process');
    });

    it('should categorize network commands', () => {
      expect(categorizeCommand('curl https://example.com')).toBe('network');
      expect(categorizeCommand('wget https://example.com')).toBe('network');
      expect(categorizeCommand('http GET https://api.example.com')).toBe('network');
    });
  });

  describe('Edge cases', () => {
    it('should return shell for unknown commands', () => {
      expect(categorizeCommand('unknown-command')).toBe('shell');
      expect(categorizeCommand('custom-tool --flag')).toBe('shell');
    });

    it('should handle empty or invalid input', () => {
      expect(categorizeCommand('')).toBe('shell');
      expect(categorizeCommand(null)).toBe('shell');
      expect(categorizeCommand(undefined)).toBe('shell');
    });

    it('should handle commands with complex arguments', () => {
      expect(categorizeCommand('git commit -m "Add feature" --no-verify')).toBe('git');
      expect(categorizeCommand('npm install --save-dev --legacy-peer-deps')).toBe('npm');
    });
  });
});
