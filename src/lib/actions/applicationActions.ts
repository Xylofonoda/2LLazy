"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const StatusSchema = z.enum(["PENDING", "APPLIED", "REJECTED", "INTERVIEW", "FAILED"]);

export async function updateApplicationStatus(
  id: string,
  status: string,
): Promise<void> {
  const validated = StatusSchema.parse(status);
  await prisma.application.update({
    where: { id },
    data: { status: validated },
  });
  revalidatePath("/dashboard");
}
