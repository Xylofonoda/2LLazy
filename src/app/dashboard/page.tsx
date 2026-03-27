"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Stack,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Tooltip,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import EditIcon from "@mui/icons-material/Edit";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";

type AppStatus = "PENDING" | "APPLIED" | "REJECTED" | "INTERVIEW" | "FAILED";

interface Application {
  id: string;
  status: AppStatus;
  appliedAt: string | null;
  errorMessage: string | null;
  job: { id: string; title: string; company: string; location: string; source: string; sourceUrl: string };
  coverLetter: { id: string; content: string } | null;
  interview: { id: string; scheduledAt: string; durationMinutes: number; notes: string | null } | null;
}

const STATUS_COLOR: Record<AppStatus, "default" | "info" | "success" | "error" | "warning"> = {
  PENDING: "default",
  APPLIED: "info",
  REJECTED: "error",
  INTERVIEW: "success",
  FAILED: "warning",
};

const ALL_STATUSES: AppStatus[] = ["PENDING", "APPLIED", "REJECTED", "INTERVIEW", "FAILED"];

export default function DashboardPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [clDialog, setClDialog] = useState<{ open: boolean; content: string }>({ open: false, content: "" });
  const [statusDialog, setStatusDialog] = useState<{ open: boolean; id: string; status: AppStatus } | null>(null);

  const fetchApplications = async (status?: string) => {
    setLoading(true);
    const statusVar = status && status !== "ALL" ? status : null;
    const res = await fetch("/api/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query GetApps($status: ApplicationStatus) {
          getApplications(status: $status) {
            id status appliedAt errorMessage
            job { id title company location source sourceUrl }
            coverLetter { id content }
            interview { id scheduledAt durationMinutes notes }
          }
        }`,
        variables: { status: statusVar },
      }),
    });
    const data = await res.json();
    setApplications(data.data?.getApplications ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchApplications(); }, []);

  const handleStatusChange = async (id: string, status: AppStatus) => {
    await fetch("/api/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `mutation UpdStatus($id: ID!, $status: ApplicationStatus!) { updateApplicationStatus(id: $id, status: $status) { id status } }`,
        variables: { id, status },
      }),
    });
    await fetchApplications(filterStatus);
    setStatusDialog(null);
  };

  const counts = ALL_STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = applications.filter((a) => a.status === s).length;
    return acc;
  }, {});

  const filtered = filterStatus === "ALL" ? applications : applications.filter((a) => a.status === filterStatus);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Application Dashboard</Typography>

      {/* Summary chips */}
      <Stack direction="row" spacing={1} sx={{ mb: 3, flexWrap: "wrap" }}>
        {ALL_STATUSES.map((s) => (
          <Chip
            key={s}
            label={`${s}: ${counts[s] ?? 0}`}
            color={STATUS_COLOR[s]}
            variant={filterStatus === s ? "filled" : "outlined"}
            onClick={() => { setFilterStatus(s); fetchApplications(s); }}
          />
        ))}
        <Chip
          label={`ALL: ${applications.length}`}
          variant={filterStatus === "ALL" ? "filled" : "outlined"}
          onClick={() => { setFilterStatus("ALL"); fetchApplications(); }}
        />
      </Stack>

      {loading && <Typography color="text.secondary">Loading...</Typography>}

      <Stack spacing={2}>
        {filtered.map((app) => (
          <Card key={app.id}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="h6" sx={{ fontSize: 15 }}>{app.job.title}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {app.job.company} · {app.job.location}
                  </Typography>
                  {app.appliedAt && (
                    <Typography variant="caption" color="text.secondary">
                      Applied: {new Date(app.appliedAt).toLocaleDateString()}
                    </Typography>
                  )}
                  {app.errorMessage && (
                    <Typography variant="caption" color="error.main" display="block">
                      Error: {app.errorMessage}
                    </Typography>
                  )}
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip label={app.status} size="small" color={STATUS_COLOR[app.status]} />
                  <Chip label={app.job.source} size="small" variant="outlined" />
                </Stack>
              </Stack>

              {app.interview && (
                <Box sx={{ mt: 1, p: 1, bgcolor: "success.main", borderRadius: 1, opacity: 0.85 }}>
                  <Typography variant="caption" color="#fff">
                    📅 Interview: {new Date(app.interview.scheduledAt).toLocaleString()} ({app.interview.durationMinutes} min)
                    {app.interview.notes ? ` — ${app.interview.notes}` : ""}
                  </Typography>
                </Box>
              )}
            </CardContent>

            <Stack direction="row" spacing={1} sx={{ px: 2, pb: 2 }}>
              <Tooltip title="Change status">
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={() => setStatusDialog({ open: true, id: app.id, status: app.status })}
                >
                  Status
                </Button>
              </Tooltip>
              {app.coverLetter && (
                <Button size="small" variant="outlined" onClick={() => setClDialog({ open: true, content: app.coverLetter!.content })}>
                  View Cover Letter
                </Button>
              )}
              <Tooltip title="Open job posting">
                <IconButton size="small" component="a" href={app.job.sourceUrl} target="_blank" rel="noopener noreferrer">
                  <OpenInNewIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Card>
        ))}
      </Stack>

      {/* Cover Letter Dialog */}
      <Dialog open={clDialog.open} onClose={() => setClDialog({ open: false, content: "" })} maxWidth="md" fullWidth>
        <DialogTitle>Cover Letter</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{clDialog.content}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClDialog({ open: false, content: "" })}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Status Change Dialog */}
      {statusDialog && (
        <Dialog open={statusDialog.open} onClose={() => setStatusDialog(null)}>
          <DialogTitle>Update Status</DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={statusDialog.status}
                label="Status"
                onChange={(e) => setStatusDialog({ ...statusDialog, status: e.target.value as AppStatus })}
              >
                {ALL_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setStatusDialog(null)}>Cancel</Button>
            <Button variant="contained" onClick={() => handleStatusChange(statusDialog.id, statusDialog.status)}>Save</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
