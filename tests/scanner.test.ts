/**
 * Scanner Tests
 */

import { describe, it, expect } from 'vitest';
import {
  shouldExcludeClass,
  normalizeClassString,
  extractClassStrings,
  containsDynamicPrefix,
  isProperSubset,
  detectMergeablePatterns,
  isNonFlattenableClass,
} from '../src/core/scanner.js';
import { extractDynamicBaseStrings } from '../src/utils/regex.js';
import { DEFAULT_DYNAMIC_PREFIXES } from '../src/config.js';
import type { ExcludeConfig, ClassOccurrence } from '../src/types/index.js';

describe('shouldExcludeClass', () => {
  const exclude: ExcludeConfig = {
    prefixes: ['js-', 'data-'],
    suffixes: ['-handler', '-trigger'],
    classes: ['no-consolidate'],
    patterns: [/^qa-/, /^test-/],
  };

  it('excludes classes with matching prefix', () => {
    expect(shouldExcludeClass('js-onclick', exclude)).toBe(true);
    expect(shouldExcludeClass('data-testid', exclude)).toBe(true);
  });

  it('excludes classes with matching suffix', () => {
    expect(shouldExcludeClass('click-handler', exclude)).toBe(true);
    expect(shouldExcludeClass('modal-trigger', exclude)).toBe(true);
  });

  it('excludes exact class matches', () => {
    expect(shouldExcludeClass('no-consolidate', exclude)).toBe(true);
  });

  it('excludes classes matching regex patterns', () => {
    expect(shouldExcludeClass('qa-button', exclude)).toBe(true);
    expect(shouldExcludeClass('test-component', exclude)).toBe(true);
  });

  it('includes classes that do not match any exclusion', () => {
    expect(shouldExcludeClass('flex', exclude)).toBe(false);
    expect(shouldExcludeClass('text-lg', exclude)).toBe(false);
    expect(shouldExcludeClass('bg-gold', exclude)).toBe(false);
  });
});

describe('normalizeClassString', () => {
  const exclude: ExcludeConfig = {
    prefixes: ['js-'],
    suffixes: [],
    classes: [],
    patterns: [],
  };

  it('splits and sorts classes', () => {
    const result = normalizeClassString('flex gap-2 items-center', exclude);
    expect(result.normalized).toBe('flex gap-2 items-center');
    expect(result.classes).toEqual(['flex', 'gap-2', 'items-center']);
  });

  it('separates excluded classes', () => {
    const result = normalizeClassString('flex js-click gap-2', exclude);
    expect(result.classes).toEqual(['flex', 'gap-2']);
    expect(result.excludedClasses).toEqual(['js-click']);
  });

  it('handles multiple spaces', () => {
    const result = normalizeClassString('flex  gap-2   items-center', exclude);
    expect(result.classes).toHaveLength(3);
  });
});

describe('extractClassStrings', () => {
  it('extracts className from JSX double quotes', () => {
    const content = '<div className="flex gap-2">test</div>';
    const result = extractClassStrings(content, 'test.tsx');
    expect(result).toHaveLength(1);
    expect(result[0].classString).toBe('flex gap-2');
  });

  it('extracts className from JSX single quotes', () => {
    const content = "<div className='flex gap-2'>test</div>";
    const result = extractClassStrings(content, 'test.tsx');
    expect(result).toHaveLength(1);
    expect(result[0].classString).toBe('flex gap-2');
  });

  it('extracts class from HTML', () => {
    const content = '<div class="flex gap-2">test</div>';
    const result = extractClassStrings(content, 'test.html');
    expect(result).toHaveLength(1);
    expect(result[0].classString).toBe('flex gap-2');
  });

  it('skips dynamic class expressions', () => {
    const content = 'className={`flex ${isActive ? "active" : ""}`}';
    const result = extractClassStrings(content, 'test.tsx');
    expect(result).toHaveLength(0);
  });

  it('extracts multiple classes', () => {
    const content = `
      <div className="flex gap-2">
      <span className="text-lg font-bold">
    `;
    const result = extractClassStrings(content, 'test.tsx');
    expect(result).toHaveLength(2);
  });
});

