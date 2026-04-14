"use client";

import { ReactNode } from "react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { theme } from "@/theme/theme";
import { ScrapeProgressProvider } from "@/context/ScrapeProgressContext";
import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ScrapeProgressProvider>
          {children}
        </ScrapeProgressProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
