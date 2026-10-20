import { PrismaClient, Priority, ProjectStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const NAMES = [
  "Website redesign", "Mobile onboarding", "Billing migration", "Data warehouse",
  "Customer portal", "SEO audit", "Design system v2", "Support chatbot",
  "Analytics pipeline", "Security review", "Partner API", "Email campaigns",
  "Inventory sync", "Pricing experiment", "Internal wiki", "Load testing",
  "Accessibility pass", "Checkout revamp", "Localization", "Admin console",
  "Search relevance", "Referral program", "Push notifications", "Audit logging",
];

const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];

async function main() {
  const email = "demo@nexus.dev";
  const passwordHash = await bcrypt.hash("Password123!", 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Demo User", passwordHash, bio: "Kicking the tyres on Nexus." },
  });

  await prisma.project.deleteMany({ where: { userId: user.id } });

  const now = Date.now();
  const day = 86_400_000;

  await prisma.project.createMany({
    data: NAMES.map((name) => {
      const status = pick(Object.values(ProjectStatus));
      const createdAt = new Date(now - Math.floor(Math.random() * 180) * day);
      const completedAt =
        status === "COMPLETED"
          ? new Date(Math.min(now, createdAt.getTime() + Math.floor(Math.random() * 60 + 5) * day))
          : null;
      return {
        name,
        description: `${name} — seeded demo project.`,
        status,
        priority: pick(Object.values(Priority)),
        budget: Math.round(Math.random() * 95 + 5) * 1000,
        progress: status === "COMPLETED" ? 100 : Math.floor(Math.random() * 90),
        dueDate: new Date(createdAt.getTime() + Math.floor(Math.random() * 120 + 14) * day),
        createdAt,
        completedAt,
        userId: user.id,
      };
    }),
  });

  console.log(`Seeded ${NAMES.length} projects for ${email} (password: Password123!)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
