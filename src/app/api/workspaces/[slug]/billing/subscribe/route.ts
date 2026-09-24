import { getCurrentUser } from "@/lib/security/session";

export const runtime = "nodejs";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  return Response.json(
    { error: "Workspace billing has been removed. Only the platform Owner pays once after login." },
    { status: 410 },
  );
}
