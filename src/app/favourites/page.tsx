import { getFavourites } from "@/lib/data/favourites";
import { FavouritesClient } from "./_components/FavouritesClient";

export default async function FavouritesPage() {
  const jobs = await getFavourites();
  return <FavouritesClient initialJobs={jobs} />;
}
