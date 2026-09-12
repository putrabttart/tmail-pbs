import { NextResponse } from 'next/server';
import { HttpError } from './runtime';

function respond(data, init = {}) {
  return NextResponse.json(data, init);
}

function handleError(err) {
  if (err instanceof HttpError) {
    const headers = err.details?.retryAfterSeconds
      ? { 'Retry-After': String(err.details.retryAfterSeconds) }
      : undefined;
    return NextResponse.json({
      error: err.message,
      code: err.code || undefined,
      details: err.details || undefined
    }, { status: err.status, headers });
  }
  console.error(err);
  const message = err?.message ? String(err.message) : 'Unexpected server error';
  return NextResponse.json({
    error: message,
    code: err?.code || err?.name || 'INTERNAL_SERVER_ERROR'
  }, { status: 500 });
}

export { respond, handleError };
