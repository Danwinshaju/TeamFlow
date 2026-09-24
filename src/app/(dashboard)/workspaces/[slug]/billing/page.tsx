import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/security/session";

export default async function LegacyWorkspaceBillingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect("/dashboard");
}
