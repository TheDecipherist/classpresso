/**
 * Regex utilities for Classpresso
 */

/**
 * Escape special regex characters in a string
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Patterns to match className in various contexts
 */
export const CLASS_PATTERNS = {
  // JSX: className="..."
  jsxDouble: /className\s*=\s*"([^"]+)"/g,

  // JSX: className='...'
  jsxSingle: /className\s*=\s*'([^']+)'/g,

  // React createElement: className:"..."
  createElementDouble: /className\s*:\s*"([^"]+)"/g,

  // React createElement: className:'...'
  createElementSingle: /className\s*:\s*'([^']+)'/g,

  // Minified: "className","..."
  minifiedComma: /"className"\s*,\s*"([^"]+)"/g,

  // HTML: class="..."
  htmlDouble: /\bclass\s*=\s*"([^"]+)"/g,

  // HTML: class='...'
  htmlSingle: /\bclass\s*=\s*'([^']+)'/g,

  // HTML entity encoded: class=&quot;...&quot;
  htmlEntityDouble: /\bclass=&quot;([^&]+)&quot;/g,

  // HTML entity encoded: class=&#34;...&#34; (numeric entity)
  htmlNumericDouble: /\bclass=&#34;([^&]+)&#34;/g,

  // RSC payload: \"className\":\"...\" (escaped JSON in Next.js RSC payloads)
  rscPayload: /\\"className\\"\s*:\s*\\"([^"\\]+)\\"/g,
};

/**
 * All patterns combined for extraction
 */
export const ALL_CLASS_PATTERNS = [
  CLASS_PATTERNS.jsxDouble,
  CLASS_PATTERNS.jsxSingle,
  CLASS_PATTERNS.createElementDouble,
  CLASS_PATTERNS.createElementSingle,
  CLASS_PATTERNS.minifiedComma,
  CLASS_PATTERNS.htmlDouble,
  CLASS_PATTERNS.htmlSingle,
  CLASS_PATTERNS.htmlEntityDouble,
  CLASS_PATTERNS.htmlNumericDouble,
  CLASS_PATTERNS.rscPayload,
];

/**
 * Check if a class string contains dynamic expressions
 */
export function isDynamicClassString(classString: string): boolean {
  // Template literal expression
  if (classString.includes('${')) return true;

  // Ternary operator (likely dynamic)
  if (/\s*\?\s*/.test(classString) && classString.includes(':')) return true;

  // Function call
  if (/\w+\s*\(/.test(classString)) return true;

  // Variable reference (camelCase or UPPER_CASE that's not a valid class)
  if (/^[a-z][a-zA-Z0-9]*$/.test(classString) && !classString.includes('-')) return true;

  return false;
}

/**
 * Patterns to extract the static base portion of template literal class names
 * These capture the static classes before the ${...} dynamic expression
 */
export const DYNAMIC_BASE_PATTERNS = [
  // className:`base classes ${...}`
  /className\s*:\s*`([^`$]+)\s*\$\{/g,
  // className=`base classes ${...}` (JSX)
  /className\s*=\s*`([^`$]+)\s*\$\{/g,
  // class:`base classes ${...}` (rare but possible)
  /\bclass\s*:\s*`([^`$]+)\s*\$\{/g,
];

/**
 * Patterns to extract the static base portion of .concat() calls
 * Minified React often uses "".concat("base", " ", variant) for className
 * These are treated as dynamic and should be skipped
 */
export const CONCAT_BASE_PATTERNS = [
  // className:"".concat("base classes",...) - the base before concat
  /className\s*:\s*""\s*\.concat\s*\(\s*"([^"]+)"/g,
  // className:''.concat('base classes',...)
  /className\s*:\s*''\s*\.concat\s*\(\s*'([^']+)'/g,
];

/**
 * Extract static base patterns from .concat() calls
 * Returns the static class portion from the first concat argument
 */
export function extractConcatBaseStrings(content: string): string[] {
  const results: string[] = [];

  for (const pattern of CONCAT_BASE_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const baseString = match[1]?.trim();
      if (baseString && baseString.length > 0) {
        results.push(baseString);
      }
    }
  }

  return results;
}

/**
 * Extract static base patterns from template literals with dynamic expressions
 * Returns the static class portion before ${...}
 */
export function extractDynamicBaseStrings(
  content: string
): string[] {
  const results: string[] = [];

  for (const pattern of DYNAMIC_BASE_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const baseString = match[1]?.trim();
      if (baseString && baseString.length > 0) {
        results.push(baseString);
      }
    }
  }

  return results;
}

/**
 * Create a replacement pattern for a class string
 */
export function createReplacementPatterns(original: string): RegExp[] {
  const escaped = escapeRegex(original);

  return [
    new RegExp(`(className\\s*=\\s*)"${escaped}"`, 'g'),
    new RegExp(`(className\\s*=\\s*)'${escaped}'`, 'g'),
    new RegExp(`(className\\s*:\\s*)"${escaped}"`, 'g'),
    new RegExp(`(className\\s*:\\s*)'${escaped}'`, 'g'),
    new RegExp(`("className"\\s*,\\s*)"${escaped}"`, 'g'),
    new RegExp(`(class\\s*=\\s*)"${escaped}"`, 'g'),
    new RegExp(`(class\\s*=\\s*)'${escaped}'`, 'g'),
    // HTML entity encoded quotes
    new RegExp(`(class=&quot;)${escaped}(&quot;)`, 'g'),
    new RegExp(`(class=&#34;)${escaped}(&#34;)`, 'g'),
  ];
}
