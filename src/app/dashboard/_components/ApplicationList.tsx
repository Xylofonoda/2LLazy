import { Stack, Typography, Alert, Button } from "@mui/material";
import Link from "next/link";
import { ApplicationCard } from "@/components/dashboard/ApplicationCard";
import type { Application, AppStatus } from "@/types";

interface Props {
  applications: Application[];
  isPending: boolean;
  onStatusClick: (id: string, status: AppStatus) => void;
  onViewCoverLetter: (content: string, coverId: string) => void;
  onGenerateCoverLetter: (jobId: string, jobTitle: string) => void;
}

export function ApplicationList({
  applications,
  isPending,
  onStatusClick,
  onViewCoverLetter,
  onGenerateCoverLetter,
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
            onGenerateCoverLetter={onGenerateCoverLetter}
          />
        ))}
        {applications.length === 0 && (
          <Alert
            severity="info"
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
              flexWrap: "wrap",
            }}
          >
            <span>No tracked applications yet. Add jobs from Favourites to start your pipeline.</span>
            <Button component={Link} href="/favourites" variant="outlined" size="small">
              Open Favourites
            </Button>
          </Alert>
        )}
      </Stack>
    </>
  );
}
