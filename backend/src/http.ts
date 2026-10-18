import type { NextFunction, Request, RequestHandler, Response } from 'express';

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export const badRequest = (msg: string, details?: unknown) => new HttpError(400, msg, details);
export const unauthorized = (msg = 'Authentication required') => new HttpError(401, msg);
export const forbidden = (msg = 'You do not have permission to perform this action') => new HttpError(403, msg);
export const notFound = (msg = 'Not found') => new HttpError(404, msg);

export function ah(fn: (req: Request, res: Response, next: NextFunction) => unknown): RequestHandler {
  return (req, res, next) => {
    try {
      const out = fn(req, res, next);
      if (out && typeof (out as Promise<unknown>).catch === 'function') (out as Promise<unknown>).catch(next);
    } catch (err) {
      next(err);
    }
  };
}

export function str(v: unknown, field: string, opts: { min?: number; max?: number; optional?: boolean; trim?: boolean } = {}): string {
  if (v === undefined || v === null || v === '') {
    if (opts.optional) return '';
    throw badRequest(`${field} is required`);
  }
  if (typeof v !== 'string') throw badRequest(`${field} must be a string`);
  const s = opts.trim === false ? v : v.trim();
  if (opts.min !== undefined && s.length < opts.min) throw badRequest(`${field} must be at least ${opts.min} characters`);
  if (opts.max !== undefined && s.length > opts.max) throw badRequest(`${field} must be at most ${opts.max} characters`);
  return s;
}

export function num(v: unknown, field: string, opts: { min?: number; max?: number; optional?: boolean } = {}): number | null {
  if (v === undefined || v === null || v === '') {
    if (opts.optional) return null;
    throw badRequest(`${field} is required`);
  }
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) throw badRequest(`${field} must be a number`);
  if (opts.min !== undefined && n < opts.min) throw badRequest(`${field} must be >= ${opts.min}`);
  if (opts.max !== undefined && n > opts.max) throw badRequest(`${field} must be <= ${opts.max}`);
  return n;
}

export function bool(v: unknown, fallback: boolean): boolean {
  if (v === undefined || v === null) return fallback;
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === 1 || v === '1') return true;
  if (v === 'false' || v === 0 || v === '0') return false;
  throw badRequest('Expected a boolean');
}

export function param(req: Request, name: string): string {
  const v = req.params[name];
  if (typeof v !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(v)) throw notFound();
  return v;
}
