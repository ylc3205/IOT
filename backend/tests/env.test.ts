import { describe, it, expect } from 'vitest';
import { z } from 'zod';

describe('Environment Configuration Validation (CFG-01 Audit Fix)', () => {
  const portSchema = z
    .string()
    .default('5000')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive().max(65535));

  it('should accept valid numeric port string', () => {
    const result = portSchema.safeParse('5000');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(5000);
    }
  });

  it('should reject non-numeric port string (e.g., "abc") with validation error', () => {
    const result = portSchema.safeParse('abc');
    expect(result.success).toBe(false);
  });

  it('should reject negative or zero port numbers', () => {
    expect(portSchema.safeParse('-1').success).toBe(false);
    expect(portSchema.safeParse('0').success).toBe(false);
  });

  it('should reject port numbers exceeding 65535', () => {
    expect(portSchema.safeParse('70000').success).toBe(false);
  });
});

