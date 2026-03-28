"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Box, Typography } from "@mui/material";
import { DashboardFilterBar, type DashboardFilters } from "@/components/dashboard/DashboardFilterBar";
import { CoverLetterDialog } from "@/components/dialogs/CoverLetterDialog";
import { StatusChangeDialog } from "@/components/dialogs/StatusChangeDialog";
import { updateApplicationStatus } from "@/lib/actions/applicationActions";
import { ApplicationList } from "./ApplicationList";
import type { Application, AppStatus } from "@/types";

interface Props {
  initialApplications: Application[];
}

const DEFAULT_FILTERS: DashboardFilters = {
  status: "ALL",
  source: "ALL",
  position: "",
  hasSalary: false,
};

export function DashboardClient({ initialApplications }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);
  const [clDialog, setClDialog] = useState<{ open: boolean; content: string }>({
    open: false,
    content: "",
  });
  const [statusDialog, setStatusDialog] = useState<{
    open: boolean;
    id: string;
    status: AppStatus;
  } | null>(null);

  const filtered = initialApplications.filter((a) => {
    if (filters.status !== "ALL" && a.status !== filters.status) return false;
    if (filters.source !== "ALL" && a.job.source !== filters.source) return false;
    if (filters.hasSalary && !a.job.salary) return false;
    if (filters.position.trim()) {
      const q = filters.position.toLowerCase();
      const matches =
        a.job.title.toLowerCase().includes(q) ||
        a.job.company.toLowerCase().includes(q);
      if (!matches) return false;
    }
    return true;
  });

  const handleStatusChange = (id: string, status: AppStatus) => {
    startTransition(async () => {
      await updateApplicationStatus(id, status);
      router.refresh();
      setStatusDialog(null);
    });
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Application Dashboard
      </Typography>

      <DashboardFilterBar
        applications={initialApplications}
        filters={filters}
        onChange={setFilters}
      />

      <ApplicationList
        applications={filtered}
        isPending={isPending}
        onStatusClick={(id, status) => setStatusDialog({ open: true, id, status })}
        onViewCoverLetter={(content) => setClDialog({ open: true, content })}
      />

      <CoverLetterDialog
        open={clDialog.open}
        content={clDialog.content}
        onClose={() => setClDialog({ open: false, content: "" })}
      />

      {statusDialog && (
        <StatusChangeDialog
          open={statusDialog.open}
          status={statusDialog.status}
          isSaving={isPending}
          onStatusChange={(status) =>
            setStatusDialog({ ...statusDialog, status })
          }
          onClose={() => setStatusDialog(null)}
          onSave={() =>
            handleStatusChange(statusDialog.id, statusDialog.status)
          }
        />
      )}
    </Box>
  );
}
