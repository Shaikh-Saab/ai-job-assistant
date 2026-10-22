import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ user: null as { id: string; email: string } | null }));
vi.mock("@/auth", () => ({
  currentUserId: async () => state.user?.id ?? null,
  currentUser: async () => state.user,
  auth: async () => (state.user ? { user: state.user } : null),
  signIn: vi.fn(),
  signOut: vi.fn(),
  unstable_update: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createProject, deleteProject, updateProject } from "@/actions/projects";
import { register, requestPasswordReset, resetPassword } from "@/actions/auth";
import { listProjects } from "@/lib/data/projects";
import { projectQuerySchema } from "@/lib/validations";
import { cleanup, makeUser, prisma } from "../support/db";
import bcrypt from "bcryptjs";

let alice: { id: string; email: string };
let bob: { id: string; email: string };
const valid = { name: "Portfolio site", description: "", status: "ACTIVE", priority: "HIGH", budget: 1200, progress: 40, dueDate: "2026-12-01" };

beforeAll(async () => {
  await cleanup();
  alice = await makeUser("alice");
  bob = await makeUser("bob");
});
afterAll(cleanup);
beforeEach(() => (state.user = null));

describe("projects (server actions)", () => {
  it("rejects signed-out callers", async () => {
    expect(await createProject(valid)).toMatchObject({ ok: false, error: "You must be signed in" });
  });

  it("creates, lists, updates and deletes a project", async () => {
    state.user = alice;
    const created = await createProject(valid);
    expect(created.ok).toBe(true);
    const id = (created as { data: { id: string } }).data.id;

    const page = await listProjects(alice.id, projectQuerySchema.parse({ search: "portfolio" }));
    expect(page.total).toBe(1);
    expect(page.data[0]).toMatchObject({ name: "Portfolio site", dueDate: "2026-12-01T00:00:00.000Z" });

    expect((await updateProject(id, { ...valid, status: "COMPLETED", progress: 10 })).ok).toBe(true);
    const done = await prisma.project.findUniqueOrThrow({ where: { id } });
    expect(done.progress).toBe(100); // completed projects are forced to 100%
    expect(done.completedAt).not.toBeNull();

    expect((await deleteProject(id)).ok).toBe(true);
    expect(await prisma.project.count({ where: { id } })).toBe(0);
  });

  it("returns field errors for invalid input", async () => {
    state.user = alice;
    const res = await createProject({ ...valid, name: "", budget: -5 });
    expect(res.ok).toBe(false);
    expect((res as { fieldErrors: Record<string, string[]> }).fieldErrors).toHaveProperty("name");
    expect((res as { fieldErrors: Record<string, string[]> }).fieldErrors).toHaveProperty("budget");
  });

  it("never lets one user change another user's project", async () => {
    state.user = alice;
    const { data } = (await createProject(valid)) as { data: { id: string } };
    state.user = bob;
    expect(await updateProject(data.id, valid)).toMatchObject({ ok: false, error: "Project not found" });
    expect(await deleteProject(data.id)).toMatchObject({ ok: false, error: "Project not found" });
    expect((await listProjects(bob.id, projectQuerySchema.parse({}))).total).toBe(0);
  });
});

describe("auth flows", () => {
  it("registers a user with a hashed password and refuses duplicates", async () => {
    const email = `new_${Date.now()}@nexus.test`;
    const input = { name: "New Person", email, password: "Password1", confirmPassword: "Password1" };
    await register(input); // signIn is mocked, so this returns normally
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.passwordHash).not.toBe("Password1");
    expect(await bcrypt.compare("Password1", user.passwordHash!)).toBe(true);
    expect(await register(input)).toMatchObject({ ok: false, error: "An account with this email already exists" });
  });

  it("runs the full password reset: email link → new password → link can't be reused", async () => {
    const logs: string[] = [];
    const spy = vi.spyOn(console, "info").mockImplementation((m: string) => void logs.push(m));
    const res = await requestPasswordReset({ email: alice.email });
    spy.mockRestore();
    expect(res).toMatchObject({ ok: true });

    const link = logs.join("\n").match(/https:\/\/nexus\.test\/reset-password\?token=(\S+)/);
    expect(link).not.toBeNull();
    const token = decodeURIComponent(link![1]);

    expect(await resetPassword({ token, password: "NewPass123", confirmPassword: "NewPass123" })).toMatchObject({ ok: true });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: alice.id } });
    expect(await bcrypt.compare("NewPass123", user.passwordHash!)).toBe(true);

    expect(await resetPassword({ token, password: "Another123", confirmPassword: "Another123" })).toMatchObject({
      ok: false,
      error: "This reset link is invalid or has expired.",
    });
  });

  it("gives the same answer for unknown emails (no account enumeration)", async () => {
    const res = await requestPasswordReset({ email: "nobody-here@nexus.test" });
    expect(res).toMatchObject({ ok: true });
  });

  it("rejects expired reset tokens", async () => {
    const { createPasswordResetToken } = await import("@/lib/tokens");
    const token = await createPasswordResetToken(bob.email);
    await prisma.passwordResetToken.updateMany({ where: { email: bob.email }, data: { expires: new Date(Date.now() - 1000) } });
    expect(await resetPassword({ token, password: "NewPass123", confirmPassword: "NewPass123" })).toMatchObject({ ok: false });
  });

  it("refuses to fake-send reset emails in production without an email provider", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const res = await requestPasswordReset({ email: alice.email });
      expect(res).toMatchObject({ ok: false });
      expect((res as { error: string }).error).toContain("isn’t set up");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
