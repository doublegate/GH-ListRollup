/**
 * Prefixed console logging. Every line the extension writes starts with `[gnr]` so it can be
 * filtered in DevTools. Never pass tokens or response bodies here (docs/security-privacy.md).
 */
const PREFIX = '[gnr]';

export const log = {
  debug: (...args: unknown[]): void => console.debug(PREFIX, ...args),
  info: (...args: unknown[]): void => console.info(PREFIX, ...args),
  warn: (...args: unknown[]): void => console.warn(PREFIX, ...args),
};
