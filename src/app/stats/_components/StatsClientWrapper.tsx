"use client";

import dynamic from "next/dynamic";

interface Props {
  byStatus: { status: string; count: number }[];
  bySource: { source: string; count: number }[];
  weekly: { week: string; count: number }[];
  totalApplications: number;
  interviewRate: number;
}

const StatsClientDynamic = dynamic(
  () => import("./StatsClient").then((m) => m.StatsClient),
  { ssr: false },
);

export function StatsClientWrapper(props: Props) {
  return <StatsClientDynamic {...props} />;
}
