"use client";

import { ReactNode } from "react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { theme } from "@/theme/theme";
import { ScrapeProgressProvider } from "@/context/ScrapeProgressContext";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ScrapeProgressProvider>
        {children}
      </ScrapeProgressProvider>
    </ThemeProvider>
  );
}
