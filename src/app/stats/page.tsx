import { getStatsData } from "@/lib/data/stats";
import { StatsClientWrapper } from "./_components/StatsClientWrapper";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export const revalidate = 60;

export default async function StatsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const data = await getStatsData(session.user.id);
  return <StatsClientWrapper {...data} />;
}
