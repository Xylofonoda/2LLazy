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
  Divider,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import DashboardIcon from "@mui/icons-material/Dashboard";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import SettingsIcon from "@mui/icons-material/Settings";
import FlashOnIcon from "@mui/icons-material/FlashOn";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import Link from "next/link";
import { usePathname } from "next/navigation";

const DRAWER_WIDTH = 220;

const NAV_ITEMS = [
  { label: "Search Jobs", href: "/", icon: <SearchIcon /> },
  { label: "Favourites", href: "/favourites", icon: <BookmarkIcon /> },
  { label: "Dashboard", href: "/dashboard", icon: <DashboardIcon /> },
  { label: "Interviews", href: "/interviews", icon: <CalendarMonthIcon /> },
  { label: "Settings", href: "/settings", icon: <SettingsIcon /> },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            boxSizing: "border-box",
            bgcolor: "background.paper",
            borderRight: "1px solid rgba(255,255,255,0.06)",
          },
        }}
      >
        <Box sx={{ p: 2.5, display: "flex", alignItems: "center", gap: 1 }}>
          <FlashOnIcon sx={{ color: "primary.main" }} />
          <Typography variant="h6" sx={{ color: "primary.main", fontSize: 16 }}>
            AppFatigue
          </Typography>
        </Box>
        <Divider />
        <List sx={{ pt: 1 }}>
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <ListItemButton
                key={item.href}
                component={Link}
                href={item.href}
                selected={active}
                sx={{
                  mx: 1,
                  borderRadius: 2,
                  mb: 0.5,
                  "&.Mui-selected": {
                    bgcolor: "primary.main",
                    color: "#fff",
                    "& .MuiListItemIcon-root": { color: "#fff" },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontSize: 14, fontWeight: active ? 600 : 400 }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3, overflow: "auto" }}>
        {children}
      </Box>
    </Box>
  );
}
