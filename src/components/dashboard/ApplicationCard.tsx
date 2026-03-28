"use client";

import {
  Card,
  CardContent,
  Stack,
  Box,
  Typography,
  Chip,
  Button,
  IconButton,
  Tooltip,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import EditIcon from "@mui/icons-material/Edit";
import type { Application, AppStatus } from "@/types";
import { STATUS_COLOR } from "@/types";

interface ApplicationCardProps {
  application: Application;
  onStatusClick: (id: string, status: AppStatus) => void;
  onViewCoverLetter: (content: string) => void;
}

/** Single application row card for the Dashboard page. */
export function ApplicationCard({
  application: app,
  onStatusClick,
  onViewCoverLetter,
}: ApplicationCardProps) {
  return (
    <Card>
      <CardContent>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
        >
          <Box>
            <Typography variant="h6" sx={{ fontSize: 15 }}>
              {app.job.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {app.job.company} · {app.job.location}
            </Typography>
            {app.appliedAt && (
              <Typography variant="caption" color="text.secondary">
                Applied: {new Date(app.appliedAt).toLocaleDateString()}
              </Typography>
            )}
            {app.errorMessage && (
              <Typography
                variant="caption"
                color="error.main"
                display="block"
              >
                Error: {app.errorMessage}
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              label={app.status}
              size="small"
              color={STATUS_COLOR[app.status]}
            />
            <Chip label={app.job.source} size="small" variant="outlined" />
          </Stack>
        </Stack>

        {app.interview && (
          <Box
            sx={{
              mt: 1,
              p: 1,
              bgcolor: "success.main",
              borderRadius: 1,
              opacity: 0.85,
            }}
          >
            <Typography variant="caption" color="#fff">
              📅 Interview:{" "}
              {new Date(app.interview.scheduledAt).toLocaleString()} (
              {app.interview.durationMinutes} min)
              {app.interview.notes ? ` — ${app.interview.notes}` : ""}
            </Typography>
          </Box>
        )}
      </CardContent>

      <Stack direction="row" spacing={1} sx={{ px: 2, pb: 2 }}>
        <Tooltip title="Change status">
          <Button
            size="small"
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => onStatusClick(app.id, app.status)}
          >
            Status
          </Button>
        </Tooltip>

        {app.coverLetter && (
          <Button
            size="small"
            variant="outlined"
            onClick={() => onViewCoverLetter(app.coverLetter!.content)}
          >
            View Cover Letter
          </Button>
        )}

        <Tooltip title="Open job posting">
          <IconButton
            size="small"
            component="a"
            href={app.job.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <OpenInNewIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Card>
  );
}
