/**
 * CSS Generator - Creates consolidated CSS rules
 */

import postcss from 'postcss';
import type { ClassMapping } from '../types/index.js';
import { readFileContent, writeFileContent, findFiles, isCSSFile } from '../utils/files.js';

// Map of Tailwind utility prefixes to CSS properties
const UTILITY_PROPERTY_MAP: Record<string, string | string[]> = {
  // Display
  'flex': 'display: flex',
  'grid': 'display: grid',
  'block': 'display: block',
  'inline': 'display: inline',
  'inline-block': 'display: inline-block',
  'hidden': 'display: none',

  // Flex direction
  'flex-col': 'flex-direction: column',
  'flex-row': 'flex-direction: row',
  'flex-col-reverse': 'flex-direction: column-reverse',
  'flex-row-reverse': 'flex-direction: row-reverse',

  // Flex wrap
  'flex-wrap': 'flex-wrap: wrap',
  'flex-nowrap': 'flex-wrap: nowrap',

  // Justify content
  'justify-start': 'justify-content: flex-start',
  'justify-end': 'justify-content: flex-end',
  'justify-center': 'justify-content: center',
  'justify-between': 'justify-content: space-between',
  'justify-around': 'justify-content: space-around',
  'justify-evenly': 'justify-content: space-evenly',

  // Align items
  'items-start': 'align-items: flex-start',
  'items-end': 'align-items: flex-end',
  'items-center': 'align-items: center',
  'items-baseline': 'align-items: baseline',
  'items-stretch': 'align-items: stretch',

  // Text align
  'text-left': 'text-align: left',
  'text-center': 'text-align: center',
  'text-right': 'text-align: right',

  // Font weight
  'font-bold': 'font-weight: 700',
  'font-semibold': 'font-weight: 600',
  'font-medium': 'font-weight: 500',
  'font-normal': 'font-weight: 400',
  'font-light': 'font-weight: 300',

  // Position
  'relative': 'position: relative',
  'absolute': 'position: absolute',
  'fixed': 'position: fixed',
  'sticky': 'position: sticky',

  // Overflow
  'overflow-hidden': 'overflow: hidden',
  'overflow-auto': 'overflow: auto',
  'overflow-scroll': 'overflow: scroll',
  'overflow-visible': 'overflow: visible',

  // Cursor
  'cursor-pointer': 'cursor: pointer',
  'cursor-default': 'cursor: default',
  'cursor-not-allowed': 'cursor: not-allowed',

  // Misc
  'truncate': ['overflow: hidden', 'text-overflow: ellipsis', 'white-space: nowrap'],
  'uppercase': 'text-transform: uppercase',
  'lowercase': 'text-transform: lowercase',
  'capitalize': 'text-transform: capitalize',
};

/**
 * Parse a Tailwind utility class and return its CSS
 */
export function parseUtilityClass(className: string): string[] {
  // Check direct mapping first
  if (UTILITY_PROPERTY_MAP[className]) {
    const value = UTILITY_PROPERTY_MAP[className];
    return Array.isArray(value) ? value : [value];
  }

  // Handle arbitrary values: text-[var(--gold)]
  const arbitraryMatch = className.match(/^([a-z]+(?:-[a-z]+)?)-\[(.+)\]$/);
  if (arbitraryMatch) {
    const [, prefix, value] = arbitraryMatch;
    return parseArbitraryValue(prefix, value);
  }

  // Handle spacing utilities: p-4, m-2, gap-2, etc.
  const spacingMatch = className.match(/^(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y)-(\d+(?:\.\d+)?|\[.+\])$/);
  if (spacingMatch) {
    const [, prefix, value] = spacingMatch;
    return parseSpacingUtility(prefix, value);
  }

  // Handle sizing utilities: w-full, h-screen, etc.
  const sizeMatch = className.match(/^(w|h|min-w|min-h|max-w|max-h)-(.+)$/);
  if (sizeMatch) {
    const [, prefix, value] = sizeMatch;
    return parseSizeUtility(prefix, value);
  }

  // Handle rounded utilities
  const roundedMatch = className.match(/^rounded(-[a-z]+)?(-[a-z0-9]+)?$/);
  if (roundedMatch) {
    return parseRoundedUtility(className);
  }

  // Handle text size utilities: text-sm, text-lg, etc.
  const textSizeMatch = className.match(/^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/);
  if (textSizeMatch) {
    return parseTextSizeUtility(textSizeMatch[1]);
  }

  // Handle opacity utilities
  const opacityMatch = className.match(/^opacity-(\d+)$/);
  if (opacityMatch) {
    return [`opacity: ${parseInt(opacityMatch[1]) / 100}`];
  }

  // Handle z-index utilities
  const zMatch = className.match(/^z-(\d+|auto)$/);
  if (zMatch) {
    return [`z-index: ${zMatch[1]}`];
  }

  // Unknown utility - return empty (will be looked up from CSS file)
  return [];
}

