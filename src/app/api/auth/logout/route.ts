import { deleteCurrentSession } from "@/lib/security/session";

export async function POST(request: Request) {
  await deleteCurrentSession();

  return Response.redirect(
    new URL("/login", request.url),
    303,
  );
}