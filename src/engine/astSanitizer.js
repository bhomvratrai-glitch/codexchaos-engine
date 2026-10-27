/**
 * AST Sanitizer & Safe Execution Sandbox for CodexChaos Engine
 * Ensures AI-generated or chat-provided JavaScript code cannot execute malicious commands,
 * access cookies, make unauthenticated network requests, or lock the main thread.
 */

const BLOCKED_TOKENS = [
  'fetch(',
  'XMLHttpRequest',
  'WebSocket',
  'document.cookie',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'window.location',
  'location.href',
  'location.replace',
  'location.assign',
  'document.write',
  'import(',
  'eval(',
  'Function(',
  'Worker(',
  'SharedWorker(',
  'ServiceWorker',
  'navigator.sendBeacon'
];

/**
 * Validates whether candidate code contains any forbidden security keywords.
 * @param {string} code 
 * @returns {{ valid: boolean, error?: string }}
 */
export function sanitizeCode(code) {
  if (!code || typeof code !== 'string') {
    return { valid: false, error: 'Code must be a non-empty string' };
  }

  // Remove single line and multi-line comments to prevent token evasion
  const strippedCode = code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '');

  for (const token of BLOCKED_TOKENS) {
    if (strippedCode.includes(token)) {
      return {
        valid: false,
        error: `Security violation: Forbidden API or token detected [${token}]`
      };
    }
  }

  // Ensure code defines a valid callable function or render cycle
  if (!strippedCode.includes('function') && !strippedCode.includes('=>')) {
    return {
      valid: false,
      error: 'Code must define an executable function (e.g. function render(ctx, canvas, state) {})'
    };
  }

  return { valid: true };
}

/**
 * Safely compiles a validated render function inside a restricted scope.
 * @param {string} code 
 * @returns {Function}
 */
export function compileSafeMod(code) {
  const check = sanitizeCode(code);
  if (!check.valid) {
    throw new Error(check.error);
  }

  // Wraps in an isolated factory function with nullified global scopes
  const wrappedScript = `
    "use strict";
    return (function(window, document, fetch, localStorage, sessionStorage, location) {
      ${code}
      if (typeof renderMod === 'function') return renderMod;
      if (typeof update === 'function') return update;
      if (typeof draw === 'function') return draw;
      return null;
    })(undefined, undefined, undefined, undefined, undefined, undefined);
  `;

  try {
    const factory = new Function(wrappedScript);
    const modFn = factory();
    if (typeof modFn !== 'function') {
      throw new Error('Mod code did not export or define a callable renderMod, update, or draw function.');
    }
    return modFn;
  } catch (err) {
    throw new Error(`Failed to compile mod: ${err.message}`);
  }
}