describe('extractDynamicBaseStrings (hydration safety)', () => {
  it('extracts base classes from template literals with dynamic suffix', () => {
    const content = 'className:`px-4 py-2 ${active ? "bg-blue" : "bg-red"}`';
    const result = extractDynamicBaseStrings(content);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('px-4 py-2');
  });

  it('extracts from JSX template literal syntax', () => {
    const content = 'className=`flex items-center ${isOpen ? "visible" : "hidden"}`';
    const result = extractDynamicBaseStrings(content);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('flex items-center');
  });

  it('handles minified JS with multiple patterns', () => {
    const content = `
      className:\`px-4 py-2 \${a}\`,className:\`text-lg font-bold \${b}\`
    `;
    const result = extractDynamicBaseStrings(content);
    expect(result).toHaveLength(2);
  });

  it('ignores static template literals', () => {
    const content = 'className:`static-class another-class`';
    const result = extractDynamicBaseStrings(content);
    expect(result).toHaveLength(0);
  });

  it('ignores regular string class attributes', () => {
    const content = 'className="flex gap-2"';
    const result = extractDynamicBaseStrings(content);
    expect(result).toHaveLength(0);
  });
});

describe('containsDynamicPrefix', () => {
  it('detects lucide-react icon classes', () => {
    const classes = ['lucide', 'lucide-github', 'h-4', 'w-4'];
    expect(containsDynamicPrefix(classes, DEFAULT_DYNAMIC_PREFIXES)).toBe(true);
  });

  it('detects Font Awesome classes', () => {
    const classes = ['fa-github', 'fa-lg'];
    expect(containsDynamicPrefix(classes, DEFAULT_DYNAMIC_PREFIXES)).toBe(true);

    const classes2 = ['fas', 'fa-check'];
    expect(containsDynamicPrefix(classes2, DEFAULT_DYNAMIC_PREFIXES)).toBe(true);

    const classes3 = ['far', 'fa-circle'];
    expect(containsDynamicPrefix(classes3, DEFAULT_DYNAMIC_PREFIXES)).toBe(true);
  });

  it('detects heroicon classes', () => {
    const classes = ['heroicon', 'heroicon-outline', 'h-5', 'w-5'];
    expect(containsDynamicPrefix(classes, DEFAULT_DYNAMIC_PREFIXES)).toBe(true);
  });

  it('detects material icons classes', () => {
    const classes = ['material-icons', 'text-base'];
    expect(containsDynamicPrefix(classes, DEFAULT_DYNAMIC_PREFIXES)).toBe(true);

    const classes2 = ['mdi-home', 'text-lg'];
    expect(containsDynamicPrefix(classes2, DEFAULT_DYNAMIC_PREFIXES)).toBe(true);
  });

  it('detects Bootstrap Icons classes', () => {
    const classes = ['bi-github', 'text-xl'];
    expect(containsDynamicPrefix(classes, DEFAULT_DYNAMIC_PREFIXES)).toBe(true);
  });

  it('detects Remix Icons classes', () => {
    const classes = ['ri-home-line', 'text-2xl'];
    expect(containsDynamicPrefix(classes, DEFAULT_DYNAMIC_PREFIXES)).toBe(true);
  });

  it('returns false for regular utility classes', () => {
    const classes = ['flex', 'gap-2', 'items-center', 'px-4', 'py-2'];
    expect(containsDynamicPrefix(classes, DEFAULT_DYNAMIC_PREFIXES)).toBe(false);
  });

  it('returns false for Tailwind classes that look similar', () => {
    // "fab" without a dash is Font Awesome, but "fabric" is not
    const classes = ['fabric-button', 'text-primary'];
    expect(containsDynamicPrefix(classes, DEFAULT_DYNAMIC_PREFIXES)).toBe(false);
  });

  it('works with custom prefixes', () => {
    const customPrefixes = ['my-icon-', 'custom-'];
    const classes = ['my-icon-home', 'text-lg'];
    expect(containsDynamicPrefix(classes, customPrefixes)).toBe(true);

    const classes2 = ['flex', 'gap-2'];
    expect(containsDynamicPrefix(classes2, customPrefixes)).toBe(false);
  });

  it('handles empty arrays', () => {
    expect(containsDynamicPrefix([], DEFAULT_DYNAMIC_PREFIXES)).toBe(false);
    expect(containsDynamicPrefix(['flex'], [])).toBe(false);
  });
});

