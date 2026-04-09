"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Box, Typography } from "@mui/material";
import { JobFilterBar, type JobFilters } from "@/components/jobs/JobFilterBar";
import { ErrorAlertList } from "@/components/ui/ErrorAlertList";
import { toggleFavourite, trackJob } from "@/lib/actions/jobActions";
import { FavouritesJobList } from "./FavouritesJobList";
import type { JobItem } from "@/types";

interface Props {
  jobs: JobItem[];
  filters: JobFilters;
  sources: string[];
}

export function FavouritesClient({ jobs, filters, sources }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const handleFilterChange = (newFilters: JobFilters) => {
    const params = new URLSearchParams();
    if (newFilters.source !== "ALL") params.set("source", newFilters.source);
    if (newFilters.position) params.set("position", newFilters.position);
    if (newFilters.hasSalary) params.set("hasSalary", "true");
    router.replace(`/favourites${params.size > 0 ? `?${params.toString()}` : ""}`);
  };

  const handleToggle = (job: JobItem) => {
    setTogglingId(job.id);
    startTransition(async () => {
      try {
        await toggleFavourite(job.id);
        router.refresh();
      } catch (err) {
        setErrors((prev) => [...prev, `Failed: ${String(err)}`]);
      } finally {
        setTogglingId(null);
      }
    });
  };

  const handleTrack = (job: JobItem) => {
    setTrackingId(job.id);
    startTransition(async () => {
      try {
        await trackJob(job.id);
        router.refresh();
      } catch (err) {
        setErrors((prev) => [
          ...prev,
          `Track failed for ${job.title}: ${String(err)}`,
        ]);
      } finally {
        setTrackingId(null);
      }
    });
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Favourites
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Save jobs here. Click Track to add them to your dashboard.
      </Typography>

      <ErrorAlertList
        errors={errors}
        onDismiss={(i) => setErrors((prev) => prev.filter((_, j) => j !== i))}
      />

      <JobFilterBar sources={sources} filters={filters} onChange={handleFilterChange} />

      <FavouritesJobList
        jobs={jobs}
        applyingId={trackingId}
        togglingId={togglingId}
        onApply={handleTrack}
        onToggleFavourite={handleToggle}
      />
    </Box>
  );
}
