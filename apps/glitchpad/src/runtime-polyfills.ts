const REGEXP_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/g;
type ReplaceFunction = (substring: string, ...args: unknown[]) => string;

function replace(
  value: string,
  pattern: RegExp,
  replacement: string | ReplaceFunction,
): string {
  return typeof replacement === 'function'
    ? value.replace(pattern, replacement)
    : value.replace(pattern, replacement);
}

export function installRuntimePolyfills(): void {
  if (typeof String.prototype.replaceAll === 'function') return;

  Object.defineProperty(String.prototype, 'replaceAll', {
    configurable: true,
    writable: true,
    value(
      this: string,
      searchValue: string | RegExp,
      replacement: string | ReplaceFunction,
    ): string {
      if (this === null || this === undefined) {
        throw new TypeError('String.prototype.replaceAll called on null or undefined');
      }

      if (searchValue instanceof RegExp) {
        if (!searchValue.global) {
          throw new TypeError('String.prototype.replaceAll requires a global regular expression');
        }
        return replace(String(this), searchValue, replacement);
      }

      const escapedSearch = String(searchValue).replace(REGEXP_SPECIAL_CHARACTERS, '\\$&');
      return replace(String(this), new RegExp(escapedSearch, 'g'), replacement);
    },
  });
}

installRuntimePolyfills();
