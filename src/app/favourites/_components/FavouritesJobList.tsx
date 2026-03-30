import { Stack, Typography } from "@mui/material";
import { JobCard } from "@/components/jobs/JobCard";
import type { JobItem } from "@/types";

interface Props {
  jobs: JobItem[];
  applyingId: string | null;
  togglingId: string | null;
  streamingJobId: string | null;
  onApply: (job: JobItem) => void;
  onToggleFavourite: (job: JobItem) => void;
  onGenerateCoverLetter: (job: JobItem) => void;
  onViewCoverLetter: (coverLetter: { id: string; content: string }, jobTitle: string) => void;
}

export function FavouritesJobList({
  jobs,
  applyingId,
  togglingId,
  streamingJobId,
  onApply,
  onToggleFavourite,
  onGenerateCoverLetter,
  onViewCoverLetter,
}: Props) {
  if (jobs.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ mt: 4, textAlign: "center" }}>
        No favourites yet. Search for jobs and click the bookmark icon to save
        them here.
      </Typography>
    );
  }

  return (
    <Stack spacing={2}>
      {jobs.map((job) => (
        <JobCard
          key={job.id}
          job={{ ...job, favourited: true }}
          isApplying={applyingId === job.id}
          isGenerating={streamingJobId === job.id}
          isToggling={togglingId === job.id}
          onApply={onApply}
          onGenerateCoverLetter={onGenerateCoverLetter}
          onToggleFavourite={onToggleFavourite}
          onViewCoverLetter={(coverLetter) => onViewCoverLetter(coverLetter, job.title)}
        />
      ))}
    </Stack>
  );
}
