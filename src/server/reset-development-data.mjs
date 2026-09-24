const APP_TABLES = [
  "task_activities",
  "task_comments",
  "tasks",
  "projects",
  "workspace_messages",
  "workspace_invitations",
  "workspace_members",
  "workspace_subscriptions",
  "user_access_requests",
  "workspaces",
  "auth_tokens",
  "sessions",
  "users",
];

function enabled() {
  return process.env.NODE_ENV !== "production" &&
    process.env.RESET_ALL_TEST_DATA === "true" &&
    process.env.CONFIRM_DEVELOPMENT_DATA_RESET === "TEAMFLOW_TEST_ONLY";
}

export async function resetDevelopmentData(pool, reason) {
  if (!enabled()) return false;

  // Never erase active accounts merely because the development server stopped.
  // An explicit startup reset remains available for a deliberately clean test run.
  if (reason === "shutdown") return false;

  const quotedTables = APP_TABLES.map((table) => `"${table}"`).join(", ");
  await pool.query(`TRUNCATE TABLE ${quotedTables} RESTART IDENTITY CASCADE`);
  console.log(`Development reset (${reason}): cleared all TeamFlow test users and workspace data.`);
  return true;
}
