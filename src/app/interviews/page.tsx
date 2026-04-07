import { getCalendarEntriesForMonth } from "@/lib/data/interviews";
import { InterviewsClient } from "./_components/InterviewsClient";

export const dynamic = "force-dynamic";

export default async function InterviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const params = await searchParams;
  const today = new Date();
  const month = Number(params.month ?? today.getMonth() + 1);
  const year = Number(params.year ?? today.getFullYear());
  const entries = await getCalendarEntriesForMonth(month, year);
  return <InterviewsClient initialEntries={entries} month={month} year={year} />;
}
