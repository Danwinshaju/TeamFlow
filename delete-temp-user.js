import { Client } from 'pg';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const conn = process.env.DATABASE_URL;
if (!conn) throw new Error('DATABASE_URL is required.');
const email = 'danwin212@gmail.com';

const client = new Client({
  connectionString: conn,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  await client.connect();

  const userResult = await client.query(
    'SELECT id, email FROM "users" WHERE email = $1',
    [email],
  );

  if (!userResult.rows.length) {
    console.log(JSON.stringify({ deleted: 0, email, message: 'No matching user record found.' }, null, 2));
    await client.end();
    return;
  }

  const userId = userResult.rows[0].id;

  await client.query('BEGIN');

  await client.query('DELETE FROM "task_comments" WHERE user_id = $1', [userId]);
  await client.query('DELETE FROM "task_activities" WHERE actor_user_id = $1', [userId]);
  await client.query('DELETE FROM "tasks" WHERE created_by_user_id = $1 OR assignee_id = $1', [userId]);
  await client.query('DELETE FROM "projects" WHERE created_by_user_id = $1', [userId]);
  await client.query('DELETE FROM "workspace_members" WHERE user_id = $1', [userId]);
  await client.query('DELETE FROM "workspace_invitations" WHERE invited_by_user_id = $1', [userId]);
  await client.query('DELETE FROM "auth_tokens" WHERE user_id = $1', [userId]);
  await client.query('DELETE FROM "sessions" WHERE user_id = $1', [userId]);
  await client.query('DELETE FROM "workspaces" WHERE owner_id = $1', [userId]);

  const deleted = await client.query(
    'DELETE FROM "users" WHERE id = $1 RETURNING id, email',
    [userId],
  );

  await client.query('COMMIT');

  console.log(JSON.stringify({ deleted: deleted.rowCount, rows: deleted.rows, email }, null, 2));
  await client.end();
})().catch(async (err) => {
  try {
    await client.query('ROLLBACK');
  } catch {
    // ignore rollback failures
  }
  console.error(err);
  process.exit(1);
});
