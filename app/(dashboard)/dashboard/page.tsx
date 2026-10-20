import type { Metadata } from "next";
import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import { auth } from "@/auth";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { getDashboardStats } from "@/lib/data/projects";
import { queryKeys } from "@/hooks/query-keys";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id; // layout guarantees a session

  // Prefetch on the server so the first paint has data; the client then polls.
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: queryKeys.stats,
    queryFn: () => getDashboardStats(userId),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardView firstName={session!.user.name?.split(" ")[0]} />
    </HydrationBoundary>
  );
}
