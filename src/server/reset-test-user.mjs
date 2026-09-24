export async function resetTestUserOnStartup(pool) {
  if (process.env.NODE_ENV === "production" || process.env.RESET_TEST_USER_ON_START !== "true") {
    return;
  }

  const email = process.env.TEST_USER_EMAIL?.trim().toLowerCase();
  if (!email) {
    console.warn("Test-user reset is enabled, but TEST_USER_EMAIL is empty.");
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const userResult = await client.query('SELECT id FROM "users" WHERE lower("email") = $1 FOR UPDATE', [email]);

    if (!userResult.rows.length) {
      await client.query("COMMIT");
      console.log(`Test user reset: ${email} was not registered.`);
      return;
    }

    const userId = userResult.rows[0].id;
    await client.query('DELETE FROM "task_comments" WHERE "user_id" = $1', [userId]);
    await client.query('DELETE FROM "task_activities" WHERE "actor_user_id" = $1', [userId]);
    await client.query('DELETE FROM "tasks" WHERE "created_by_user_id" = $1', [userId]);
    await client.query('UPDATE "tasks" SET "assignee_id" = NULL WHERE "assignee_id" = $1', [userId]);
    await client.query('DELETE FROM "projects" WHERE "created_by_user_id" = $1', [userId]);
    await client.query('DELETE FROM "workspace_invitations" WHERE "invited_by_user_id" = $1', [userId]);
    await client.query('DELETE FROM "workspaces" WHERE "owner_id" = $1', [userId]);
    await client.query('DELETE FROM "users" WHERE "id" = $1', [userId]);
    await client.query("COMMIT");
    console.log(`Test user reset: deleted ${email} and its owned test data.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
