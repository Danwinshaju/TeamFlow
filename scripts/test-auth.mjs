import assert from 'node:assert/strict';
import { randomUUID, randomBytes, scryptSync, createHash } from 'node:crypto';
import { config } from 'dotenv';
import pg from 'pg';
import { SignJWT, decodeJwt } from 'jose';

config({ path: '.env.local', quiet: true });
const base = process.env.AUTH_TEST_URL || 'http://localhost:3000';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const id = randomUUID();
const email = `jwt-test-${id}@example.invalid`;
const password = 'AuthTest-' + randomBytes(18).toString('hex');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const salt = randomBytes(16).toString('hex');
const passwordHash = `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`;
const jar = {};
let checks = 0;
async function request(path, body, cookies = jar, origin = base) {
  return fetch(base + path, { method: 'POST', redirect: 'manual', headers: {
    Origin: origin, 'Content-Type': 'application/json', Cookie: Object.entries(cookies).map(([k,v]) => `${k}=${v}`).join('; '),
  }, body: JSON.stringify(body || {}) });
}
function acceptCookies(response) {
  for (const value of response.headers.getSetCookie()) {
    const pair = value.split(';')[0]; const split = pair.indexOf('=');
    jar[pair.slice(0, split)] = pair.slice(split + 1);
  }
}
function check(actual, expected, message) { assert.equal(actual, expected, message); checks++; console.log('PASS:', message); }
try {
  await pool.query('INSERT INTO users(id,name,email,password_hash,status) VALUES($1,$2,$3,$4,$5)', [id, 'JWT integration test', email, passwordHash, 'active']);
  let response = await request('/api/auth/login', { email, password });
  check(response.status, 200, 'login issues cookies'); acceptCookies(response);
  check(!!jar.teamflow_access && !!jar.teamflow_refresh, true, 'both cookies issued');
  check(response.headers.getSetCookie().filter(v => v.includes('HttpOnly')).length >= 2, true, 'tokens are HttpOnly');
  const claims = decodeJwt(jar.teamflow_access);
  check(claims.exp - claims.iat, 900, 'access lifetime is 15 minutes');
  const stored = await pool.query('SELECT token_hash FROM sessions WHERE id=$1', [claims.sid]);
  check(stored.rows[0].token_hash, hash(jar.teamflow_refresh), 'only refresh hash stored');
  check((await request('/api/workspaces', {})).status, 400, 'valid token reaches authorized validation');
  check((await request('/api/auth/refresh', {}, jar, 'https://evil.example')).status, 403, 'cross-origin refresh blocked');
  const old = { ...jar };
  response = await request('/api/auth/refresh'); check(response.status, 200, 'refresh succeeds'); acceptCookies(response);
  check(jar.teamflow_refresh !== old.teamflow_refresh, true, 'refresh token rotates');
  check((await request('/api/auth/refresh', {}, old)).status, 401, 'old refresh rejected');
  const expired = await new SignJWT({ sid: claims.sid, type: 'access' }).setProtectedHeader({alg:'HS256',typ:'JWT'}).setSubject(id).setIssuer('teamflow').setAudience('teamflow-web').setIssuedAt(Math.floor(Date.now()/1000)-1000).setExpirationTime(Math.floor(Date.now()/1000)-100).sign(new TextEncoder().encode(process.env.JWT_SECRET));
  check((await request('/api/workspaces', {}, { ...jar, teamflow_access: expired })).status, 401, 'expired access rejected');
  const page = await fetch(base + '/dashboard', { redirect:'manual', headers:{ Cookie:`teamflow_refresh=${jar.teamflow_refresh}` } });
  check(page.headers.get('location')?.includes('/session/refresh'), true, 'expired page redirects for renewal');
  const beforeLogout = { ...jar };
  check((await request('/api/auth/logout')).status, 303, 'logout succeeds');
  check((await request('/api/auth/refresh', {}, beforeLogout)).status, 401, 'logout revokes refresh');
  check((await request('/api/workspaces', {}, beforeLogout)).status, 401, 'logout immediately revokes access');
  response = await request('/api/auth/login', { email, password }); acceptCookies(response);
  const deviceOne = { ...jar };
  response = await request('/api/auth/login', { email, password }); acceptCookies(response);
  const reset = randomBytes(32).toString('base64url');
  await pool.query('INSERT INTO auth_tokens(user_id,type,token_hash,expires_at) VALUES($1,$2,$3,$4)', [id,'password_reset',hash(reset),new Date(Date.now()+1800000)]);
  const nextPassword = password + 'New';
  check((await request('/api/auth/reset-password', { token:reset,password:nextPassword,confirmPassword:nextPassword })).status, 200, 'password reset succeeds');
  check((await request('/api/auth/refresh', {}, deviceOne)).status, 401, 'reset revokes other device refresh');
  check((await request('/api/workspaces', {}, deviceOne)).status, 401, 'reset revokes other device access');
  check((await request('/api/auth/reset-password', { token:reset,password:nextPassword,confirmPassword:nextPassword })).status, 400, 'reset token cannot be reused');
  check((await request('/api/auth/login', { email,password })).status, 401, 'old password rejected');
  check((await request('/api/auth/login', { email,password:nextPassword })).status, 200, 'new password accepted');
  console.log(`${checks} authentication checks passed.`);
} finally {
  await pool.query('DELETE FROM users WHERE id=$1 AND email=$2', [id,email]);
  await pool.end();
  console.log('Temporary test account and its tokens removed.');
}
