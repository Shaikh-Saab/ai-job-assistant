"use server";

import { currentUserId } from "@/auth";
import { prisma } from "@/lib/prisma";
import { projectSchema } from "@/lib/validations";
import type { ActionResult } from "@/types/actions";

const UNAUTHORIZED = { ok: false, error: "You must be signed in" } as const;

function toData(input: ReturnType<typeof projectSchema.parse>) {
  return {
    name: input.name,
    description: input.description || null,
    status: input.status,
    priority: input.priority,
    budget: input.budget,
    progress: input.status === "COMPLETED" ? 100 : input.progress,
    dueDate: input.dueDate ? new Date(`${input.dueDate}T00:00:00.000Z`) : null,
  };
}

export async function createProject(input: unknown): Promise<ActionResult<{ id: string }>> {
  const userId = await currentUserId();
  if (!userId) return UNAUTHORIZED;

  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const data = toData(parsed.data);
  const project = await prisma.project.create({
    data: { ...data, completedAt: data.status === "COMPLETED" ? new Date() : null, userId },
    select: { id: true },
  });

  return { ok: true, data: project, message: "Project created" };
}

export async function updateProject(id: string, input: unknown): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return UNAUTHORIZED;

  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  // Scoping by userId doubles as the ownership check.
  const existing = await prisma.project.findFirst({
    where: { id, userId },
    select: { status: true, completedAt: true },
  });
  if (!existing) return { ok: false, error: "Project not found" };

  const data = toData(parsed.data);
  const completedAt =
    data.status === "COMPLETED" ? (existing.completedAt ?? new Date()) : null;

  await prisma.project.update({ where: { id }, data: { ...data, completedAt } });
  return { ok: true, message: "Project updated" };
}

export async function deleteProject(id: string): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return UNAUTHORIZED;

  const { count } = await prisma.project.deleteMany({ where: { id, userId } });
  if (count === 0) return { ok: false, error: "Project not found" };

  return { ok: true, message: "Project deleted" };
}
