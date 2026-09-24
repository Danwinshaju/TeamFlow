# Workspace messaging

Run `npm run dev` for local development, or `npm run build` followed by `npm start` for production. Both start the shared Next.js and Socket.IO server. Running `next dev` directly does not start messaging.

Each workspace page contains its own conversation. Messages are stored in PostgreSQL; the latest 100 are displayed. Workspace membership and the current session are checked before loading, sending, and receiving messages. Messages are limited to 2,000 characters and 30 per account per minute. Repeating a send with the same message ID does not create another record.

After a long session expires, use Reconnect to refresh authentication. The configured APP_URL origin must match the browser origin. Run database migrations before starting the updated application.

Hosting requires a persistent Node.js process with WebSocket support. This implementation runs on one server; multiple instances need a shared Socket.IO adapter before scaling out. See https://socket.io/how-to/use-with-nextjs.

Run `node scripts/test-messaging.mjs` for isolated Socket.IO integration checks. These use an in-memory database substitute and do not send messages to real users.
