"use client";

import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Alert,
  Paper,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";

function StatusBadge({
  label,
  ok,
  okText,
  errorText,
}: {
  label: string;
  ok: boolean;
  okText: string;
  errorText: string;
}) {
  return (
    <Paper
      variant="outlined"
      sx={(theme) => ({
        display: "inline-flex",
        alignItems: "center",
        gap: 1,
        px: 1.5,
        py: 1,
        borderRadius: 1.5,
        borderColor: ok ? theme.palette.success.main : theme.palette.error.main,
        bgcolor: ok
          ? `${theme.palette.success.main}14`
          : `${theme.palette.error.main}14`,
      })}
    >
      {ok ? (
        <CheckCircleIcon fontSize="small" color="success" />
      ) : (
        <ErrorIcon fontSize="small" color="error" />
      )}
      <Box>
        <Typography variant="caption" color="text.secondary" display="block" lineHeight={1.2}>
          {label}
        </Typography>
        <Typography variant="body2" fontWeight={500} lineHeight={1.4}>
          {ok ? okText : errorText}
        </Typography>
      </Box>
    </Paper>
  );
}

interface Props {
  hasOpenAI: boolean;
  aiHealth: { ok: boolean; missing: string[] };
}

export function AiStatusCard({ hasOpenAI, aiHealth }: Props) {
  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          AI Status
        </Typography>

        <Stack direction="row" spacing={1.5} flexWrap="wrap">
          <StatusBadge
            label="OpenAI (GPT-4o)"
            ok={hasOpenAI}
            okText="Active"
            errorText="Not configured"
          />
        </Stack>

        {!aiHealth.ok && (
          <Alert severity="error" sx={{ mt: 2, py: 0.5 }}>
            <code>OPENAI_API_KEY</code> is not set. Add it to your environment variables to
            enable AI features (embeddings, cover letters, scraping).
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
