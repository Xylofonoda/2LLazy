"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Box, Typography, Stack } from "@mui/material";
import { JobCard } from "@/components/jobs/JobCard";
import { JobFilterBar, type JobFilters, DEFAULT_JOB_FILTERS } from "@/components/jobs/JobFilterBar";
import { CoverLetterDialog } from "@/components/dialogs/CoverLetterDialog";
import { StreamingCoverLetterDialog } from "@/components/dialogs/StreamingCoverLetterDialog";
import { ErrorAlertList } from "@/components/ui/ErrorAlertList";
import {
  toggleFavourite,
  applyToJob,
} from "@/lib/actions/jobActions";
import type { JobItem } from "@/types";

interface Props {
  initialJobs: JobItem[];
}

export function FavouritesClient({ initialJobs }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [filters, setFilters] = useState<JobFilters>(DEFAULT_JOB_FILTERS);
  const [clDialog, setClDialog] = useState<{ open: boolean; content: string; jobTitle: string }>({
    open: false,
    content: "",
    jobTitle: "",
  });
  const [streamDlg, setStreamDlg] = useState<{ open: boolean; jobId: string | null; jobTitle: string }>({
    open: false,
    jobId: null,
    jobTitle: "",
  });

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

  const filtered = initialJobs.filter((job) => {
    if (filters.source !== "ALL" && job.source !== filters.source) return false;
    if (filters.hasSalary && !job.salary) return false;
    if (filters.position.trim()) {
      const q = filters.position.toLowerCase();
      if (
        !job.title.toLowerCase().includes(q) &&
        !job.company.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

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

      <JobFilterBar
        jobs={initialJobs}
        filters={filters}
        onChange={setFilters}
      />

      {initialJobs.length === 0 && (
        <Typography color="text.secondary" sx={{ mt: 4, textAlign: "center" }}>
          No favourites yet. Search for jobs and click the bookmark icon to save
          them here.
        </Typography>
      )}

      <Stack spacing={2}>
        {filtered.map((job) => (
          <JobCard
            key={job.id}
            job={{ ...job, favourited: true }}
            isApplying={applyingId === job.id}
            isGenerating={streamDlg.open && streamDlg.jobId === job.id}
            isToggling={togglingId === job.id}
            onApply={handleApply}
            onGenerateCoverLetter={handleGenerateCoverLetter}
            onToggleFavourite={handleToggle}
            onViewCoverLetter={(content) =>
              setClDialog({ open: true, content, jobTitle: job.title })
            }
          />
        ))}
      </Stack>

      <CoverLetterDialog
        open={clDialog.open}
        content={clDialog.content}
        filename={`cover-letter-${clDialog.jobTitle.toLowerCase().replace(/\s+/g, "-")}.txt`}
        onClose={() => setClDialog({ open: false, content: "", jobTitle: "" })}
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
