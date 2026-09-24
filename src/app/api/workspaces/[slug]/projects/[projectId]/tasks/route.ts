import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  projects,
  taskActivities,
  tasks,
  users,
  workspaceMembers,
  workspaceMessages,
  workspaces,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/security/session";
import { createTaskSchema } from "@/lib/validations/task";

export const runtime = "nodejs";

type TasksRouteContext = {
  params: Promise<{ slug: string; projectId: string }>;
};

export async function POST(request: Request, context: TasksRouteContext) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  if (currentUser.status !== "active") {
    return Response.json(
      { error: "Verify your email before creating tasks." },
      { status: 403 },
    );
  }

  const { slug, projectId } = await context.params;
  const [access] = await db
    .select({ workspaceId: workspaces.id, projectStatus: projects.status, role: workspaceMembers.role })
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

  if (access.role !== "owner" && access.role !== "admin") {
    return Response.json(
      { error: "Only workspace Owners and Admins can create and assign tasks." },
      { status: 403 },
    );
  }

  if (access.projectStatus === "archived") {
    return Response.json({ error: "Reactivate this project before creating tasks." }, { status: 409 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const result = createTaskSchema.safeParse(body);

  if (!result.success) {
    return Response.json(
      {
        error: "Enter valid task details.",
        fields: result.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  let assigneeName: string | null = null;

  if (result.data.assigneeId) {
    const [assignee] = await db
      .select({ name: users.name })
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(
        and(
          eq(workspaceMembers.workspaceId, access.workspaceId),
          eq(workspaceMembers.userId, result.data.assigneeId),
        ),
      )
      .limit(1);

    if (!assignee) {
      return Response.json(
        { error: "The selected assignee is not a workspace member." },
        { status: 400 },
      );
    }

    assigneeName = assignee.name;
  }

  const task = await db.transaction(async (transaction) => {
    const [createdTask] = await transaction
      .insert(tasks)
      .values({
        projectId,
        workspaceId: access.workspaceId,
        title: result.data.title,
        description: result.data.description || null,
        priority: result.data.priority,
        assigneeId: result.data.assigneeId || null,
        dueAt: result.data.dueDate
          ? new Date(`${result.data.dueDate}T23:59:59.999Z`)
          : null,
        createdByUserId: currentUser.id,
      })
      .returning();

    await transaction.insert(taskActivities).values({
      taskId: createdTask.id,
      actorUserId: currentUser.id,
      action: "created",
      details: result.data.assigneeId
        ? `created and assigned this task to ${assigneeName}`
        : "created this task",
    });

    if (result.data.assigneeId && result.data.assigneeId !== currentUser.id) {
      const dueText = result.data.dueDate ? ` Due: ${result.data.dueDate}.` : "";
      await transaction.insert(workspaceMessages).values({
        workspaceId: access.workspaceId,
        userId: currentUser.id,
        recipientUserId: result.data.assigneeId,
        body: `📋 New task assigned to you: “${result.data.title}”. Priority: ${result.data.priority}.${dueText} Open My tasks to view it.`,
      });
    }

    return createdTask;
  });

  return Response.json(
    {
      task: {
        ...task,
        assigneeName,
        dueAt: task.dueAt?.toISOString() ?? null,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      },
    },
    { status: 201 },
  );
}
