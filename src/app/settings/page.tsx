import { getSettingsData } from "@/lib/data/settings";
import { SettingsClient } from "./_components/SettingsClient";

// Settings change rarely; revalidate every 5 minutes or when server actions invalidate
export const revalidate = 300;

export default async function SettingsPage() {
  const data = await getSettingsData();
  return <SettingsClient {...data} />;
}
