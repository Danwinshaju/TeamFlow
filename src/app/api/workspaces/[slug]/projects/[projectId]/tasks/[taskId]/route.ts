import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { projects, taskActivities, tasks, users, workspaceMembers, workspaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/security/session";
import { updateTaskSchema } from "@/lib/validations/task";

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
    .select({ workspaceId: workspaces.id, role: workspaceMembers.role })
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

  const result = updateTaskSchema.safeParse(body);

  if (!result.success) {
    return Response.json(
      { error: "Enter valid task details.", fields: result.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const changes = result.data;

  if (changes.assigneeId) {
    const [assignee] = await db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, access.workspaceId),
          eq(workspaceMembers.userId, changes.assigneeId),
        ),
      )
      .limit(1);

    if (!assignee) {
      return Response.json(
        { error: "The selected assignee is not a workspace member." },
        { status: 400 },
      );
    }
  }

  const updateValues: Partial<typeof tasks.$inferInsert> = { updatedAt: new Date() };
  if (changes.title !== undefined) updateValues.title = changes.title;
  if (changes.description !== undefined) updateValues.description = changes.description || null;
  if (changes.status !== undefined) updateValues.status = changes.status;
  if (changes.priority !== undefined) updateValues.priority = changes.priority;
  if (changes.assigneeId !== undefined) updateValues.assigneeId = changes.assigneeId || null;
  if (changes.dueDate !== undefined) {
    updateValues.dueAt = changes.dueDate
      ? new Date(`${changes.dueDate}T12:00:00.000Z`)
      : null;
  }

  const [updatedTask] = await db
    .update(tasks)
    .set(updateValues)
    .where(
      and(
        eq(tasks.id, taskId),
        eq(tasks.projectId, projectId),
        eq(tasks.workspaceId, access.workspaceId),
      ),
    )
    .returning({ id: tasks.id });

  if (!updatedTask) {
    return Response.json({ error: "Task not found." }, { status: 404 });
  }

  const changedFields = Object.keys(changes).join(", ");
  await db.insert(taskActivities).values({
    taskId: updatedTask.id,
    actorUserId: currentUser.id,
    action: "updated",
    details: `updated ${changedFields}`,
  });

  const [task] = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      assigneeId: tasks.assigneeId,
      assigneeName: users.name,
      dueAt: tasks.dueAt,
      createdByUserId: tasks.createdByUserId,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .where(eq(tasks.id, updatedTask.id))
    .limit(1);

  return Response.json({
    task: { ...task, dueAt: task.dueAt?.toISOString() ?? null },
  });
}

export async function DELETE(_request: Request, context: TaskRouteContext) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const { slug, projectId, taskId } = await context.params;
  const [taskAccess] = await db
    .select({
      workspaceId: workspaces.id,
      role: workspaceMembers.role,
      createdByUserId: tasks.createdByUserId,
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
    .innerJoin(
      workspaceMembers,
      and(
        eq(workspaceMembers.workspaceId, workspaces.id),
        eq(workspaceMembers.userId, currentUser.id),
      ),
    )
    .where(
      and(
        eq(tasks.id, taskId),
        eq(projects.id, projectId),
        eq(workspaces.slug, slug),
      ),
    )
    .limit(1);

  if (!taskAccess) {
    return Response.json({ error: "Task not found." }, { status: 404 });
  }

  const mayDelete =
    taskAccess.role === "owner" ||
    taskAccess.role === "admin" ||
    taskAccess.createdByUserId === currentUser.id;

  if (!mayDelete) {
    return Response.json(
      { error: "Only an owner, admin, or the task creator can delete this task." },
      { status: 403 },
    );
  }

  await db.delete(tasks).where(
    and(
      eq(tasks.id, taskId),
      eq(tasks.projectId, projectId),
      eq(tasks.workspaceId, taskAccess.workspaceId),
    ),
  );

  return Response.json({ message: "Task deleted." });
}
