"use client";
import { ReactNode } from "react";
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  alpha,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import DashboardIcon from "@mui/icons-material/Dashboard";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import SettingsIcon from "@mui/icons-material/Settings";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import LogoutIcon from "@mui/icons-material/Logout";
import BoltIcon from "@mui/icons-material/Bolt";
import BarChartIcon from "@mui/icons-material/BarChart";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/lib/actions/authActions";
import { ios } from "@/theme/theme";
import { useScrapeProgress } from "@/context/ScrapeProgressContext";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";

const DRAWER_WIDTH = 236;

const NAV_ITEMS = [
  { label: "Search Jobs",  href: "/",          icon: <SearchIcon fontSize="small" /> },
  { label: "Favourites",   href: "/favourites", icon: <BookmarkIcon fontSize="small" /> },
  { label: "Dashboard",    href: "/dashboard",  icon: <DashboardIcon fontSize="small" /> },
  { label: "Stats",        href: "/stats",      icon: <BarChartIcon fontSize="small" /> },
  { label: "Interviews",   href: "/interviews", icon: <CalendarMonthIcon fontSize="small" /> },
  { label: "Settings",     href: "/settings",   icon: <SettingsIcon fontSize="small" /> },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { scraping, scrapePercent } = useScrapeProgress();

  // Login page: render without the shell
  if (pathname.startsWith("/login")) {
    return <>{children}</>;
  }

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
          },
        }}
      >
        {/* Logo */}
        <Box sx={{ px: 2.5, pt: 3, pb: 2.5, display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: "10px",
              background: `linear-gradient(145deg, #1a8fff, ${ios.blue} 45%, #0060df)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 4px 14px ${alpha(ios.blue, 0.5)}, 0 0 0 1px ${alpha(ios.blue, 0.3)}`,
              flexShrink: 0,
            }}
          >
            <BoltIcon sx={{ color: "#fff", fontSize: 18 }} />
          </Box>
          <Box>
            <Typography sx={{
              color: "#fff",
              fontSize: 15,
              fontWeight: 700,
              lineHeight: 1.2,
              letterSpacing: "-0.02em",
            }}>
              2LLAZY
            </Typography>
            <Typography sx={{
              color: ios.label3,
              fontSize: 11,
              fontWeight: 400,
              lineHeight: 1.2,
              letterSpacing: "0em",
            }}>
              Job Tracker
            </Typography>
          </Box>
        </Box>

        {/* Separator */}
        <Box sx={{ mx: 2, height: "1px", background: ios.separator, mb: 1.5 }} />

        {/* Nav items */}
        <List sx={{ px: 1.5, flexGrow: 1, pt: 0 }}>
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <ListItemButton
                key={item.href}
                component={Link}
                href={item.href}
                selected={active}
                sx={{
                  borderRadius: "12px",
                  mb: 0.5,
                  py: 1.1,
                  px: 1.5,
                  border: "1px solid transparent",
                  transition: "all 0.18s cubic-bezier(0.34,1.2,0.64,1)",
                  ...(active ? {
                    background: `linear-gradient(135deg, ${alpha(ios.blue, 0.28)} 0%, ${alpha(ios.blue, 0.14)} 100%)`,
                    borderColor: alpha(ios.blue, 0.35),
                    backdropFilter: "blur(8px)",
                    "&:hover": {
                      background: `linear-gradient(135deg, ${alpha(ios.blue, 0.32)} 0%, ${alpha(ios.blue, 0.18)} 100%)`,
                    },
                  } : {
                    "&:hover": {
                      background: "rgba(255,255,255,0.05)",
                      borderColor: "rgba(255,255,255,0.06)",
                    },
                  }),
                  "&:active": { transform: "scale(0.97)" },
                  "& .MuiListItemIcon-root": {
                    color: active ? ios.blue : "rgba(235,235,245,0.45)",
                    minWidth: 34,
                    transition: "color 0.15s ease",
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 34 }}>{item.icon}</ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: 14,
                    fontWeight: active ? 600 : 400,
                    color: active ? "#fff" : "rgba(235,235,245,0.65)",
                    letterSpacing: "-0.01em",
                  }}
                />
                {active && (
                  <Box sx={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: ios.blue,
                    boxShadow: `0 0 8px ${ios.blue}`,
                    flexShrink: 0,
                  }} />
                )}
              </ListItemButton>
            );
          })}
        </List>

        {/* Logout */}
        <Box sx={{ p: 1.5, pt: 0 }}>
          <Box sx={{ height: "1px", background: ios.separator, mb: 1.5 }} />
          <ListItemButton
            onClick={() => logoutAction()}
            sx={{
              borderRadius: "12px",
              py: 1.1,
              px: 1.5,
              border: "1px solid transparent",
              transition: "all 0.18s cubic-bezier(0.34,1.2,0.64,1)",
              "&:hover": {
                background: alpha(ios.red, 0.1),
                borderColor: alpha(ios.red, 0.22),
              },
              "&:active": { transform: "scale(0.97)" },
              "& .MuiListItemIcon-root": {
                color: alpha(ios.red, 0.7),
                minWidth: 34,
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 34 }}>
              <LogoutIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Log out"
              primaryTypographyProps={{
                fontSize: 14,
                fontWeight: 400,
                color: alpha(ios.red, 0.8),
                letterSpacing: "-0.01em",
              }}
            />
          </ListItemButton>
        </Box>
      </Drawer>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          overflow: "auto",
          minHeight: "100vh",
          background:
            "radial-gradient(ellipse at 15% 0%, rgba(0,122,255,0.07) 0%, transparent 55%)," +
            "radial-gradient(ellipse at 85% 100%, rgba(88,86,214,0.05) 0%, transparent 55%)," +
            "#000000",
          position: "relative",
        }}
      >
        <Box sx={{ position: "relative", zIndex: 1, p: 3 }}>
          {children}
        </Box>
      </Box>
      {/* ── Global scrape progress circle (top-right, persists across pages) ── */}
      {scraping && (
        <Tooltip title={`Searching jobs… ${scrapePercent}%`} placement="left">
          <Box
            component={Link}
            href="/"
            sx={{
              position: "fixed",
              bottom: 24,
              right: 24,
              zIndex: 1400,
              width: 64,
              height: 64,
              borderRadius: "50%",
              bgcolor: "background.paper",
              boxShadow: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              textDecoration: "none",
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
              "&:hover": { transform: "scale(1.08)", boxShadow: 10 },
              "&:active": { transform: "scale(0.96)" },
            }}
          >
            <CircularProgress
              variant="determinate"
              value={scrapePercent}
              size={56}
              thickness={4}
              sx={{ color: scrapePercent === 100 ? "success.main" : "primary.main", position: "absolute" }}
            />
            {/* Track ring */}
            <CircularProgress
              variant="determinate"
              value={100}
              size={56}
              thickness={4}
              sx={{ color: "action.disabledBackground", position: "absolute" }}
            />
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, fontSize: "0.68rem", color: "text.primary", zIndex: 1 }}
            >
              {scrapePercent}%
            </Typography>
          </Box>
        </Tooltip>
      )}
    </Box>
  );
}
