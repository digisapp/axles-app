import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const CSRF_COOKIE_NAME = '__csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const TOKEN_LENGTH = 32;

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(TOKEN_LENGTH).toString('hex');
}

/**
 * Set CSRF token cookie on a response (for server components/API routes)
 */
export function setCsrfCookie(response: NextResponse, token: string): void {
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60, // 1 hour
  });
}

/**
 * Get the CSRF token from the cookie jar (server-side)
 */
export async function getCsrfTokenFromCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(CSRF_COOKIE_NAME)?.value;
}

/**
 * Validate CSRF token from request header against cookie
 * Returns true if valid, false otherwise
 */
export async function validateCsrfToken(request: NextRequest): Promise<boolean> {
  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;

  if (!headerToken || !cookieToken) {
    return false;
  }

  // Use timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(headerToken),
      Buffer.from(cookieToken)
    );
  } catch {
    return false;
  }
}

/**
 * API route helper - returns 403 if CSRF validation fails
 * Use on state-changing endpoints (POST, PUT, DELETE, PATCH)
 */
export async function requireCsrf(request: NextRequest): Promise<NextResponse | null> {
  // Skip CSRF for API routes that use other auth (e.g., webhook signatures, internal auth)
  const isWebhook = request.nextUrl.pathname.includes('/webhook');
  const isInternal = request.headers.get('x-internal-signature');

  if (isWebhook || isInternal) {
    return null; // Skip CSRF for these
  }

  const isValid = await validateCsrfToken(request);
  if (!isValid) {
    return NextResponse.json(
      { error: 'Invalid or missing CSRF token' },
      { status: 403 }
    );
  }

  return null; // Validation passed
}

/**
 * API endpoint to get a fresh CSRF token (GET /api/csrf)
 * Client should call this and include the token in subsequent requests
 */
export async function handleCsrfTokenRequest(): Promise<NextResponse> {
  const token = generateCsrfToken();
  const response = NextResponse.json({ csrfToken: token });
  setCsrfCookie(response, token);
  return response;
}
