/**
 * Unit tests for @/lib/utils.ts
 *
 * Tests cover:
 * 1. cn() - Tailwind class merging via clsx + twMerge
 * 2. formatDate() - Relative date formatting
 * 3. formatMarketCap() - Market cap number formatting with B/M/K suffixes
 * 4. formatROI() - ROI percentage formatting
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cn, formatDate, formatMarketCap, formatROI } from '@/lib/utils';

// ============================================================================
// cn() tests
// ============================================================================

describe('cn', () => {
  it('should merge simple class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should handle a single class', () => {
    expect(cn('px-4')).toBe('px-4');
  });

  it('should handle no arguments', () => {
    expect(cn()).toBe('');
  });

  it('should handle conditional classes via clsx syntax', () => {
    const result = cn('base', false && 'hidden', true && 'visible');
    expect(result).toBe('base visible');
  });

  it('should handle object syntax from clsx', () => {
    const result = cn({ 'bg-red-500': true, 'bg-blue-500': false });
    expect(result).toBe('bg-red-500');
  });

  it('should handle array syntax', () => {
    const result = cn(['px-2', 'py-4']);
    expect(result).toBe('px-2 py-4');
  });

  it('should merge conflicting Tailwind classes (twMerge)', () => {
    // twMerge should keep the last conflicting class
    const result = cn('px-2', 'px-4');
    expect(result).toBe('px-4');
  });

  it('should merge conflicting background colors', () => {
    const result = cn('bg-red-500', 'bg-blue-500');
    expect(result).toBe('bg-blue-500');
  });

  it('should handle undefined and null values', () => {
    const result = cn('base', undefined, null, 'end');
    expect(result).toBe('base end');
  });

  it('should handle mixed clsx features with Tailwind merging', () => {
    const isActive = true;
    const result = cn(
      'text-sm font-medium',
      isActive && 'text-blue-500',
      { 'bg-white': true, 'bg-black': false }
    );
    expect(result).toBe('text-sm font-medium text-blue-500 bg-white');
  });

  it('should handle empty strings', () => {
    const result = cn('', 'px-4', '');
    expect(result).toBe('px-4');
  });
});

// ============================================================================
// formatDate() tests
// ============================================================================

describe('formatDate', () => {
  beforeEach(() => {
    // Fix the current time to ensure deterministic tests
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should format a recent date as relative time', () => {
    const result = formatDate('2025-06-15T11:00:00Z');
    expect(result).toContain('ago');
  });

  it('should format a date from days ago', () => {
    const result = formatDate('2025-06-10T12:00:00Z');
    expect(result).toContain('ago');
    expect(result).toContain('5 days');
  });

  it('should format a date from months ago', () => {
    const result = formatDate('2025-03-15T12:00:00Z');
    expect(result).toContain('ago');
    expect(result).toContain('3 months');
  });

  it('should include "ago" suffix', () => {
    const result = formatDate('2025-06-14T12:00:00Z');
    expect(result).toMatch(/ago$/);
  });

  it('should return the original string for an invalid date', () => {
    const result = formatDate('not-a-date');
    // date-fns may throw on truly invalid dates, which the catch handles
    // However, new Date('not-a-date') returns Invalid Date
    // formatDistanceToNow with Invalid Date throws, so the catch returns the original string
    expect(result).toBe('not-a-date');
  });

  it('should handle ISO 8601 format', () => {
    const result = formatDate('2025-06-15T10:30:00.000Z');
    expect(result).toContain('ago');
  });

  it('should handle dates in the far past', () => {
    const result = formatDate('2020-01-01T00:00:00Z');
    expect(result).toContain('ago');
    expect(result).toContain('5 years');
  });

  it('should handle an empty string', () => {
    const result = formatDate('');
    // new Date('') is Invalid Date, formatDistanceToNow throws -> catch returns ''
    expect(result).toBe('');
  });
});

// ============================================================================
// formatMarketCap() tests
// ============================================================================

describe('formatMarketCap', () => {
  // Billions
  it('should format values >= 1 billion with B suffix', () => {
    expect(formatMarketCap(1_000_000_000)).toBe('$1.00B');
  });

  it('should format multi-billion values', () => {
    expect(formatMarketCap(5_500_000_000)).toBe('$5.50B');
  });

  it('should format fractional billions with 2 decimal places', () => {
    expect(formatMarketCap(1_234_567_890)).toBe('$1.23B');
  });

  // Millions
  it('should format values >= 1 million with M suffix', () => {
    expect(formatMarketCap(1_000_000)).toBe('$1.00M');
  });

  it('should format multi-million values', () => {
    expect(formatMarketCap(42_500_000)).toBe('$42.50M');
  });

  it('should format fractional millions with 2 decimal places', () => {
    expect(formatMarketCap(999_999_999)).toBe('$1000.00M');
  });

  // Thousands
  it('should format values >= 1 thousand with K suffix', () => {
    expect(formatMarketCap(1_000)).toBe('$1.00K');
  });

  it('should format multi-thousand values', () => {
    expect(formatMarketCap(50_000)).toBe('$50.00K');
  });

  it('should format fractional thousands', () => {
    expect(formatMarketCap(1_500)).toBe('$1.50K');
  });

  // Below thousand
  it('should format values below 1000 as plain dollars', () => {
    expect(formatMarketCap(500)).toBe('$500.00');
  });

  it('should format zero', () => {
    expect(formatMarketCap(0)).toBe('$0.00');
  });

  it('should format small decimal values', () => {
    expect(formatMarketCap(0.5)).toBe('$0.50');
  });

  // Edge cases: undefined and null
  it('should treat undefined as 0', () => {
    expect(formatMarketCap(undefined)).toBe('$0.00');
  });

  it('should treat null as 0', () => {
    expect(formatMarketCap(null)).toBe('$0.00');
  });

  // Boundary values
  it('should format exactly 999 as plain dollars', () => {
    expect(formatMarketCap(999)).toBe('$999.00');
  });

  it('should format exactly 999,999 with K suffix', () => {
    expect(formatMarketCap(999_999)).toBe('$1000.00K');
  });

  it('should format negative values as plain dollars', () => {
    // Negative values fall through all conditions
    expect(formatMarketCap(-100)).toBe('$-100.00');
  });
});

// ============================================================================
// formatROI() tests
// ============================================================================

describe('formatROI', () => {
  it('should format positive ROI as percentage', () => {
    expect(formatROI(0.5)).toBe('50.0%');
  });

  it('should format 100% ROI', () => {
    expect(formatROI(1.0)).toBe('100.0%');
  });

  it('should format small ROI values', () => {
    expect(formatROI(0.05)).toBe('5.0%');
  });

  it('should format very small ROI with one decimal place', () => {
    expect(formatROI(0.001)).toBe('0.1%');
  });

  it('should format zero ROI', () => {
    expect(formatROI(0)).toBe('0.0%');
  });

  it('should format negative ROI', () => {
    expect(formatROI(-0.25)).toBe('-25.0%');
  });

  it('should format large ROI values (>100%)', () => {
    expect(formatROI(5.0)).toBe('500.0%');
  });

  it('should treat undefined as 0', () => {
    expect(formatROI(undefined)).toBe('0.0%');
  });

  it('should treat null as 0', () => {
    expect(formatROI(null)).toBe('0.0%');
  });

  it('should format fractional percentages with one decimal', () => {
    expect(formatROI(0.1234)).toBe('12.3%');
  });

  it('should round correctly', () => {
    // 0.1255 * 100 = 12.55 -> toFixed(1) = '12.6' (rounding up)
    expect(formatROI(0.1255)).toBe('12.6%');
  });
});
