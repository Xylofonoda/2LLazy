"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Box, Typography } from "@mui/material";
import { JobFilterBar, type JobFilters } from "@/components/jobs/JobFilterBar";
import { CoverLetterDialog } from "@/components/dialogs/CoverLetterDialog";
import { StreamingCoverLetterDialog } from "@/components/dialogs/StreamingCoverLetterDialog";
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
  const [streamDlg, setStreamDlg] = useState<{ open: boolean; jobId: string | null; jobTitle: string }>({
    open: false,
    jobId: null,
    jobTitle: "",
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

  const handleGenerateCoverLetter = (job: JobItem) => {
    setStreamDlg({ open: true, jobId: job.id, jobTitle: job.title });
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Favourites
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Jobs you&apos;ve saved. Apply or generate a cover letter when you&apos;re ready.
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
        streamingJobId={streamDlg.open ? streamDlg.jobId : null}
        onApply={handleApply}
        onToggleFavourite={handleToggle}
        onGenerateCoverLetter={handleGenerateCoverLetter}
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

      <StreamingCoverLetterDialog
        open={streamDlg.open}
        jobId={streamDlg.jobId}
        jobTitle={streamDlg.jobTitle}
        onClose={() => setStreamDlg({ open: false, jobId: null, jobTitle: "" })}
        onComplete={() => {
          setStreamDlg((prev) => ({ ...prev, open: false }));
          router.refresh();
        }}
      />
    </Box>
  );
}
