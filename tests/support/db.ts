import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

/** Create an isolated test user; everything it owns is removed by cleanup() (cascade). */
export async function makeUser(tag: string) {
  const id = `test_${tag}_${Math.random().toString(36).slice(2, 10)}`;
  return prisma.user.create({
    data: { id, email: `${id}@nexus.test`, name: `Test ${tag}`, passwordHash: await bcrypt.hash("Password123!", 4) },
  });
}

export async function cleanup() {
  await prisma.user.deleteMany({ where: { email: { endsWith: "@nexus.test" } } });
  await prisma.passwordResetToken.deleteMany({ where: { email: { endsWith: "@nexus.test" } } });
}

export { prisma };
