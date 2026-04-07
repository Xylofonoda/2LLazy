"use client";

import { useFormStatus } from "react-dom";
import { Box, Button, CircularProgress, TextField, Typography, Alert } from "@mui/material";
import FlashOnIcon from "@mui/icons-material/FlashOn";
import { loginAction } from "@/lib/actions/authActions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="contained" disabled={pending} sx={{ mt: 0.5 }}>
      {pending ? <CircularProgress size={20} color="inherit" /> : "Sign in"}
    </Button>
  );
}

export function LoginForm({ error }: { error?: string }) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
      }}
    >
      <Box
        component="form"
        action={loginAction}
        sx={{
          p: 4,
          bgcolor: "background.paper",
          borderRadius: 2,
          border: "1px solid rgba(255,255,255,0.06)",
          width: "100%",
          maxWidth: 360,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <FlashOnIcon sx={{ color: "primary.main" }} />
          <Typography variant="h6" sx={{ color: "primary.main", fontSize: 18, fontWeight: 700 }}>
            2LLAZY
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Enter your password to continue
        </Typography>
        {error && <Alert severity="error">Invalid password</Alert>}
        <TextField
          label="Password"
          name="password"
          type="password"
          autoFocus
          required
          size="small"
        />
        <SubmitButton />
      </Box>
    </Box>
  );
}
