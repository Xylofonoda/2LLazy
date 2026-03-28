import { getInterviewsForMonth } from "@/lib/data/interviews";
import { InterviewsClient } from "./_components/InterviewsClient";

export default async function InterviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const params = await searchParams;
  const today = new Date();
  const month = Number(params.month ?? today.getMonth() + 1);
  const year = Number(params.year ?? today.getFullYear());
  const interviews = await getInterviewsForMonth(month, year);
  return <InterviewsClient initialInterviews={interviews} month={month} year={year} />;
}
