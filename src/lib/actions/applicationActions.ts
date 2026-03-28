"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ApplicationStatus } from "@prisma/client";

export async function updateApplicationStatus(
  id: string,
  status: string,
): Promise<void> {
  await prisma.application.update({
    where: { id },
    data: { status: status as ApplicationStatus },
  });
  revalidatePath("/dashboard");
}
