"use client";

import { createTheme, alpha } from "@mui/material/styles";

// iOS system colors — dark mode palette
export const ios = {
  blue:       "#007AFF",
  indigo:     "#5856D6",
  green:      "#34C759",
  orange:     "#FF9F0A",
  red:        "#FF453A",
  teal:       "#5AC8FA",
  purple:     "#BF5AF2",
  // Backgrounds
  bg:         "#000000",
  surface1:   "rgba(28,28,30,0.95)",
  surface2:   "rgba(44,44,46,0.9)",
  // Labels
  label1:     "#FFFFFF",
  label2:     "rgba(235,235,245,0.6)",
  label3:     "rgba(235,235,245,0.3)",
  // Separator
  separator:  "rgba(84,84,88,0.45)",
  separatorOpaque: "#38383A",
};

const spring = "cubic-bezier(0.34,1.2,0.64,1)";
const smooth = "cubic-bezier(0.22,0.1,0.36,1)";

export const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: ios.blue,
      light: alpha(ios.blue, 0.8),
      dark: "#0066CC",
      contrastText: "#ffffff",
    },
    secondary: {
      main: ios.indigo,
    },
    success: { main: ios.green },
    warning: { main: ios.orange },
    error:   { main: ios.red },
    background: {
      default: ios.bg,
      paper:   ios.surface1,
    },
    text: {
      primary:   ios.label1,
      secondary: ios.label2,
    },
    divider: ios.separator,
  },
  typography: {
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Inter', system-ui, sans-serif",
    h4: { fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.15 },
    h5: { fontWeight: 600, letterSpacing: "-0.02em",  lineHeight: 1.25 },
    h6: { fontWeight: 600, letterSpacing: "-0.015em", lineHeight: 1.35 },
    body1: { lineHeight: 1.6,  letterSpacing: "-0.01em" },
    body2: { lineHeight: 1.5,  letterSpacing: "-0.005em" },
    caption: { letterSpacing: "0em" },
    button: { fontWeight: 600, letterSpacing: "0em", textTransform: "none" as const },
  },
  shape: { borderRadius: 12 },
  components: {
    // ─── Buttons ────────────────────────────────────────────────────────────
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          borderRadius: 10,
          padding: "8px 18px",
          lineHeight: 1.5,
          boxShadow: "none",
          transition: `all 0.18s ${spring}`,
          position: "relative",
          overflow: "hidden",
          "&:hover": {
            boxShadow: "none",
            transform: "translateY(-1px)",
          },
          "&:active": {
            transform: "scale(0.96)",
            transition: `transform 0.08s ease`,
          },
          "&.Mui-disabled": {
            opacity: 0.4,
          },
        },
        containedPrimary: {
          background: `linear-gradient(160deg, #1a8fff 0%, ${ios.blue} 60%, #0060df 100%)`,
          boxShadow: `0 2px 10px ${alpha(ios.blue, 0.35)}`,
          "&:hover": {
            background: `linear-gradient(160deg, #2a9fff 0%, #1a8fff 60%, ${ios.blue} 100%)`,
            boxShadow: `0 4px 16px ${alpha(ios.blue, 0.45)}`,
          },
        },
        outlined: {
          borderColor: ios.separator,
          background: "rgba(255,255,255,0.05)",
          backdropFilter: "blur(8px)",
          "&:hover": {
            borderColor: "rgba(255,255,255,0.2)",
            background: "rgba(255,255,255,0.09)",
          },
        },
        sizeSmall: {
          padding: "6px 14px",
          fontSize: "0.8125rem",
          borderRadius: 8,
        },
      },
    },
    // ─── Cards ──────────────────────────────────────────────────────────────
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          background: ios.surface1,
          backdropFilter: "blur(20px) saturate(160%)",
          WebkitBackdropFilter: "blur(20px) saturate(160%)",
          borderRadius: 16,
          border: `1px solid ${ios.separator}`,
          boxShadow: "0 2px 12px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.2)",
          transition: `transform 0.22s ${spring}, box-shadow 0.22s ${smooth}, border-color 0.18s ease`,
          "&:hover": {
            borderColor: "rgba(255,255,255,0.14)",
            boxShadow: "0 8px 28px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.25)",
            transform: "translateY(-2px)",
          },
        },
      },
    },
    // ─── Paper ──────────────────────────────────────────────────────────────
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    // ─── Drawer ─────────────────────────────────────────────────────────────
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: "rgba(12,12,14,0.88)",
          backdropFilter: "blur(36px) saturate(180%)",
          WebkitBackdropFilter: "blur(36px) saturate(180%)",
          borderRight: `1px solid ${ios.separator}`,
        },
      },
    },
    // ─── Dialog ─────────────────────────────────────────────────────────────
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 20,
          border: `1px solid ${ios.separator}`,
          background: "rgba(28,28,30,0.97)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        },
      },
    },
    // ─── TextField ──────────────────────────────────────────────────────────
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 10,
            background: "rgba(118,118,128,0.12)",
            transition: `background 0.15s ease, box-shadow 0.15s ease`,
            "& fieldset": {
              borderColor: "transparent",
              transition: "border-color 0.15s ease",
            },
            "&:hover": {
              background: "rgba(118,118,128,0.16)",
              "& fieldset": { borderColor: ios.separator },
            },
            "&.Mui-focused": {
              background: "rgba(118,118,128,0.18)",
              boxShadow: `0 0 0 3px ${alpha(ios.blue, 0.18)}`,
              "& fieldset": {
                borderColor: ios.blue,
                borderWidth: "1.5px",
              },
            },
          },
        },
      },
    },
    // ─── Select ─────────────────────────────────────────────────────────────
    MuiSelect: {
      styleOverrides: {
        root: { borderRadius: 10 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 10 },
      },
    },
    // ─── Menu ───────────────────────────────────────────────────────────────
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 14,
          border: `1px solid ${ios.separator}`,
          background: "rgba(30,30,32,0.97)",
          backdropFilter: "blur(20px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          margin: "1px 4px",
          padding: "8px 12px",
          fontSize: "0.875rem",
          transition: `background 0.12s ease`,
          "&:hover": { background: "rgba(255,255,255,0.07)" },
          "&.Mui-selected": {
            background: alpha(ios.blue, 0.2),
            "&:hover": { background: alpha(ios.blue, 0.26) },
          },
        },
      },
    },
    // ─── Chips ──────────────────────────────────────────────────────────────
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 600,
          fontSize: "0.75rem",
          height: 24,
          transition: `all 0.15s ${spring}`,
          "&:hover": { transform: "translateY(-1px)" },
          "&:active": { transform: "scale(0.95)" },
          "&.MuiChip-colorDefault": {
            background: alpha(ios.blue, 0.14),
            color: ios.blue,
            border: `1px solid ${alpha(ios.blue, 0.28)}`,
          },
          "&.MuiChip-colorSuccess": {
            background: alpha(ios.green, 0.14),
            color: ios.green,
            border: `1px solid ${alpha(ios.green, 0.25)}`,
          },
          "&.MuiChip-colorWarning": {
            background: alpha(ios.orange, 0.14),
            color: ios.orange,
            border: `1px solid ${alpha(ios.orange, 0.25)}`,
          },
          "&.MuiChip-colorError": {
            background: alpha(ios.red, 0.14),
            color: ios.red,
            border: `1px solid ${alpha(ios.red, 0.25)}`,
          },
          "&.MuiChip-colorSecondary": {
            background: alpha(ios.indigo, 0.14),
            color: ios.indigo,
            border: `1px solid ${alpha(ios.indigo, 0.25)}`,
          },
        },
        clickable: {
          cursor: "pointer",
        },
      },
    },
    // ─── List items ─────────────────────────────────────────────────────────
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          transition: `all 0.15s ${spring}`,
          "&:active": { transform: "scale(0.97)" },
        },
      },
    },
    // ─── Divider ────────────────────────────────────────────────────────────
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: ios.separator },
      },
    },
    // ─── Progress ───────────────────────────────────────────────────────────
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          height: 3,
          background: "rgba(255,255,255,0.06)",
        },
        bar: {
          borderRadius: 4,
          background: `linear-gradient(90deg, ${ios.blue}, ${ios.teal})`,
        },
      },
    },
    // ─── Skeleton ───────────────────────────────────────────────────────────
    MuiSkeleton: {
      styleOverrides: {
        root: {
          background: "rgba(255,255,255,0.06)",
          borderRadius: 12,
          "&::after": {
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)",
          },
        },
      },
    },
    // ─── Switch (iOS toggle style) ──────────────────────────────────────────
    MuiSwitch: {
      styleOverrides: {
        root: {
          width: 44,
          height: 26,
          padding: 0,
          "& .MuiSwitch-switchBase": {
            padding: 3,
            transition: `transform 0.22s ${spring}`,
            "&.Mui-checked": {
              transform: "translateX(18px)",
              "& + .MuiSwitch-track": {
                background: ios.green,
                opacity: 1,
                border: "none",
              },
              "& .MuiSwitch-thumb": { background: "#fff" },
            },
          },
          "& .MuiSwitch-thumb": {
            width: 20,
            height: 20,
            background: "#fff",
            boxShadow: "0 2px 4px rgba(0,0,0,0.3), 0 0 1px rgba(0,0,0,0.2)",
          },
          "& .MuiSwitch-track": {
            borderRadius: 13,
            background: "rgba(120,120,128,0.32)",
            opacity: 1,
          },
        },
      },
    },
    // ─── Alert ──────────────────────────────────────────────────────────────
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backdropFilter: "blur(10px)",
          border: "1px solid",
        },
        standardInfo: {
          background: alpha(ios.blue, 0.1),
          borderColor: alpha(ios.blue, 0.25),
        },
        standardWarning: {
          background: alpha(ios.orange, 0.1),
          borderColor: alpha(ios.orange, 0.25),
        },
        standardError: {
          background: alpha(ios.red, 0.1),
          borderColor: alpha(ios.red, 0.25),
        },
        standardSuccess: {
          background: alpha(ios.green, 0.1),
          borderColor: alpha(ios.green, 0.25),
        },
      },
    },
    // ─── Tooltip ────────────────────────────────────────────────────────────
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          background: "rgba(50,50,55,0.95)",
          backdropFilter: "blur(12px)",
          borderRadius: 8,
          fontSize: "0.75rem",
          fontWeight: 500,
          padding: "5px 10px",
        },
      },
    },
    // ─── Icon button ────────────────────────────────────────────────────────
    MuiIconButton: {
      styleOverrides: {
        root: {
          transition: `all 0.15s ${spring}`,
          "&:hover": { transform: "scale(1.08)" },
          "&:active": { transform: "scale(0.92)" },
        },
      },
    },
  },
});