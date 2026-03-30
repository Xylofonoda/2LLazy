"use client";

import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import { downloadAsDocx } from "@/lib/downloadDocx";

interface Props {
  open: boolean;
  /** jobId to stream. Passing null while open=false resets state. */
  jobId: string | null;
  jobTitle: string;
  onClose: () => void;
  /** Called once the stream completes successfully so the parent can refresh. */
  onComplete: () => void;
}

export function StreamingCoverLetterDialog({
  open,
  jobId,
  jobTitle,
  onClose,
  onComplete,
}: Props) {
  const [content, setContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open || !jobId) {
      setContent("");
      setError(null);
      return;
    }

    setContent("");
    setError(null);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    (async () => {
      try {
        const res = await fetch("/api/cover-letter/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`Request failed: ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // SSE chunks are separated by \n\n
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const line = part.startsWith("data: ") ? part.slice(6) : part;
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line) as {
                token?: string;
                done?: boolean;
                error?: string;
              };
              if (parsed.token) setContent((prev) => prev + parsed.token);
              if (parsed.error) {
                setError(parsed.error);
                return;
              }
              if (parsed.done) {
                setIsStreaming(false);
                onComplete();
                return;
              }
            } catch {
              // skip malformed line
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError(String(err));
        }
      } finally {
        setIsStreaming(false);
      }
    })();

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, jobId]);

  const handleClose = () => {
    abortRef.current?.abort();
    onClose();
  };

  const handleDownload = () =>
    downloadAsDocx(content, `cover-letter-${jobTitle.toLowerCase().replace(/\s+/g, "-")}`);

  return (
    <Dialog
      open={open}
      onClose={isStreaming ? undefined : handleClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        Cover Letter{isStreaming ? " — Writing…" : ""}
      </DialogTitle>

      <DialogContent dividers>
        {error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", minHeight: 80 }}>
            {content}
            {isStreaming && (
              <Box
                component="span"
                sx={{
                  display: "inline-block",
                  width: "0.5em",
                  height: "1em",
                  bgcolor: "text.primary",
                  verticalAlign: "text-bottom",
                  ml: 0.25,
                  animation: "blink 1s step-end infinite",
                  "@keyframes blink": {
                    "0%, 100%": { opacity: 1 },
                    "50%": { opacity: 0 },
                  },
                }}
              />
            )}
          </Typography>
        )}
      </DialogContent>

      <DialogActions>
        {!isStreaming && content && (
          <Button startIcon={<DownloadIcon />} onClick={handleDownload}>
            Download .docx
          </Button>
        )}
        <Button onClick={handleClose} disabled={isStreaming}>
          {isStreaming ? "Generating…" : "Close"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
