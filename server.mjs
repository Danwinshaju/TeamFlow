import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import pg from 'pg';
import { attachMessaging } from './src/server/messaging.mjs';
import { resetTestUserOnStartup } from './src/server/reset-test-user.mjs';
import { resetDevelopmentData } from './src/server/reset-development-data.mjs';

const dev = !process.argv.includes('--production');
process.env.NODE_ENV = dev ? 'development' : 'production';
// Next reads NODE_ENV while its module is loading. Dynamic imports ensure the
// mode is established first, preventing incomplete .next/dev manifests.
const { default: nextEnv } = await import('@next/env');
nextEnv.loadEnvConfig(process.cwd(), dev);
const port = Number(process.env.PORT || 3000);
const networkAddresses = Object.entries(networkInterfaces())
  .flatMap(([name, addresses]) => (addresses || []).map(address => ({ ...address, name })))
  .filter(address => address.family === 'IPv4' && !address.internal)
  .sort((left, right) => Number(/wi-?fi|wireless|wlan/i.test(right.name)) - Number(/wi-?fi|wireless|wlan/i.test(left.name)));
const localAddress = networkAddresses[0]?.address;
if (dev && process.env.LOCAL_NETWORK_TESTING === 'true' && localAddress) {
  process.env.TEST_LAN_URL = `http://${localAddress}:${port}`;
}
const { default: next } = await import('next');
// Listen on every local interface so phones and computers on the same
// network can open TeamFlow. The public URLs remain controlled by APP_URL
// and TEST_LAN_URL; this value only controls the network binding.
const hostname = process.env.HOSTNAME || '0.0.0.0';
const app = next({ dev, hostname, port });
await app.prepare();
const server = createServer(app.getRequestHandler());
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 10000 });
await resetDevelopmentData(pool, 'startup');
await resetTestUserOnStartup(pool);
const origins = [new URL(process.env.APP_URL || `http://localhost:${port}`).origin];
if (dev && process.env.LOCAL_NETWORK_TESTING === 'true' && process.env.TEST_LAN_URL) origins.push(new URL(process.env.TEST_LAN_URL).origin);
const io = attachMessaging(server, pool, process.env.JWT_SECRET, origins);
let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\nStopping TeamFlow...');
  const deadline = setTimeout(() => process.exit(1), 5000);
  deadline.unref();
  try {
    await new Promise(resolve => io.close(resolve));
    await pool.end();
    await app.close();
    clearTimeout(deadline);
    process.exit(0);
  } catch {
    process.exit(1);
  }
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
server.listen(port, hostname, () => {
  console.log('TeamFlow with messaging is ready');
  console.log(`  Local:   http://localhost:${port}`);
  if (dev && process.env.LOCAL_NETWORK_TESTING === 'true' && process.env.TEST_LAN_URL) {
    console.log(`  Network: ${new URL(process.env.TEST_LAN_URL).origin}`);
    console.log('  Share the Network address with devices on the same Wi-Fi.');
  }
});
server.on('error', (error) => { console.error(error.message); process.exit(1); });
