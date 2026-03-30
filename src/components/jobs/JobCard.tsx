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
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import type { JobItem } from "@/types";
import { SOURCE_COLOR } from "@/types";

interface JobCardProps {
  job: JobItem;
  isApplying?: boolean;
  isGenerating?: boolean;
  isToggling?: boolean;
  onApply: (job: JobItem) => void;
  onGenerateCoverLetter: (job: JobItem) => void;
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
  isApplying,
  isGenerating,
  isToggling,
  onApply,
  onGenerateCoverLetter,
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
        <Button
          size="small"
          variant="contained"
          startIcon={<SendIcon />}
          onClick={() => onApply(job)}
          disabled={isApplying}
        >
          {isApplying ? "Applying..." : "Auto-Apply"}
        </Button>

        <Button
          size="small"
          variant="outlined"
          startIcon={<AutoAwesomeIcon />}
          onClick={() => onGenerateCoverLetter(job)}
          disabled={isGenerating}
        >
          {isGenerating ? "Generating..." : "Gen Cover Letter"}
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

        <Tooltip
          title={job.favourited ? "Remove from favourites" : "Save to favourites"}
        >
          <IconButton
            size="small"
            onClick={() => onToggleFavourite(job)}
            disabled={isToggling}
            sx={{
              ml: "auto",
              color: job.favourited ? "warning.main" : "text.secondary",
            }}
          >
            {isToggling ? (
              <CircularProgress size={16} />
            ) : job.favourited ? (
              <BookmarkIcon fontSize="small" />
            ) : (
              <BookmarkBorderIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>

        <Tooltip title="Open job posting">
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
