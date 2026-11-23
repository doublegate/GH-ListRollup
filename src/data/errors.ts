/**
 * The data layer's error model (docs/data-fetching.md §5). Errors carry a status code where there is
 * one and a short correlation id, never a token, URL or response body: folder names and paths are
 * repository content and may be private.
 */

/** A short id that ties a logged error to the row the user saw. Not a secret, not stable. */
function correlationId(): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export abstract class DataError extends Error {
  readonly id = correlationId();
}

/** The key failed validation (`docs/data-fetching.md` §2); no request was sent. */
export class InvalidKeyError extends DataError {
  override readonly name = 'InvalidKeyError';
  constructor(readonly reason: string) {
    super(`invalid folder key: ${reason}`);
  }
}

/** The response did not have the expected shape: GitHub may have changed the tree JSON. */
export class SchemaError extends DataError {
  override readonly name = 'SchemaError';
  constructor(readonly reason: string) {
    super(`unexpected tree JSON: ${reason}`);
  }
}

/** A non-2xx response. */
export class HttpError extends DataError {
  override readonly name = 'HttpError';
  constructor(readonly status: number) {
    super(`HTTP ${String(status)}`);
  }
}

/** The request could not be made or completed (offline, DNS, TLS, reset). */
export class NetworkError extends DataError {
  override readonly name = 'NetworkError';
  constructor() {
    super('network error');
  }
}

/** No response within the request timeout (`docs/data-fetching.md` §3). */
export class TimeoutError extends DataError {
  override readonly name = 'TimeoutError';
  constructor(readonly ms: number) {
    super(`no response within ${String(ms)} ms`);
  }
}