/**
 * Parse arbitrary value syntax
 */
function parseArbitraryValue(prefix: string, value: string): string[] {
  const propertyMap: Record<string, string> = {
    'text': 'color',
    'bg': 'background-color',
    'border': 'border-color',
    'border-t': 'border-top-color',
    'border-b': 'border-bottom-color',
    'border-l': 'border-left-color',
    'border-r': 'border-right-color',
    'fill': 'fill',
    'stroke': 'stroke',
    'p': 'padding',
    'px': 'padding-inline',
    'py': 'padding-block',
    'pt': 'padding-top',
    'pb': 'padding-bottom',
    'pl': 'padding-left',
    'pr': 'padding-right',
    'm': 'margin',
    'mx': 'margin-inline',
    'my': 'margin-block',
    'mt': 'margin-top',
    'mb': 'margin-bottom',
    'ml': 'margin-left',
    'mr': 'margin-right',
    'w': 'width',
    'h': 'height',
    'min-w': 'min-width',
    'min-h': 'min-height',
    'max-w': 'max-width',
    'max-h': 'max-height',
    'top': 'top',
    'bottom': 'bottom',
    'left': 'left',
    'right': 'right',
    'gap': 'gap',
    'gap-x': 'column-gap',
    'gap-y': 'row-gap',
  };

  const property = propertyMap[prefix];
  if (property) {
    return [`${property}: ${value}`];
  }

  return [];
}

/**
 * Parse spacing utilities (padding, margin, gap)
 */
function parseSpacingUtility(prefix: string, value: string): string[] {
  // Convert Tailwind spacing scale to rem
  const spacingScale: Record<string, string> = {
    '0': '0px',
    '0.5': '0.125rem',
    '1': '0.25rem',
    '1.5': '0.375rem',
    '2': '0.5rem',
    '2.5': '0.625rem',
    '3': '0.75rem',
    '3.5': '0.875rem',
    '4': '1rem',
    '5': '1.25rem',
    '6': '1.5rem',
    '7': '1.75rem',
    '8': '2rem',
    '9': '2.25rem',
    '10': '2.5rem',
    '11': '2.75rem',
    '12': '3rem',
    '14': '3.5rem',
    '16': '4rem',
    '20': '5rem',
    '24': '6rem',
    '28': '7rem',
    '32': '8rem',
    '36': '9rem',
    '40': '10rem',
    '44': '11rem',
    '48': '12rem',
    '52': '13rem',
    '56': '14rem',
    '60': '15rem',
    '64': '16rem',
    '72': '18rem',
    '80': '20rem',
    '96': '24rem',
  };

  // Handle arbitrary values
  let cssValue = spacingScale[value];
  if (!cssValue && value.startsWith('[') && value.endsWith(']')) {
    cssValue = value.slice(1, -1);
  }
  if (!cssValue) return [];

  const propertyMap: Record<string, string | string[]> = {
    'p': 'padding',
    'px': ['padding-left', 'padding-right'],
    'py': ['padding-top', 'padding-bottom'],
    'pt': 'padding-top',
    'pb': 'padding-bottom',
    'pl': 'padding-left',
    'pr': 'padding-right',
    'm': 'margin',
    'mx': ['margin-left', 'margin-right'],
    'my': ['margin-top', 'margin-bottom'],
    'mt': 'margin-top',
    'mb': 'margin-bottom',
    'ml': 'margin-left',
    'mr': 'margin-right',
    'gap': 'gap',
    'gap-x': 'column-gap',
    'gap-y': 'row-gap',
  };

  const property = propertyMap[prefix];
  if (Array.isArray(property)) {
    return property.map((p) => `${p}: ${cssValue}`);
  }
  if (property) {
    return [`${property}: ${cssValue}`];
  }

  return [];
}

