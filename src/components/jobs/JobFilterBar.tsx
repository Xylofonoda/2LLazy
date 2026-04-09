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
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  InputAdornment,
} from "@mui/material";

export interface JobFilters {
  source: string;
  position: string;
  hasSalary: boolean;
  workType: string;
  city: string;
  salaryMin: string;
  salaryMax: string;
}

export const DEFAULT_JOB_FILTERS: JobFilters = {
  source: "ALL",
  position: "",
  hasSalary: false,
  workType: "ALL",
  city: "",
  salaryMin: "",
  salaryMax: "",
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
  const [cityInput, setCityInput] = useState(filters.city);
  useEffect(() => setPositionInput(filters.position), [filters.position]);
  useEffect(() => setCityInput(filters.city), [filters.city]);

  const commitPosition = () => set("position", positionInput);
  const commitCity = () => set("city", cityInput);

  const allSources = ["ALL", ...sources];

  return (
    <Box sx={{ mb: 2.5 }}>
      <Stack spacing={1.5}>
        {/* Row 1: text filters */}
        <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", alignItems: "center" }}>
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

          <TextField
            label="City"
            size="small"
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            onBlur={commitCity}
            onKeyDown={(e) => e.key === "Enter" && commitCity()}
            sx={{ minWidth: 150 }}
            placeholder="e.g. Praha, Brno…"
          />

          <FormControl size="small" sx={{ minWidth: 140 }}>
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

          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={filters.hasSalary}
                onChange={(e) => set("hasSalary", e.target.checked)}
              />
            }
            label={<Typography variant="body2" color="text.secondary">Has Salary</Typography>}
            sx={{ ml: 0, gap: 0.5 }}
          />
        </Stack>

        {/* Row 2: work type + salary range */}
        <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", alignItems: "center" }}>
          <ToggleButtonGroup
            value={filters.workType}
            exclusive
            size="small"
            onChange={(_, v) => { if (v !== null) set("workType", v); }}
            aria-label="Work type filter"
          >
            <ToggleButton value="ALL" sx={{ textTransform: "none", px: 1.5 }}>All</ToggleButton>
            <ToggleButton value="Remote" sx={{ textTransform: "none", px: 1.5 }}>Remote</ToggleButton>
            <ToggleButton value="Hybrid" sx={{ textTransform: "none", px: 1.5 }}>Hybrid</ToggleButton>
            <ToggleButton value="Onsite" sx={{ textTransform: "none", px: 1.5 }}>Onsite</ToggleButton>
          </ToggleButtonGroup>

          <TextField
            label="Min Salary"
            size="small"
            type="number"
            value={filters.salaryMin}
            onChange={(e) => set("salaryMin", e.target.value)}
            sx={{ width: 130 }}
            InputProps={{ startAdornment: <InputAdornment position="start">CZK</InputAdornment> }}
          />
          <TextField
            label="Max Salary"
            size="small"
            type="number"
            value={filters.salaryMax}
            onChange={(e) => set("salaryMax", e.target.value)}
            sx={{ width: 130 }}
            InputProps={{ startAdornment: <InputAdornment position="start">CZK</InputAdornment> }}
          />
        </Stack>
      </Stack>
    </Box>
  );
}
