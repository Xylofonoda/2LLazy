"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Chip,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import type { AppStatus } from "@/types";
import { ALL_STATUSES, STATUS_COLOR } from "@/types";

export interface DashboardFilters {
  status: string;
  source: string;
  position: string;
  hasSalary: boolean;
}

interface DashboardFilterBarProps {
  sources: string[];
  statusCounts: Record<string, number>;
  filters: DashboardFilters;
  onChange: (filters: DashboardFilters) => void;
}

export function DashboardFilterBar({
  sources,
  statusCounts,
  filters,
  onChange,
}: DashboardFilterBarProps) {
  const set = <K extends keyof DashboardFilters>(
    key: K,
    value: DashboardFilters[K],
  ) => onChange({ ...filters, [key]: value });

  const [positionInput, setPositionInput] = useState(filters.position);
  useEffect(() => setPositionInput(filters.position), [filters.position]);

  const commitPosition = () => set("position", positionInput);

  const totalCount = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const allSources = ["ALL", ...sources];

  return (
    <Box sx={{ mb: 3 }}>
      {/* ── Status chips ── */}
      <Stack direction="row" spacing={0.75} sx={{ mb: 2, flexWrap: "wrap", gap: 0.75 }}>
        <Chip
          label={`All  ${totalCount}`}
          variant={filters.status === "ALL" ? "filled" : "outlined"}
          onClick={() => set("status", "ALL")}
          sx={{
            ...(filters.status === "ALL" && {
              background: "rgba(255,255,255,0.15)",
              color: "#fff",
              borderColor: "rgba(255,255,255,0.25)",
            }),
          }}
        />
        {ALL_STATUSES.map((s: AppStatus) => (
          <Chip
            key={s}
            label={`${s}  ${statusCounts[s] ?? 0}`}
            color={STATUS_COLOR[s]}
            variant={filters.status === s ? "filled" : "outlined"}
            onClick={() => set("status", s)}
          />
        ))}
      </Stack>

      {/* ── Secondary filters ── */}
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ flexWrap: "wrap", alignItems: "center" }}
      >
        <TextField
          label="Position / Company"
          size="small"
          value={positionInput}
          onChange={(e) => setPositionInput(e.target.value)}
          onBlur={commitPosition}
          onKeyDown={(e) => e.key === "Enter" && commitPosition()}
          sx={{ minWidth: 200 }}
          placeholder="Search title or company…"
        />

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id="filter-source-label">Site</InputLabel>
          <Select
            labelId="filter-source-label"
            value={filters.source}
            label="Site"
            onChange={(e) => set("source", e.target.value)}
          >
            {allSources.map((src) => (
              <MenuItem key={src} value={src}>
                {src === "ALL" ? "All Sites" : src}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={filters.hasSalary}
              onChange={(e) => set("hasSalary", e.target.checked)}
            />
          }
          label={<Typography variant="body2" color="text.secondary">Has Salary</Typography>}
          sx={{ ml: 0 }}
        />
      </Stack>
    </Box>
  );
}
