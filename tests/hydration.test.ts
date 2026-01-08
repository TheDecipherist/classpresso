/**
 * Hydration Safety Tests
 *
 * Tests for preventing React/Next.js hydration mismatches caused by
 * transforming HTML patterns differently than JS dynamic patterns.
 */

import { describe, it, expect } from 'vitest';
import { extractDynamicBaseStrings, DYNAMIC_BASE_PATTERNS } from '../src/utils/regex.js';
import type { DynamicBasePattern, ClassMapping, ClasspressoConfig } from '../src/types/index.js';

describe('extractDynamicBaseStrings', () => {
  it('extracts base classes from className template literal with dynamic suffix', () => {
    const content = 'className:`px-4 py-2 rounded-lg ${active ? "bg-primary" : "bg-zinc"}`';
    const results = extractDynamicBaseStrings(content);
    expect(results).toHaveLength(1);
    expect(results[0]).toBe('px-4 py-2 rounded-lg');
  });

  it('extracts base classes from className= template literal (JSX)', () => {
    const content = 'className=`flex gap-2 ${isOpen ? "visible" : "hidden"}`';
    const results = extractDynamicBaseStrings(content);
    expect(results).toHaveLength(1);
    expect(results[0]).toBe('flex gap-2');
  });

  it('extracts multiple dynamic base patterns', () => {
    const content = `
      className:\`px-4 py-2 \${cond1}\`
      className:\`text-lg font-bold \${cond2}\`
    `;
    const results = extractDynamicBaseStrings(content);
    expect(results).toHaveLength(2);
    expect(results).toContain('px-4 py-2');
    expect(results).toContain('text-lg font-bold');
  });

  it('handles whitespace correctly', () => {
    const content = 'className:  `  flex   gap-2  ${dynamic}`';
    const results = extractDynamicBaseStrings(content);
    expect(results).toHaveLength(1);
    expect(results[0]).toBe('flex   gap-2');
  });

  it('returns empty array for static template literals', () => {
    const content = 'className:`flex gap-2`';
    const results = extractDynamicBaseStrings(content);
    expect(results).toHaveLength(0);
  });

  it('returns empty array for non-template class strings', () => {
    const content = 'className:"flex gap-2"';
    const results = extractDynamicBaseStrings(content);
    expect(results).toHaveLength(0);
  });
});

describe('DYNAMIC_BASE_PATTERNS', () => {
  it('matches className: template literals with dynamic parts', () => {
    const content = 'className:`base ${dynamic}`';
    const pattern = DYNAMIC_BASE_PATTERNS[0];
    pattern.lastIndex = 0;
    const match = pattern.exec(content);
    expect(match).not.toBeNull();
    expect(match?.[1]).toBe('base ');
  });

  it('matches className= template literals with dynamic parts', () => {
    const content = 'className=`base ${dynamic}`';
    const pattern = DYNAMIC_BASE_PATTERNS[1];
    pattern.lastIndex = 0;
    const match = pattern.exec(content);
    expect(match).not.toBeNull();
    expect(match?.[1]).toBe('base ');
  });

  it('does not match template literals without ${', () => {
    const content = 'className:`static only`';
    let hasMatch = false;
    for (const pattern of DYNAMIC_BASE_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.exec(content)) hasMatch = true;
    }
    expect(hasMatch).toBe(false);
  });
});

