"use client";

import {
  Box,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
} from "@mui/material";
import type { JobItem } from "@/types";

export interface JobFilters {
  source: string;
  position: string;
  hasSalary: boolean;
}

export const DEFAULT_JOB_FILTERS: JobFilters = {
  source: "ALL",
  position: "",
  hasSalary: false,
};

interface JobFilterBarProps {
  jobs: JobItem[];
  filters: JobFilters;
  onChange: (filters: JobFilters) => void;
}

export function JobFilterBar({ jobs, filters, onChange }: JobFilterBarProps) {
  const set = <K extends keyof JobFilters>(key: K, value: JobFilters[K]) =>
    onChange({ ...filters, [key]: value });

  const sources = [
    "ALL",
    ...Array.from(new Set(jobs.map((j) => j.source))).sort(),
  ];

  return (
    <Box sx={{ mb: 3 }}>
      <Stack
        direction="row"
        spacing={2}
        sx={{ flexWrap: "wrap", alignItems: "center" }}
      >
        {/* Position / company text search */}
        <TextField
          label="Position / Company"
          size="small"
          value={filters.position}
          onChange={(e) => set("position", e.target.value)}
          sx={{ minWidth: 220 }}
          placeholder="Search title or company…"
        />

        {/* Source site */}
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel id="job-filter-source-label">Site</InputLabel>
          <Select
            labelId="job-filter-source-label"
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
