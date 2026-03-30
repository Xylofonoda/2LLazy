import { Stack, Typography } from "@mui/material";
import { JobCard } from "@/components/jobs/JobCard";
import type { JobItem } from "@/types";

interface Props {
  jobs: JobItem[];
  applyingId: string | null;
  togglingId: string | null;
  onApply: (job: JobItem) => void;
  onToggleFavourite: (job: JobItem) => void;
  onViewCoverLetter: (coverLetter: { id: string; content: string }, jobTitle: string) => void;
}

export function FavouritesJobList({
  jobs,
  applyingId,
  togglingId,
  onApply,
  onToggleFavourite,
  onViewCoverLetter,
}: Props) {
  if (jobs.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ mt: 4, textAlign: "center" }}>
        No favourites yet. Search for jobs and click &ldquo;Interested&rdquo; to save them here.
      </Typography>
    );
  }

  return (
    <Stack spacing={2}>
      {jobs.map((job) => (
        <JobCard
          key={job.id}
          job={{ ...job, favourited: true }}
          variant="favourites"
          isApplying={applyingId === job.id}
          isToggling={togglingId === job.id}
          onApply={onApply}
          onToggleFavourite={onToggleFavourite}
          onViewCoverLetter={(coverLetter) => onViewCoverLetter(coverLetter, job.title)}
        />
      ))}
    </Stack>
  );
}
