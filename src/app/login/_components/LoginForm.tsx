"use client";

import { useFormStatus } from "react-dom";
import {
  Box,
  Button,
  CircularProgress,
  TextField,
  Typography,
  Alert,
  alpha,
} from "@mui/material";
import BoltIcon from "@mui/icons-material/Bolt";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { loginAction } from "@/lib/actions/authActions";
import { ios } from "@/theme/theme";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="contained"
      disabled={pending}
      fullWidth
      sx={{ mt: 0.5, py: 1.1, fontSize: "0.9375rem" }}
    >
      {pending ? <CircularProgress size={20} color="inherit" /> : "Sign In"}
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
        background:
          "radial-gradient(ellipse at 50% 0%, rgba(0,122,255,0.12) 0%, transparent 60%)," +
          "#000000",
      }}
    >
      <Box
        component="form"
        action={loginAction}
        sx={{
          p: 4,
          background: "rgba(28,28,30,0.92)",
          backdropFilter: "blur(30px) saturate(180%)",
          WebkitBackdropFilter: "blur(30px) saturate(180%)",
          borderRadius: "20px",
          border: `1px solid ${ios.separator}`,
          boxShadow: "0 24px 64px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)",
          width: "100%",
          maxWidth: 360,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          animation: "fadeSlideUp 0.4s cubic-bezier(0.34,1.2,0.64,1) both",
        }}
      >
        {/* App icon */}
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5, mb: 0.5 }}>
          <Box sx={{
            width: 56,
            height: 56,
            borderRadius: "16px",
            background: `linear-gradient(145deg, #1a8fff, ${ios.blue} 45%, #0060df)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 8px 20px ${alpha(ios.blue, 0.45)}, 0 0 0 1px ${alpha(ios.blue, 0.3)}`,
          }}>
            <BoltIcon sx={{ color: "#fff", fontSize: 28 }} />
          </Box>
          <Box sx={{ textAlign: "center" }}>
            <Typography sx={{ color: "#fff", fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
              2LLAZY
            </Typography>
            <Typography sx={{ color: ios.label2, fontSize: 13, mt: 0.25 }}>
              Job Tracker
            </Typography>
          </Box>
        </Box>

        {/* Divider */}
        <Box sx={{ height: "1px", background: ios.separator }} />

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <LockOutlinedIcon sx={{ fontSize: 14, color: ios.label3 }} />
          <Typography variant="body2" sx={{ color: ios.label2, fontSize: 13 }}>
            Enter your password to continue
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ py: 0.5 }}>
            Invalid password. Please try again.
          </Alert>
        )}

        <TextField
          label="Password"
          name="password"
          type="password"
          autoFocus
          required
          size="small"
          fullWidth
        />

        <SubmitButton />
      </Box>
    </Box>
  );
}
