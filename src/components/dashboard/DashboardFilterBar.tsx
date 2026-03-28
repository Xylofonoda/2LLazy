"use client";

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
} from "@mui/material";
import type { Application, AppStatus } from "@/types";
import { ALL_STATUSES, STATUS_COLOR } from "@/types";

export interface DashboardFilters {
  status: string;
  source: string;
  position: string;
  hasSalary: boolean;
}

interface DashboardFilterBarProps {
  applications: Application[];
  filters: DashboardFilters;
  onChange: (filters: DashboardFilters) => void;
}

export function DashboardFilterBar({
  applications,
  filters,
  onChange,
}: DashboardFilterBarProps) {
  const set = <K extends keyof DashboardFilters>(
    key: K,
    value: DashboardFilters[K],
  ) => onChange({ ...filters, [key]: value });

  const statusCounts = ALL_STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = applications.filter((a) => a.status === s).length;
    return acc;
  }, {});

  const sources = ["ALL", ...Array.from(new Set(applications.map((a) => a.job.source))).sort()];

  return (
    <Box sx={{ mb: 3 }}>
      {/* ── Status chips ── */}
      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}>
        <Chip
          label={`ALL: ${applications.length}`}
          variant={filters.status === "ALL" ? "filled" : "outlined"}
          onClick={() => set("status", "ALL")}
        />
        {ALL_STATUSES.map((s: AppStatus) => (
          <Chip
            key={s}
            label={`${s}: ${statusCounts[s] ?? 0}`}
            color={STATUS_COLOR[s]}
            variant={filters.status === s ? "filled" : "outlined"}
            onClick={() => set("status", s)}
          />
        ))}
      </Stack>

      {/* ── Secondary filters ── */}
      <Stack
        direction="row"
        spacing={2}
        sx={{ flexWrap: "wrap", alignItems: "center" }}
      >
        {/* Position text search */}
        <TextField
          label="Position / Company"
          size="small"
          value={filters.position}
          onChange={(e) => set("position", e.target.value)}
          sx={{ minWidth: 200 }}
          placeholder="Search title or company…"
        />

        {/* Source */}
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel id="filter-source-label">Site</InputLabel>
          <Select
            labelId="filter-source-label"
            value={filters.source}
            label="Site"
            onChange={(e) => set("source", e.target.value)}
          >
            {sources.map((src) => (
              <MenuItem key={src} value={src}>
                {src === "ALL" ? "All Sites" : src}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Has salary toggle */}
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={filters.hasSalary}
              onChange={(e) => set("hasSalary", e.target.checked)}
            />
          }
          label="Has Salary"
          sx={{ ml: 0 }}
        />
      </Stack>
    </Box>
  );
}