/**
 * Parse size utilities (width, height)
 */
function parseSizeUtility(prefix: string, value: string): string[] {
  const sizeMap: Record<string, string> = {
    'full': '100%',
    'screen': '100vh',
    'svh': '100svh',
    'lvh': '100lvh',
    'dvh': '100dvh',
    'min': 'min-content',
    'max': 'max-content',
    'fit': 'fit-content',
    'auto': 'auto',
  };

  let cssValue = sizeMap[value];
  if (!cssValue && value.startsWith('[') && value.endsWith(']')) {
    cssValue = value.slice(1, -1);
  }
  if (!cssValue) {
    // Try numeric (spacing scale)
    const spacingMatch = value.match(/^(\d+(?:\.\d+)?)$/);
    if (spacingMatch) {
      cssValue = `${parseFloat(spacingMatch[1]) * 0.25}rem`;
    }
  }
  if (!cssValue) return [];

  const propertyMap: Record<string, string> = {
    'w': 'width',
    'h': 'height',
    'min-w': 'min-width',
    'min-h': 'min-height',
    'max-w': 'max-width',
    'max-h': 'max-height',
  };

  const property = propertyMap[prefix];
  if (property) {
    return [`${property}: ${cssValue}`];
  }

  return [];
}

/**
 * Parse rounded utilities
 */
function parseRoundedUtility(className: string): string[] {
  const roundedMap: Record<string, string> = {
    'rounded': 'border-radius: 0.25rem',
    'rounded-none': 'border-radius: 0px',
    'rounded-sm': 'border-radius: 0.125rem',
    'rounded-md': 'border-radius: 0.375rem',
    'rounded-lg': 'border-radius: 0.5rem',
    'rounded-xl': 'border-radius: 0.75rem',
    'rounded-2xl': 'border-radius: 1rem',
    'rounded-3xl': 'border-radius: 1.5rem',
    'rounded-full': 'border-radius: 9999px',
  };

  if (roundedMap[className]) {
    return [roundedMap[className]];
  }

  return [];
}

/**
 * Parse text size utilities
 */
function parseTextSizeUtility(size: string): string[] {
  const sizeMap: Record<string, [string, string]> = {
    'xs': ['0.75rem', '1rem'],
    'sm': ['0.875rem', '1.25rem'],
    'base': ['1rem', '1.5rem'],
    'lg': ['1.125rem', '1.75rem'],
    'xl': ['1.25rem', '1.75rem'],
    '2xl': ['1.5rem', '2rem'],
    '3xl': ['1.875rem', '2.25rem'],
    '4xl': ['2.25rem', '2.5rem'],
    '5xl': ['3rem', '1'],
    '6xl': ['3.75rem', '1'],
    '7xl': ['4.5rem', '1'],
    '8xl': ['6rem', '1'],
    '9xl': ['8rem', '1'],
  };

  const [fontSize, lineHeight] = sizeMap[size] || ['1rem', '1.5rem'];
  return [`font-size: ${fontSize}`, `line-height: ${lineHeight}`];
}

/**
 * Extract utility CSS from the build's CSS file
 */
