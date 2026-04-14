import { auth } from "@/auth";
import { redirect } from "next/navigation";

/** Returns the authenticated user's ID, redirects to /login if not authenticated. */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}
