import { getStatsData } from "@/lib/data/stats";
import { StatsClient } from "./_components/StatsClient";

export const revalidate = 60;

export default async function StatsPage() {
  const data = await getStatsData();
  return <StatsClient {...data} />;
}
