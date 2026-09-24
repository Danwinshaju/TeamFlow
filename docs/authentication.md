# TeamFlow authentication

Login issues a 15-minute signed HS256 access JWT in the HttpOnly `teamflow_access`
cookie and a random 30-day refresh token in the HttpOnly `teamflow_refresh` cookie.
Both cookies are Secure in production and SameSite=Lax. Browser requests use cookies;
tokens are not exposed to JavaScript or stored in localStorage.

The existing `sessions` table stores the refresh-token hash and absolute expiry.
JWT `sub` identifies the user and `sid` identifies that session. Each protected route
still checks membership and permissions; `getCurrentUser` verifies signature,
issuer, audience, expiry, session existence and user status. Deleting a session
therefore revokes access immediately, even before the JWT expires.

POST `/api/auth/refresh` rotates the stored refresh-token hash atomically and sets
both cookies again. Old refresh tokens fail; rotation does not extend the original
30-day expiry. Concurrent refreshes are serialized in browser tabs with Web Locks;
the database comparison prevents a token being consumed twice. Replayed tokens are
rejected; this implementation does not retain a token-family replay audit history.

Protected API components retry a 401 once after renewal. Expired page requests
visit `/session/refresh` to renew via POST, then return to their local page. Cookie
writes only happen in route handlers. Proxy performs same-origin checks for browser
mutations; Stripe's signed webhook remains exempt. API clients testing mutation
routes must supply an Origin matching APP_URL or the request origin.

Logout removes the database session and clears cookies. Password reset consumes its
one-time token, replaces the password, and deletes all sessions in one transaction.
Login rechecks the verified password under a user-row lock against concurrent resets.

## Setup

Run `node scripts/configure-jwt.cjs` once to provision `.env.local` if needed.
Production requires a strong JWT_SECRET of at least 32 characters in the deployment
environment. Use HTTPS and set APP_URL to the canonical origin. Restart after changes.
No database migration is required: refresh storage reuses the existing sessions table.
Old `teamflow_session` JWTs are not accepted; sign in again after upgrading.

Payment behavior is unchanged by this authentication update. Successful authentication
does not by itself imply a paid workspace subscription.
