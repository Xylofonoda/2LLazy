import { getSettingsData } from "@/lib/data/settings";
import { SettingsClient } from "./_components/SettingsClient";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

// Settings change rarely; revalidate every 5 minutes or when server actions invalidate
export const revalidate = 300;

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const data = await getSettingsData(session.user.id);
  return <SettingsClient {...data} />;
}
