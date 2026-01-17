import { NextRequest, NextResponse } from 'next/server'

/**
 * Verifies authentication for admin API endpoints
 * Checks for ADMIN_API_KEY environment variable and validates Authorization header
 *
 * @param request - The Next.js request object
 * @returns boolean - True if authenticated or no admin key is set, false otherwise
 */
export function verifyAuth(request: NextRequest): boolean {
  const adminKey = process.env.ADMIN_API_KEY

  // If no admin key is configured, allow access (backward compatibility)
  // This allows local development without requiring authentication
  if (!adminKey) {
    console.warn('ADMIN_API_KEY not set - API endpoints are unprotected')
    return true
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader) {
    return false
  }

  // Support both "Bearer token" and plain token formats
  const providedKey = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader

  return providedKey === adminKey
}

/**
 * Returns a standardized 401 Unauthorized response
 *
 * @returns NextResponse with 401 status and error message
 */
export function unauthorized() {
  return NextResponse.json(
    {
      error: 'Unauthorized',
      message: 'Valid Authorization header required. Use: Authorization: Bearer <ADMIN_API_KEY>'
    },
    { status: 401 }
  )
}
