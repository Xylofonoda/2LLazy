"use client";

import {
  Card,
  CardContent,
  CardActions,
  Chip,
  Stack,
  Box,
  Typography,
  Divider,
  IconButton,
  Button,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import type { JobItem } from "@/types";
import { SOURCE_COLOR } from "@/types";

interface JobCardProps {
  job: JobItem;
  /** "search" (default) shows an Interested/Saved CTA. "favourites" shows Send to Dashboard. */
  variant?: "search" | "favourites";
  isApplying?: boolean;
  isToggling?: boolean;
  onApply?: (job: JobItem) => void;
  onToggleFavourite: (job: JobItem) => void;
  onViewCoverLetter?: (coverLetter: { id: string; content: string }) => void;
}

/**
 * Reusable job listing card.
 * Used on the Search page and Favourites page.
 *
 * The optional `similarity` field renders a match-percentage chip.
 * The `favourited` field controls the bookmark icon fill/colour.
 */
export function JobCard({
  job,
  variant = "search",
  isApplying,
  isToggling,
  onApply,
  onToggleFavourite,
  onViewCoverLetter,
}: JobCardProps) {
  return (
    <Card>
      <CardContent sx={{ pb: 1 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
        >
          <Box>
            <Typography variant="h6" sx={{ fontSize: 16 }}>
              {job.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {job.company} · {job.location}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.5} alignItems="center">
            {job.isNew && (
              <Chip label="NEW" size="small" color="success" variant="outlined" />
            )}
            <Chip
              label={job.source}
              size="small"
              color={SOURCE_COLOR[job.source] ?? "default"}
              variant="filled"
            />
          </Stack>
        </Stack>

        {job.salary && (
          <Typography variant="body2" color="success.main" sx={{ mt: 0.5 }}>
            {job.salary}
          </Typography>
        )}

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mt: 1,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {job.description || "No description available."}
        </Typography>
      </CardContent>

      <Divider />

      <CardActions sx={{ px: 2, py: 1 }}>
        {variant === "search" ? (
          <Button
            size="small"
            variant={job.favourited ? "contained" : "outlined"}
            color={job.favourited ? "success" : "primary"}
            startIcon={
              isToggling ? (
                <CircularProgress size={14} />
              ) : job.favourited ? (
                <BookmarkIcon />
              ) : (
                <BookmarkBorderIcon />
              )
            }
            onClick={() => onToggleFavourite(job)}
            disabled={isToggling}
          >
            {job.favourited ? "Saved" : "Interested"}
          </Button>
        ) : (
          <>
            <Button
              size="small"
              variant="contained"
              startIcon={<SendIcon />}
              onClick={() => onApply?.(job)}
              disabled={isApplying}
            >
              {isApplying ? "Tracking..." : "Track Application"}
            </Button>

            {job.coverLetter && onViewCoverLetter && (
              <Button
                size="small"
                variant="outlined"
                color="secondary"
                onClick={() => onViewCoverLetter(job.coverLetter!)}
              >
                Cover Letter
              </Button>
            )}

            <Tooltip title="Remove from favourites">
              <IconButton
                size="small"
                onClick={() => onToggleFavourite(job)}
                disabled={isToggling}
                sx={{ ml: "auto", color: "warning.main" }}
              >
                {isToggling ? (
                  <CircularProgress size={16} />
                ) : (
                  <BookmarkIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
          </>
        )}

        <Tooltip title="Open job posting" sx={variant === "search" ? { ml: "auto" } : undefined}>
          <IconButton
            size="small"
            component="a"
            href={job.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <OpenInNewIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </CardActions>
    </Card>
  );
}
