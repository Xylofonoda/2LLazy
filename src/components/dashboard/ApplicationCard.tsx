"use client";

import { useState } from "react";
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
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import type { Application, AppStatus } from "@/types";
import { STATUS_COLOR, SOURCE_COLOR } from "@/types";
import { AutoApplyDialog } from "@/components/dialogs/AutoApplyDialog";

interface ApplicationCardProps {
  application: Application;
  onStatusClick: (id: string, status: AppStatus) => void;
  onViewCoverLetter: (content: string, coverId: string) => void;
  onGenerateCoverLetter: (jobId: string, jobTitle: string) => void;
}

/** Single application row card for the Dashboard page. */
export function ApplicationCard({
  application: app,
  onStatusClick,
  onViewCoverLetter,
  onGenerateCoverLetter,
}: ApplicationCardProps) {
  const [autoApplyOpen, setAutoApplyOpen] = useState(false);

  return (
    <>
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
                  Couldn&apos;t auto-apply this time. Try applying yourself — good luck!
                </Typography>
              )}
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                label={app.status}
                size="small"
                color={STATUS_COLOR[app.status]}
              />
              <Chip
                label={app.job.source}
                size="small"
                color={SOURCE_COLOR[app.job.source] ?? "default"}
                variant="filled"
              />
            </Stack>
          </Stack>

          {app.job.description && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 1,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {app.job.description}
            </Typography>
          )}

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

          {app.status === "PENDING" && (
            <Tooltip title="Auto-fill and submit this application">
              <Button
                size="small"
                variant="outlined"
                color="primary"
                startIcon={<RocketLaunchIcon />}
                onClick={() => setAutoApplyOpen(true)}
              >
                Auto Apply
              </Button>
            </Tooltip>
          )}

          {app.coverLetter && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => onViewCoverLetter(app.coverLetter!.content, app.coverLetter!.id)}
            >
              View Cover Letter
            </Button>
          )}

          {!app.coverLetter && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<AutoAwesomeIcon />}
              onClick={() => onGenerateCoverLetter(app.job.id, app.job.title)}
            >
              Gen Cover Letter
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

      <AutoApplyDialog
        application={app}
        open={autoApplyOpen}
        onClose={() => setAutoApplyOpen(false)}
      />
    </>
  );
}