describe('hydration safety helpers', () => {
  // Helper to simulate isSupersetOfDynamicBase logic
  function isSupersetOfDynamicBase(
    classes: string[],
    dynamicBasePatterns: Map<string, DynamicBasePattern>
  ): boolean {
    const classSet = new Set(classes);
    for (const [, pattern] of dynamicBasePatterns) {
      const allBasePresent = pattern.baseClasses.every(cls => classSet.has(cls));
      if (allBasePresent && classes.length > pattern.baseClasses.length) {
        return true;
      }
    }
    return false;
  }

  // Helper to simulate matchesDynamicBase logic
  function matchesDynamicBase(
    classes: string[],
    dynamicBasePatterns: Map<string, DynamicBasePattern>
  ): boolean {
    const classSet = new Set(classes);
    for (const [, pattern] of dynamicBasePatterns) {
      if (classes.length !== pattern.baseClasses.length) continue;
      const allMatch = pattern.baseClasses.every(cls => classSet.has(cls));
      if (allMatch) return true;
    }
    return false;
  }

  it('detects HTML pattern as superset of JS dynamic base', () => {
    // JS has: className:`px-4 py-2 ${active ? "bg-blue" : "bg-red"}`
    // HTML has: class="px-4 py-2 bg-blue"
    const dynamicBasePatterns = new Map<string, DynamicBasePattern>([
      ['px-4 py-2', {
        baseClasses: ['px-4', 'py-2'],
        normalizedKey: 'px-4 py-2',
        locations: [{ filePath: 'app.js' }]
      }]
    ]);

    const htmlClasses = ['px-4', 'py-2', 'bg-blue'];
    expect(isSupersetOfDynamicBase(htmlClasses, dynamicBasePatterns)).toBe(true);
  });

  it('does not flag exact match as superset', () => {
    const dynamicBasePatterns = new Map<string, DynamicBasePattern>([
      ['px-4 py-2', {
        baseClasses: ['px-4', 'py-2'],
        normalizedKey: 'px-4 py-2',
        locations: [{ filePath: 'app.js' }]
      }]
    ]);

    const exactMatch = ['px-4', 'py-2'];
    expect(isSupersetOfDynamicBase(exactMatch, dynamicBasePatterns)).toBe(false);
  });

  it('does not flag unrelated patterns as superset', () => {
    const dynamicBasePatterns = new Map<string, DynamicBasePattern>([
      ['px-4 py-2', {
        baseClasses: ['px-4', 'py-2'],
        normalizedKey: 'px-4 py-2',
        locations: [{ filePath: 'app.js' }]
      }]
    ]);

    const unrelated = ['flex', 'gap-2', 'items-center'];
    expect(isSupersetOfDynamicBase(unrelated, dynamicBasePatterns)).toBe(false);
  });

  it('detects exact match with dynamic base', () => {
    const dynamicBasePatterns = new Map<string, DynamicBasePattern>([
      ['px-4 py-2', {
        baseClasses: ['px-4', 'py-2'],
        normalizedKey: 'px-4 py-2',
        locations: [{ filePath: 'app.js' }]
      }]
    ]);

    const exactMatch = ['px-4', 'py-2'];
    expect(matchesDynamicBase(exactMatch, dynamicBasePatterns)).toBe(true);
  });

  it('handles class order differences', () => {
    const dynamicBasePatterns = new Map<string, DynamicBasePattern>([
      ['px-4 py-2', {
        baseClasses: ['px-4', 'py-2'],
        normalizedKey: 'px-4 py-2',
        locations: [{ filePath: 'app.js' }]
      }]
    ]);

    // Same classes, different order
    const reordered = ['py-2', 'px-4'];
    expect(matchesDynamicBase(reordered, dynamicBasePatterns)).toBe(true);
  });
});

describe('hydration mismatch scenario', () => {
  it('identifies the problematic pattern from issue #423', () => {
    // This test documents the exact scenario from the issue
    // Server HTML: class="px-4 py-2 rounded-lg bg-primary-600 text-white"
    // Client JS: className:`px-4 py-2 rounded-lg ${active ? "bg-primary-600 text-white" : "bg-zinc-800"}`

    const jsContent = 'className:`px-4 py-2 rounded-lg ${active ? "bg-primary-600 text-white" : "bg-zinc-800"}`';
    const dynamicBases = extractDynamicBaseStrings(jsContent);

    expect(dynamicBases).toHaveLength(1);
    expect(dynamicBases[0]).toBe('px-4 py-2 rounded-lg');

    // The HTML pattern contains all base classes plus extra classes
    const htmlClasses = ['px-4', 'py-2', 'rounded-lg', 'bg-primary-600', 'text-white'];
    const baseClasses = dynamicBases[0].split(/\s+/).filter(Boolean);

    // All base classes should be present in HTML
    const htmlClassSet = new Set(htmlClasses);
    const allBasePresent = baseClasses.every(cls => htmlClassSet.has(cls));
    expect(allBasePresent).toBe(true);

    // HTML has more classes than base (superset)
    expect(htmlClasses.length).toBeGreaterThan(baseClasses.length);
  });
});