export async function extractUtilityCSS(
  buildDir: string
): Promise<Map<string, string[]>> {
  const utilityMap = new Map<string, string[]>();

  // Find CSS files in build (supports all frameworks)
  const cssPatterns = [
    // Next.js
    'static/**/*.css',
    'static/css/**/*.css',
    // Angular
    'browser/**/*.css',
    // Astro
    '_astro/**/*.css',
    // Nuxt
    'public/_nuxt/**/*.css',
    // Vite/Vue/React/Qwik generic
    'assets/**/*.css',
    // Gatsby/Hugo/Eleventy/Docusaurus/Parcel
    '**/*.css',
  ];
  const cssFiles = await findFiles(buildDir, cssPatterns);

  for (const cssFile of cssFiles) {
    if (!isCSSFile(cssFile)) continue;

    try {
      const content = await readFileContent(cssFile);
      const root = postcss.parse(content);

      root.walkRules((rule) => {
        // Extract class name from selector
        const selectorMatch = rule.selector.match(/^\.([^\s:,\[]+)/);
        if (!selectorMatch) return;

        const className = selectorMatch[1];
        const declarations: string[] = [];

        rule.walkDecls((decl) => {
          declarations.push(`${decl.prop}: ${decl.value}`);
        });

        if (declarations.length > 0) {
          utilityMap.set(className, declarations);
        }
      });
    } catch {
      // Skip files that can't be parsed
    }
  }

  return utilityMap;
}

/**
 * Generate CSS for consolidated classes
 */
export async function generateConsolidatedCSS(
  mappings: ClassMapping[],
  buildDir: string,
  cssLayer?: string | false
): Promise<string> {
  // First, try to extract utilities from the build CSS
  const utilityMap = await extractUtilityCSS(buildDir);

  const cssRules: string[] = [];

  for (const mapping of mappings) {
    const declarations: string[] = [];

    for (const className of mapping.classes) {
      // Try to get from extracted utilities first
      const extracted = utilityMap.get(className);
      if (extracted) {
        declarations.push(...extracted);
        continue;
      }

      // Fall back to parsing the utility
      const parsed = parseUtilityClass(className);
      if (parsed.length > 0) {
        declarations.push(...parsed);
      }
    }

    // Remove duplicates
    const uniqueDeclarations = [...new Set(declarations)];

    if (uniqueDeclarations.length > 0) {
      mapping.cssDeclarations = uniqueDeclarations.join('; ');
      cssRules.push(`.${mapping.consolidated} {\n  ${uniqueDeclarations.join(';\n  ')};\n}`);
    }
  }

  const cssContent = cssRules.join('\n\n');

  if (cssLayer) {
    return `/* Classpresso Consolidated Classes */\n@layer ${cssLayer} {\n${cssRules.map(rule => '  ' + rule.replace(/\n/g, '\n  ')).join('\n\n')}\n}`;
  }

  return `/* Classpresso Consolidated Classes */\n${cssContent}`;
}

/**
 * Inject consolidated CSS into the build
 * Only injects into ONE CSS file (the largest) to avoid duplicating overhead
 */
export async function injectConsolidatedCSS(
  buildDir: string,
  consolidatedCSS: string
): Promise<string> {
  // Find CSS files in build (supports all frameworks)
  const cssPatterns = [
    // Next.js
    'static/**/*.css',
    'static/css/**/*.css',
    'standalone/.next/static/**/*.css',
    'standalone/.next/static/css/**/*.css',
    // Angular
    'browser/**/*.css',
    // Astro
    '_astro/**/*.css',
    'client/_astro/**/*.css',
    // Nuxt
    'public/_nuxt/**/*.css',
    // SvelteKit
    '_app/**/*.css',
    'client/**/*.css',
    // Vite/Vue/React/Qwik generic
    'assets/**/*.css',
    // Gatsby/Hugo/Eleventy/Docusaurus/Parcel
    '**/*.css',
  ];
  const cssFiles = await findFiles(buildDir, cssPatterns);

  if (cssFiles.length === 0) {
    throw new Error('No CSS files found in build output');
  }

  // Find the largest CSS file to inject into (likely the main stylesheet)
  // This avoids duplicating the consolidated CSS across multiple files
  let targetFile = cssFiles[0];
  let maxSize = 0;

  for (const cssFile of cssFiles) {
    if (!isCSSFile(cssFile)) continue;
    try {
      const content = await readFileContent(cssFile);
      // Skip if already injected
      if (content.includes('Classpresso Consolidated')) {
        return `none (already injected in ${cssFile})`;
      }
      const size = Buffer.byteLength(content, 'utf-8');
      if (size > maxSize) {
        maxSize = size;
        targetFile = cssFile;
      }
    } catch {
      // Skip files that can't be read
    }
  }

  // Inject into the largest CSS file only
  const existingContent = await readFileContent(targetFile);
  const newContent = `${existingContent}\n\n${consolidatedCSS}`;
  await writeFileContent(targetFile, newContent);

  return targetFile;
}
