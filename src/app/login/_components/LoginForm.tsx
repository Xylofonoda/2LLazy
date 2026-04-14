"use client";

import {
  Box,
  Button,
  Typography,
  alpha,
} from "@mui/material";
import BoltIcon from "@mui/icons-material/Bolt";
import GoogleIcon from "@mui/icons-material/Google";
import { signIn } from "next-auth/react";
import { ios } from "@/theme/theme";

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

        <Typography sx={{ color: ios.label2, fontSize: 13, textAlign: "center" }}>
          Sign in to access your personal job tracker workspace.
        </Typography>

        {error && (
          <Typography sx={{ color: "#ff453a", fontSize: 13, textAlign: "center" }}>
            Sign-in failed. Please try again.
          </Typography>
        )}

        <Button
          variant="contained"
          fullWidth
          onClick={() => signIn("google", { callbackUrl: "/" })}
          startIcon={<GoogleIcon />}
          sx={{
            mt: 0.5,
            py: 1.1,
            fontSize: "0.9375rem",
            background: "#fff",
            color: "#1f1f1f",
            "&:hover": { background: "#f5f5f5" },
          }}
        >
          Continue with Google
        </Button>
      </Box>
    </Box>
  );
}
