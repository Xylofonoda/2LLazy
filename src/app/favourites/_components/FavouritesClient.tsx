"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Box, Typography } from "@mui/material";
import { JobFilterBar, type JobFilters } from "@/components/jobs/JobFilterBar";
import { CoverLetterDialog } from "@/components/dialogs/CoverLetterDialog";
import { ErrorAlertList } from "@/components/ui/ErrorAlertList";
import { toggleFavourite, applyToJob } from "@/lib/actions/jobActions";
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

  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [deletedCoverLetterIds, setDeletedCoverLetterIds] = useState<Set<string>>(new Set());
  const [clDialog, setClDialog] = useState<{ open: boolean; content: string; jobTitle: string; coverId: string | null }>({
    open: false,
    content: "",
    jobTitle: "",
    coverId: null,
  });
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

  const handleApply = (job: JobItem) => {
    setApplyingId(job.id);
    startTransition(async () => {
      try {
        await applyToJob(job.id);
        router.refresh();
      } catch (err) {
        setErrors((prev) => [
          ...prev,
          `Apply failed for ${job.title}: ${String(err)}`,
        ]);
      } finally {
        setApplyingId(null);
      }
    });
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Favourites
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Jobs you&apos;ve saved. Send them to the dashboard to auto-apply.
      </Typography>

      <ErrorAlertList
        errors={errors}
        onDismiss={(i) => setErrors((prev) => prev.filter((_, j) => j !== i))}
      />

      <JobFilterBar sources={sources} filters={filters} onChange={handleFilterChange} />

      <FavouritesJobList
        jobs={jobs.map((j) =>
          j.coverLetter && deletedCoverLetterIds.has(j.coverLetter.id)
            ? { ...j, coverLetter: null }
            : j
        )}
        applyingId={applyingId}
        togglingId={togglingId}
        onApply={handleApply}
        onToggleFavourite={handleToggle}
        onViewCoverLetter={(coverLetter, jobTitle) =>
          setClDialog({ open: true, content: coverLetter.content, jobTitle, coverId: coverLetter.id })
        }
      />

      <CoverLetterDialog
        open={clDialog.open}
        content={clDialog.content}
        filenameStem={`cover-letter-${clDialog.jobTitle.toLowerCase().replace(/\s+/g, "-")}`}
        onClose={() => setClDialog({ open: false, content: "", jobTitle: "", coverId: null })}
        onDelete={clDialog.coverId ? async () => {
          const idToDelete = clDialog.coverId!;
          // Immediately remove from UI before waiting for server
          setDeletedCoverLetterIds((prev) => new Set(prev).add(idToDelete));
          setClDialog({ open: false, content: "", jobTitle: "", coverId: null });
          await fetch("/api/graphql", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: `mutation Del($id: ID!) { deleteCoverLetter(id: $id) }`,
              variables: { id: idToDelete },
            }),
          });
          router.refresh();
        } : undefined}
      />

    </Box>
  );
}
