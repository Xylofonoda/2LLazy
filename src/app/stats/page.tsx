import { getStatsData } from "@/lib/data/stats";
import { StatsClientWrapper } from "./_components/StatsClientWrapper";

export const revalidate = 60;

export default async function StatsPage() {
  const data = await getStatsData();
  return <StatsClientWrapper {...data} />;
}
