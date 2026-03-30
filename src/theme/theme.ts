"use client";

import { createTheme, alpha } from "@mui/material/styles";

// Moderní SaaS barvy - více neutrální "Zinc" tóny
const brandColors = {
  primary: "#6366f1",    // Indigo 500
  background: "#09090b", // Zinc 950 (hluboká, drahá černá)
  paper: "#121217",      // Zinc 900 (jemně vytažené karty)
  border: "rgba(255, 255, 255, 0.08)",
  textSecondary: "#a1a1aa", // Zinc 400
};

export const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: brandColors.primary,
      light: alpha(brandColors.primary, 0.8),
      dark: "#4f46e5",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#f4f4f5", // Zinc 100 - sekundární akce by měly být světlé/bílé, ne barevné
    },
    background: {
      default: brandColors.background,
      paper: brandColors.paper,
    },
    text: {
      primary: "#fafafa",
      secondary: brandColors.textSecondary,
    },
    divider: brandColors.border,
  },
  typography: {
    // Pokud můžeš, přidej si do projektu font 'Geist' nebo 'Inter'
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    h4: { fontWeight: 700, letterSpacing: "-0.02em" },
    h5: { fontWeight: 600, letterSpacing: "-0.01em" },
    h6: { fontWeight: 600, letterSpacing: "-0.01em" },
    button: { fontWeight: 500, letterSpacing: "0.01em" },
    body1: { lineHeight: 1.6 },
  },
  shape: { borderRadius: 8 }, // Menší rádius působí víc "profi" a méně "hravě"
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          borderRadius: 6,
          padding: "8px 16px",
          transition: "all 0.2s ease-in-out",
          boxShadow: "none",
          "&:hover": {
            boxShadow: `0 0 20px ${alpha(brandColors.primary, 0.25)}`,
          },
        },
        containedPrimary: {
          backgroundColor: brandColors.primary,
          "&:hover": {
            backgroundColor: "#4f46e5",
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: brandColors.paper,
          borderRadius: 12,
          border: `1px solid ${brandColors.border}`,
          transition: "border-color 0.2s ease-in-out",
          "&:hover": {
            borderColor: alpha(brandColors.primary, 0.3),
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            backgroundColor: alpha("#fff", 0.02),
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: alpha("#fff", 0.2),
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderWidth: 1,
              borderColor: brandColors.primary,
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 600,
          "&.MuiChip-colorDefault": {
            backgroundColor: alpha(brandColors.primary, 0.1),
            color: brandColors.primary,
            border: `1px solid ${alpha(brandColors.primary, 0.2)}`,
          },
        },
      },
    },
  },
});