describe('isProperSubset', () => {
  it('returns true when A is a proper subset of B', () => {
    expect(isProperSubset(['h-4', 'w-4'], ['lucide', 'lucide-copy', 'h-4', 'w-4'])).toBe(true);
    expect(isProperSubset(['flex'], ['flex', 'items-center', 'gap-2'])).toBe(true);
  });

  it('returns false when sets are equal', () => {
    expect(isProperSubset(['h-4', 'w-4'], ['h-4', 'w-4'])).toBe(false);
  });

  it('returns false when A has more elements than B', () => {
    expect(isProperSubset(['h-4', 'w-4', 'text-lg'], ['h-4', 'w-4'])).toBe(false);
  });

  it('returns false when A has elements not in B', () => {
    expect(isProperSubset(['h-4', 'text-lg'], ['h-4', 'w-4', 'flex'])).toBe(false);
  });

  it('handles empty arrays', () => {
    expect(isProperSubset([], ['h-4', 'w-4'])).toBe(true); // Empty is subset of any non-empty
    expect(isProperSubset(['h-4'], [])).toBe(false);
    expect(isProperSubset([], [])).toBe(false); // Empty is not proper subset of empty
  });
});

describe('isNonFlattenableClass', () => {
  it('flags responsive variant prefixes', () => {
    expect(isNonFlattenableClass('md:px-6')).toBe(true);
    expect(isNonFlattenableClass('lg:flex')).toBe(true);
    expect(isNonFlattenableClass('sm:hidden')).toBe(true);
    expect(isNonFlattenableClass('xl:text-lg')).toBe(true);
    expect(isNonFlattenableClass('2xl:gap-4')).toBe(true);
  });

  it('flags pseudo-class variants', () => {
    expect(isNonFlattenableClass('hover:bg-blue-500')).toBe(true);
    expect(isNonFlattenableClass('focus:ring-2')).toBe(true);
    expect(isNonFlattenableClass('dark:text-white')).toBe(true);
    expect(isNonFlattenableClass('group-hover:opacity-100')).toBe(true);
    expect(isNonFlattenableClass('peer-focus:border-blue')).toBe(true);
  });

  it('flags arbitrary variant prefixes', () => {
    expect(isNonFlattenableClass('data-[state=open]:flex')).toBe(true);
    expect(isNonFlattenableClass('aria-[expanded=true]:block')).toBe(true);
  });

  it('flags container query classes', () => {
    expect(isNonFlattenableClass('@sm')).toBe(true);
    expect(isNonFlattenableClass('@md')).toBe(true);
    expect(isNonFlattenableClass('@[800px]')).toBe(true);
  });

  it('flags combinator-based space utilities', () => {
    expect(isNonFlattenableClass('space-y-6')).toBe(true);
    expect(isNonFlattenableClass('space-x-4')).toBe(true);
    expect(isNonFlattenableClass('space-y-reverse')).toBe(true);
    expect(isNonFlattenableClass('space-x-reverse')).toBe(true);
  });

  it('flags combinator-based divide utilities', () => {
    expect(isNonFlattenableClass('divide-y-2')).toBe(true);
    expect(isNonFlattenableClass('divide-x-4')).toBe(true);
    expect(isNonFlattenableClass('divide-y-reverse')).toBe(true);
  });

  it('does not flag regular flat utility classes', () => {
    expect(isNonFlattenableClass('flex')).toBe(false);
    expect(isNonFlattenableClass('px-4')).toBe(false);
    expect(isNonFlattenableClass('gap-2')).toBe(false);
    expect(isNonFlattenableClass('text-lg')).toBe(false);
    expect(isNonFlattenableClass('bg-blue-500')).toBe(false);
    expect(isNonFlattenableClass('rounded-md')).toBe(false);
    expect(isNonFlattenableClass('hidden')).toBe(false);
    expect(isNonFlattenableClass('items-center')).toBe(false);
  });

  it('does not flag non-combinator space/divide classes', () => {
    // space-between etc. are flat — they're not combinator-based
    expect(isNonFlattenableClass('justify-between')).toBe(false);
    // divide-color classes (divide-gray-200) are flat
    expect(isNonFlattenableClass('divide-gray-200')).toBe(false);
  });
});

