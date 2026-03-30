import { Stack, Typography } from "@mui/material";
import { ApplicationCard } from "@/components/dashboard/ApplicationCard";
import type { Application, AppStatus } from "@/types";

interface Props {
  applications: Application[];
  isPending: boolean;
  onStatusClick: (id: string, status: AppStatus) => void;
  onViewCoverLetter: (content: string, coverId: string) => void;
}

export function ApplicationList({
  applications,
  isPending,
  onStatusClick,
  onViewCoverLetter,
}: Props) {
  return (
    <>
      {isPending && (
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
          Saving…
        </Typography>
      )}
      <Stack spacing={2}>
        {applications.map((app) => (
          <ApplicationCard
            key={app.id}
            application={app}
            onStatusClick={onStatusClick}
            onViewCoverLetter={onViewCoverLetter}
          />
        ))}
        {applications.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No applications match the current filters.
          </Typography>
        )}
      </Stack>
    </>
  );
}
