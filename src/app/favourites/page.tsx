import { getFavourites, getFavouriteSources } from "@/lib/data/favourites";
import type { FavouriteFilters } from "@/lib/data/favourites";
import { FavouritesClient } from "./_components/FavouritesClient";
import type { JobFilters } from "@/components/jobs/JobFilterBar";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

// Revalidate every 60 s; server actions call revalidatePath so mutations are instant
export const revalidate = 60;

export default async function FavouritesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  const sp = await searchParams;
  const filters: FavouriteFilters = {
    source: sp.source,
    position: sp.position,
    hasSalary: sp.hasSalary === "true",
  };
  const [jobs, sources] = await Promise.all([
    getFavourites(userId, filters),
    getFavouriteSources(userId),
  ]);
  const currentFilters: JobFilters = {
    source: sp.source ?? "ALL",
    position: sp.position ?? "",
    hasSalary: sp.hasSalary === "true",
    workType: sp.workType ?? "ALL",
    city: sp.city ?? "",
    salaryMin: sp.salaryMin ?? "",
    salaryMax: sp.salaryMax ?? "",
  };
  return <FavouritesClient jobs={jobs} filters={currentFilters} sources={sources} />;
}
