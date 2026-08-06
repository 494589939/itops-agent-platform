import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validatePassword } from './passwordPolicy';

describe('passwordPolicy', () => {
  describe('validatePassword', () => {
    it('should accept a valid password', () => {
      const result = validatePassword('TestPass123!');
      expect(result.valid).toBe(true);
    });

    it('should accept a valid password with special chars', () => {
      const result = validatePassword('Abcdef1@');
      expect(result.valid).toBe(true);
    });

    it('should reject password shorter than 8 chars', () => {
      const result = validatePassword('Ab1!');
      expect(result.valid).toBe(false);
    });

    it('should reject password missing uppercase', () => {
      const result = validatePassword('testpass123!');
      expect(result.valid).toBe(false);
      expect(result.details?.uppercase).toBe(false);
    });

    it('should reject password missing lowercase', () => {
      const result = validatePassword('TESTPASS123!');
      expect(result.valid).toBe(false);
      expect(result.details?.lowercase).toBe(false);
    });

    it('should reject password missing number', () => {
      const result = validatePassword('TestPass!');
      expect(result.valid).toBe(false);
      expect(result.details?.number).toBe(false);
    });

    it('should reject password missing special char', () => {
      const result = validatePassword('TestPass123');
      expect(result.valid).toBe(false);
      expect(result.details?.special).toBe(false);
    });

    it('should return details with all validation flags', () => {
      const result = validatePassword('TestPass123!');
      expect(result.details).toBeDefined();
      expect(result.details?.minLength).toBe(true);
      expect(result.details?.uppercase).toBe(true);
      expect(result.details?.lowercase).toBe(true);
      expect(result.details?.number).toBe(true);
      expect(result.details?.special).toBe(true);
    });

    it('should return descriptive message for valid password', () => {
      const result = validatePassword('TestPass123!');
      expect(result.message).toBe('密码符合要求');
    });

    it('should return descriptive message for invalid password', () => {
      const result = validatePassword('short');
      expect(result.message).toContain('密码复杂度不足');
    });

    it('should reject empty password', () => {
      const result = validatePassword('');
      expect(result.valid).toBe(false);
    });
  });
});
