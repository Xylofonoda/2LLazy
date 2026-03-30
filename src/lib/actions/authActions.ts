"use server";

import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";
import { redirect } from "next/navigation";

export async function loginAction(formData: FormData): Promise<void> {
  const password = (formData.get("password") as string | null) ?? "";
  if (!password || !process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    redirect("/login?error=1");
  }
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  session.authenticated = true;
  await session.save();
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  await session.destroy();
  redirect("/login");
}
