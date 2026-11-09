// A failed request carries an HTTP status code, on the REST API as the response status and on the
// socket as the reply's error.code, so a client can tell a missing key from a failing store.
export const BAD_REQUEST = 400;
export const FORBIDDEN = 403;
export const NOT_FOUND = 404;
export const ALREADY_EXISTS = 412;
export const INTERNAL_ERROR = 500;

export class StoreError extends Error {
  public readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.name = 'StoreError';
    this.code = code;
  }
}

export interface IWireError {
  code: number;
  message: string;
  // read by clients that predate codes
  alreadyExists?: boolean;
}

export function errorCode(err: any): number {
  if (err instanceof StoreError) return err.code;
  // leveldb's NotFoundError
  if (err && err.notFound) return NOT_FOUND;
  return INTERNAL_ERROR;
}

export function wireError(err: any): IWireError {
  const code = errorCode(err);
  const message = (err && typeof err.message === 'string') ? err.message : String(err);
  return code === ALREADY_EXISTS ? { code, message, alreadyExists: true } : { code, message };
}
