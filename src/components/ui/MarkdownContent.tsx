"use client";

import ReactMarkdown from "react-markdown";
import { Box } from "@mui/material";

interface Props {
  content: string;
  /** Show a blinking cursor at the end while streaming */
  streaming?: boolean;
}

/**
 * Renders AI-generated Markdown content with clean typography styling.
 * Used in CvAdjustDialog and StreamingCoverLetterDialog.
 */
export function MarkdownContent({ content, streaming = false }: Props) {
  return (
    <Box
      sx={{
        fontFamily: "inherit",
        fontSize: "0.875rem",
        lineHeight: 1.75,
        "& h1": { fontSize: "1.25rem", fontWeight: 700, mt: 0, mb: 0.5 },
        "& h2": { fontSize: "1rem", fontWeight: 700, mt: 2, mb: 0.5, borderBottom: "1px solid", borderColor: "divider", pb: 0.25 },
        "& h3": { fontSize: "0.9rem", fontWeight: 600, mt: 1.5, mb: 0.25 },
        "& p": { mt: 0, mb: 1 },
        "& ul, & ol": { pl: 2.5, mt: 0, mb: 1 },
        "& li": { mb: 0.25 },
        "& strong": { fontWeight: 700 },
        "& hr": { my: 2, border: "none", borderTop: "1px solid", borderColor: "divider" },
        "& code": {
          fontFamily: "monospace",
          fontSize: "0.8rem",
          bgcolor: "action.hover",
          px: 0.5,
          borderRadius: 0.5,
        },
      }}
    >
      <ReactMarkdown>{content}</ReactMarkdown>
      {streaming && (
        <Box
          component="span"
          sx={{
            display: "inline-block",
            width: "0.5em",
            height: "1em",
            bgcolor: "primary.main",
            ml: "2px",
            verticalAlign: "text-bottom",
            borderRadius: "1px",
            animation: "blink 1s step-end infinite",
            "@keyframes blink": {
              "0%, 100%": { opacity: 1 },
              "50%": { opacity: 0 },
            },
          }}
        />
      )}
    </Box>
  );
}
