import { timingSafeEqual } from 'node:crypto';

export function isAuthorized(request: Request) {
  const expected = process.env.PROSPECT_APP_ACCESS_CODE;
  if (!expected) return process.env.NODE_ENV !== 'production';
  const supplied = request.headers.get('x-prospect-access-code') || '';
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length
    && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export const privateHeaders = {
  'Cache-Control': 'no-store, private',
  'X-Content-Type-Options': 'nosniff',
};
