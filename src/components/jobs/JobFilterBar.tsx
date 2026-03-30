"use client";

import { useState, useEffect } from "react";
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
  sources: string[];
  filters: JobFilters;
  onChange: (filters: JobFilters) => void;
}

export function JobFilterBar({ sources, filters, onChange }: JobFilterBarProps) {
  const set = <K extends keyof JobFilters>(key: K, value: JobFilters[K]) =>
    onChange({ ...filters, [key]: value });

  const [positionInput, setPositionInput] = useState(filters.position);
  useEffect(() => setPositionInput(filters.position), [filters.position]);

  const commitPosition = () => set("position", positionInput);

  const allSources = ["ALL", ...sources];

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
          value={positionInput}
          onChange={(e) => setPositionInput(e.target.value)}
          onBlur={commitPosition}
          onKeyDown={(e) => e.key === "Enter" && commitPosition()}
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
            {allSources.map((src) => (
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
