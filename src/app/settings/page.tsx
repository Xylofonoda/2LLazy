import { getSettingsData } from "@/lib/data/settings";
import { SettingsClient } from "./_components/SettingsClient";

export default async function SettingsPage() {
  const data = await getSettingsData();
  return <SettingsClient {...data} />;
}
