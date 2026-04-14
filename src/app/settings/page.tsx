import { getSettingsData } from "@/lib/data/settings";
import { SettingsClient } from "./_components/SettingsClient";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { checkCalendarAccess } from "@/lib/actions/settingsActions";

// Settings change rarely; revalidate every 5 minutes or when server actions invalidate
export const revalidate = 300;

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const [data, hasCalendarAccess] = await Promise.all([
    getSettingsData(session.user.id),
    checkCalendarAccess(),
  ]);
  return <SettingsClient {...data} hasCalendarAccess={hasCalendarAccess} />;
}
