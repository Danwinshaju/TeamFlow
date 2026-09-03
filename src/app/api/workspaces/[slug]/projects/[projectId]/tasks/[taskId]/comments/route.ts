import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  projects,
  taskActivities,
  taskComments,
  tasks,
  users,
  workspaceMembers,
  workspaces,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/security/session";
import { createTaskCommentSchema } from "@/lib/validations/task";

export const runtime = "nodejs";

type CommentsRouteContext = {
  params: Promise<{ slug: string; projectId: string; taskId: string }>;
};

export async function POST(request: Request, context: CommentsRouteContext) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const { slug, projectId, taskId } = await context.params;
  const [access] = await db
    .select({ taskId: tasks.id, projectStatus: projects.status })
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

  if (!access) {
    return Response.json({ error: "Task not found." }, { status: 404 });
  }

  if (access.projectStatus === "archived") {
    return Response.json({ error: "Reactivate this project before adding comments." }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const result = createTaskCommentSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ error: "Enter a valid comment." }, { status: 400 });
  }

  const [comment] = await db
    .insert(taskComments)
    .values({ taskId, userId: currentUser.id, body: result.data.body })
    .returning({
      id: taskComments.id,
      body: taskComments.body,
      createdAt: taskComments.createdAt,
    });

  await db.insert(taskActivities).values({
    taskId,
    actorUserId: currentUser.id,
    action: "commented",
    details: "added a comment",
  });

  const [author] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, currentUser.id))
    .limit(1);

  return Response.json(
    {
      comment: {
        ...comment,
        authorName: author?.name ?? currentUser.name,
        createdAt: comment.createdAt.toISOString(),
      },
    },
    { status: 201 },
  );
}
