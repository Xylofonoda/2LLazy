"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Box, Typography, Alert } from "@mui/material";
import { DashboardFilterBar, type DashboardFilters } from "@/components/dashboard/DashboardFilterBar";
import { CoverLetterDialog } from "@/components/dialogs/CoverLetterDialog";
import { StatusChangeDialog } from "@/components/dialogs/StatusChangeDialog";
import { updateApplicationStatus } from "@/lib/actions/applicationActions";
import { ApplicationList } from "./ApplicationList";
import type { Application, AppStatus } from "@/types";

interface Props {
  applications: Application[];
  filters: DashboardFilters;
  sources: string[];
  statusCounts: Record<string, number>;
}

export function DashboardClient({ applications, filters, sources, statusCounts }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [clDialog, setClDialog] = useState<{ open: boolean; content: string; coverId: string | null }>({
    open: false,
    content: "",
    coverId: null,
  });
  const [statusDialog, setStatusDialog] = useState<{
    open: boolean;
    id: string;
    status: AppStatus;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFilterChange = (newFilters: DashboardFilters) => {
    const params = new URLSearchParams();
    if (newFilters.status !== "ALL") params.set("status", newFilters.status);
    if (newFilters.source !== "ALL") params.set("source", newFilters.source);
    if (newFilters.position) params.set("position", newFilters.position);
    if (newFilters.hasSalary) params.set("hasSalary", "true");
    router.replace(`/dashboard${params.size > 0 ? `?${params.toString()}` : ""}`);
  };

  const handleStatusChange = (id: string, status: AppStatus) => {
    startTransition(async () => {
      try {
        await updateApplicationStatus(id, status);
        router.refresh();
        setStatusDialog(null);
      } catch (err) {
        setErrorMsg(`Failed to update status: ${String(err)}`);
      }
    });
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Application Dashboard
      </Typography>

      {errorMsg && (
        <Alert severity="error" onClose={() => setErrorMsg(null)} sx={{ mb: 2 }}>
          {errorMsg}
        </Alert>
      )}

      <DashboardFilterBar
        sources={sources}
        statusCounts={statusCounts}
        filters={filters}
        onChange={handleFilterChange}
      />

      <ApplicationList
        applications={applications}
        isPending={isPending}
        onStatusClick={(id, status) => setStatusDialog({ open: true, id, status })}
        onViewCoverLetter={(content, coverId) => setClDialog({ open: true, content, coverId })}
      />

      <CoverLetterDialog
        open={clDialog.open}
        content={clDialog.content}
        onClose={() => setClDialog({ open: false, content: "", coverId: null })}
        onDelete={clDialog.coverId ? async () => {
          await fetch("/api/graphql", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: `mutation Del($id: ID!) { deleteCoverLetter(id: $id) }`,
              variables: { id: clDialog.coverId },
            }),
          });
          setClDialog({ open: false, content: "", coverId: null });
          router.refresh();
        } : undefined}
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
