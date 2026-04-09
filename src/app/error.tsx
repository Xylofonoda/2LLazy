"use client";
import { Box, Button, Typography } from "@mui/material";
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <Box sx={{ p: 4, textAlign: "center" }}>
      <Typography variant="h6" sx={{ mb: 1 }}>Something went wrong</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{error.message}</Typography>
      <Button variant="contained" onClick={reset}>Try again</Button>
    </Box>
  );
}
