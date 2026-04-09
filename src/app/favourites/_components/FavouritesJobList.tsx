import { Stack, Typography, Alert, Button } from "@mui/material";
import Link from "next/link";
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
      <Alert
        severity="info"
        sx={{
          mt: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <span>No favourites yet. Save jobs from Search using the Interested button.</span>
        <Button component={Link} href="/" variant="outlined" size="small">
          Go to Search
        </Button>
      </Alert>
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
