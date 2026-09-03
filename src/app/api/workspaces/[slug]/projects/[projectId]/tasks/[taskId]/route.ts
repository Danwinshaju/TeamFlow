import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { projects, tasks, workspaceMembers, workspaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/security/session";
import { updateTaskStatusSchema } from "@/lib/validations/task";

export const runtime = "nodejs";

type TaskRouteContext = {
  params: Promise<{
    slug: string;
    projectId: string;
    taskId: string;
  }>;
};

export async function PATCH(request: Request, context: TaskRouteContext) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const { slug, projectId, taskId } = await context.params;
  const [access] = await db
    .select({ workspaceId: workspaces.id })
    .from(projects)
    .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
    .innerJoin(
      workspaceMembers,
      and(
        eq(workspaceMembers.workspaceId, workspaces.id),
        eq(workspaceMembers.userId, currentUser.id),
      ),
    )
    .where(and(eq(projects.id, projectId), eq(workspaces.slug, slug)))
    .limit(1);

  if (!access) {
    return Response.json({ error: "Project not found." }, { status: 404 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const result = updateTaskStatusSchema.safeParse(body);

  if (!result.success) {
    return Response.json({ error: "Select a valid task status." }, { status: 400 });
  }

  const [task] = await db
    .update(tasks)
    .set({ status: result.data.status, updatedAt: new Date() })
    .where(
      and(
        eq(tasks.id, taskId),
        eq(tasks.projectId, projectId),
        eq(tasks.workspaceId, access.workspaceId),
      ),
    )
    .returning({
      id: tasks.id,
      status: tasks.status,
      updatedAt: tasks.updatedAt,
    });

  if (!task) {
    return Response.json({ error: "Task not found." }, { status: 404 });
  }

  return Response.json({
    task: { ...task, updatedAt: task.updatedAt.toISOString() },
  });
}
