import { getApplications } from "@/lib/data/applications";
import { DashboardClient } from "./_components/DashboardClient";

export default async function DashboardPage() {
  const applications = await getApplications();
  return <DashboardClient initialApplications={applications} />;
}
