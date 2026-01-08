/**
 * Regex Tests
 */

import { describe, it, expect } from 'vitest';
import {
  escapeRegex,
  isDynamicClassString,
  createReplacementPatterns,
  CLASS_PATTERNS,
} from '../src/utils/regex.js';

describe('escapeRegex', () => {
  it('escapes special regex characters', () => {
    expect(escapeRegex('.')).toBe('\\.');
    expect(escapeRegex('*')).toBe('\\*');
    expect(escapeRegex('+')).toBe('\\+');
    expect(escapeRegex('?')).toBe('\\?');
    expect(escapeRegex('^')).toBe('\\^');
    expect(escapeRegex('$')).toBe('\\$');
    expect(escapeRegex('{')).toBe('\\{');
    expect(escapeRegex('}')).toBe('\\}');
    expect(escapeRegex('(')).toBe('\\(');
    expect(escapeRegex(')')).toBe('\\)');
    expect(escapeRegex('|')).toBe('\\|');
    expect(escapeRegex('[')).toBe('\\[');
    expect(escapeRegex(']')).toBe('\\]');
    expect(escapeRegex('\\')).toBe('\\\\');
  });

  it('leaves normal characters unchanged', () => {
    expect(escapeRegex('abc')).toBe('abc');
    expect(escapeRegex('flex')).toBe('flex');
    expect(escapeRegex('gap-2')).toBe('gap-2');
  });

  it('escapes mixed strings', () => {
    expect(escapeRegex('w-[100px]')).toBe('w-\\[100px\\]');
    expect(escapeRegex('bg-red-500/50')).toBe('bg-red-500/50');
  });

  it('handles empty string', () => {
    expect(escapeRegex('')).toBe('');
  });
});

describe('isDynamicClassString', () => {
  it('detects template literals', () => {
    expect(isDynamicClassString('flex ${isActive}')).toBe(true);
    expect(isDynamicClassString('flex ${isActive ? "active" : ""}')).toBe(true);
  });

  it('detects ternary operators', () => {
    expect(isDynamicClassString('isActive ? "active" : "inactive"')).toBe(true);
  });

  it('detects function calls', () => {
    expect(isDynamicClassString('cn(flex)')).toBe(true);
    expect(isDynamicClassString('clsx(styles)')).toBe(true);
  });

  it('detects variable references', () => {
    expect(isDynamicClassString('className')).toBe(true);
    expect(isDynamicClassString('styles')).toBe(true);
  });

  it('returns false for static class strings', () => {
    expect(isDynamicClassString('flex gap-2')).toBe(false);
    expect(isDynamicClassString('text-lg font-bold')).toBe(false);
    expect(isDynamicClassString('bg-red-500')).toBe(false);
  });

  it('handles edge cases', () => {
    expect(isDynamicClassString('')).toBe(false);
    expect(isDynamicClassString('flex-col')).toBe(false);
    expect(isDynamicClassString('items-center')).toBe(false);
  });
});

describe('CLASS_PATTERNS', () => {
  describe('jsxDouble', () => {
    it('matches className with double quotes', () => {
      const match = 'className="flex gap-2"'.match(CLASS_PATTERNS.jsxDouble);
      expect(match).not.toBeNull();
    });

    it('captures class string', () => {
      const regex = new RegExp(CLASS_PATTERNS.jsxDouble.source);
      const match = 'className="flex gap-2"'.match(regex);
      expect(match?.[1]).toBe('flex gap-2');
    });
  });

  describe('jsxSingle', () => {
    it('matches className with single quotes', () => {
      const match = "className='flex gap-2'".match(CLASS_PATTERNS.jsxSingle);
      expect(match).not.toBeNull();
    });
  });

  describe('htmlDouble', () => {
    it('matches class with double quotes', () => {
      const match = 'class="flex gap-2"'.match(CLASS_PATTERNS.htmlDouble);
      expect(match).not.toBeNull();
    });

    it('captures class string', () => {
      const regex = new RegExp(CLASS_PATTERNS.htmlDouble.source);
      const match = 'class="flex gap-2"'.match(regex);
      expect(match?.[1]).toBe('flex gap-2');
    });
  });

  describe('htmlSingle', () => {
    it('matches class with single quotes', () => {
      const match = "class='flex gap-2'".match(CLASS_PATTERNS.htmlSingle);
      expect(match).not.toBeNull();
    });
  });

  describe('createElementDouble', () => {
    it('matches createElement className', () => {
      const match = 'className:"flex gap-2"'.match(CLASS_PATTERNS.createElementDouble);
      expect(match).not.toBeNull();
    });
  });

  describe('minifiedComma', () => {
    it('matches minified className pattern', () => {
      const match = '"className","flex gap-2"'.match(CLASS_PATTERNS.minifiedComma);
      expect(match).not.toBeNull();
    });
  });
});

describe('createReplacementPatterns', () => {
  it('creates patterns for all variants', () => {
    const patterns = createReplacementPatterns('flex gap-2');
    // 7 base patterns + 2 HTML entity encoded patterns
    expect(patterns).toHaveLength(9);
  });

  it('creates working JSX double quote pattern', () => {
    const patterns = createReplacementPatterns('flex gap-2');
    const content = 'className="flex gap-2"';
    const matches = patterns.some((p) => p.test(content));
    expect(matches).toBe(true);
  });

  it('creates working HTML class pattern', () => {
    const patterns = createReplacementPatterns('flex gap-2');
    const content = 'class="flex gap-2"';
    const matches = patterns.some((p) => p.test(content));
    expect(matches).toBe(true);
  });

  it('escapes special characters in class strings', () => {
    const patterns = createReplacementPatterns('w-[100px]');
    // Should not throw
    expect(() => {
      patterns.forEach((p) => p.test('test'));
    }).not.toThrow();
  });

  it('preserves prefix in capture group', () => {
    const patterns = createReplacementPatterns('flex gap-2');
    const content = 'className="flex gap-2"';
    const replacement = 'cp-abc';

    let result = content;
    for (const pattern of patterns) {
      result = result.replace(pattern, `$1"${replacement}"`);
    }

    expect(result).toBe('className="cp-abc"');
  });
});