describe('normalizeClassString with excludeNonFlattenable', () => {
  const exclude: ExcludeConfig = {
    prefixes: ['js-'],
    suffixes: [],
    classes: [],
    patterns: [],
  };

  it('moves variant classes to excludedClasses when excludeNonFlattenable is true', () => {
    const result = normalizeClassString('space-y-6 px-4 md:px-6', exclude, true);
    expect(result.classes).toEqual(['px-4']);
    expect(result.excludedClasses).toEqual(expect.arrayContaining(['space-y-6', 'md:px-6']));
  });

  it('includes variant classes normally when excludeNonFlattenable is false', () => {
    const result = normalizeClassString('space-y-6 px-4 md:px-6', exclude, false);
    expect(result.classes).toEqual(expect.arrayContaining(['space-y-6', 'px-4', 'md:px-6']));
    expect(result.excludedClasses).toHaveLength(0);
  });

  it('defaults to not excluding non-flattenable classes (backward compatible)', () => {
    const result = normalizeClassString('space-y-6 px-4 md:px-6', exclude);
    expect(result.classes).toEqual(expect.arrayContaining(['space-y-6', 'px-4', 'md:px-6']));
  });

  it('combines config-based and non-flattenable exclusions', () => {
    const result = normalizeClassString('js-click flex md:flex hover:bg-blue', exclude, true);
    expect(result.classes).toEqual(['flex']);
    expect(result.excludedClasses).toEqual(expect.arrayContaining(['js-click', 'md:flex', 'hover:bg-blue']));
  });
});

describe('detectMergeablePatterns', () => {
  function createOccurrence(
    classes: string[],
    sourceTypes: ('js' | 'html' | 'rsc')[]
  ): ClassOccurrence {
    return {
      classString: classes.join(' '),
      normalizedKey: classes.sort().join(' '),
      count: 1,
      locations: [{ filePath: 'test.js' }],
      classes,
      excludedClasses: [],
      sourceTypes: new Set(sourceTypes),
    };
  }

  it('detects JS patterns that are subsets of HTML patterns', () => {
    const occurrences = new Map<string, ClassOccurrence>([
      ['h-4 w-4', createOccurrence(['h-4', 'w-4'], ['js'])],
      ['h-4 lucide lucide-copy w-4', createOccurrence(['lucide', 'lucide-copy', 'h-4', 'w-4'], ['html'])],
    ]);

    const mergeable = detectMergeablePatterns(occurrences);
    expect(mergeable.has('h-4 w-4')).toBe(true);
  });

  it('does not flag patterns that appear in both JS and HTML equally', () => {
    const occurrences = new Map<string, ClassOccurrence>([
      ['flex gap-2 items-center', createOccurrence(['flex', 'gap-2', 'items-center'], ['js', 'html'])],
    ]);

    const mergeable = detectMergeablePatterns(occurrences);
    expect(mergeable.size).toBe(0);
  });

  it('does not flag HTML-only patterns', () => {
    const occurrences = new Map<string, ClassOccurrence>([
      ['flex gap-2', createOccurrence(['flex', 'gap-2'], ['html'])],
    ]);

    const mergeable = detectMergeablePatterns(occurrences);
    expect(mergeable.size).toBe(0);
  });

  it('does not flag JS patterns without HTML supersets', () => {
    const occurrences = new Map<string, ClassOccurrence>([
      ['flex gap-2', createOccurrence(['flex', 'gap-2'], ['js'])],
      ['text-lg font-bold', createOccurrence(['text-lg', 'font-bold'], ['html'])],
    ]);

    const mergeable = detectMergeablePatterns(occurrences);
    expect(mergeable.size).toBe(0);
  });

  it('handles the lucide-react icon scenario', () => {
    // This is the exact scenario from the issue:
    // JS has: className="h-3.5 w-3.5" (passed as prop)
    // HTML has: class="lucide lucide-copy h-3.5 w-3.5" (merged by component)
    const occurrences = new Map<string, ClassOccurrence>([
      ['h-3.5 w-3.5', createOccurrence(['h-3.5', 'w-3.5'], ['js'])],
      ['h-3.5 lucide lucide-copy w-3.5', createOccurrence(['lucide', 'lucide-copy', 'h-3.5', 'w-3.5'], ['html'])],
    ]);

    const mergeable = detectMergeablePatterns(occurrences);
    expect(mergeable.has('h-3.5 w-3.5')).toBe(true);
  });
});
