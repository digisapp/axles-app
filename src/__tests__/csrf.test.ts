import { describe, it, expect } from 'vitest';
import { generateCsrfToken } from '@/lib/security/csrf';

describe('CSRF', () => {
  describe('generateCsrfToken', () => {
    it('generates a 64-character hex string', () => {
      const token = generateCsrfToken();
      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[0-9a-f]+$/);
    });

    it('generates unique tokens', () => {
      const token1 = generateCsrfToken();
      const token2 = generateCsrfToken();
      expect(token1).not.toBe(token2);
    });
  });
});
