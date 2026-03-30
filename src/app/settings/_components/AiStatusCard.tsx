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
  ollamaHealth: { ok: boolean; missing: string[] };
}

export function AiStatusCard({ hasOpenAI, ollamaHealth }: Props) {
  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          AI Status
        </Typography>

        <Stack direction="row" spacing={1.5} flexWrap="wrap">
          <StatusBadge
            label="OpenAI"
            ok={hasOpenAI}
            okText="GPT-4o-mini active"
            errorText="Not configured"
          />
          <StatusBadge
            label="Ollama"
            ok={ollamaHealth.ok}
            okText="All models available"
            errorText="Issue detected"
          />
        </Stack>

        {!hasOpenAI && (
          <Alert severity="info" sx={{ mt: 2, py: 0.5 }}>
            Add <code>OPENAI_API_KEY</code> to <code>.env</code> to enable GPT-4o-mini.
            Without it, raw page text is used for extraction and Ollama handles cover letters.
          </Alert>
        )}
        {!ollamaHealth.ok &&
          ollamaHealth.missing.map((m) => (
            <Alert key={m} severity="warning" sx={{ mt: 1, py: 0 }}>
              Missing model: <strong>{m}</strong> — run <code>ollama pull {m}</code>
            </Alert>
          ))}
      </CardContent>
    </Card>
  );
}
