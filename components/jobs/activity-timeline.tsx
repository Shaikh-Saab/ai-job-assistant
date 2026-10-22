import type { JobEvent } from "@prisma/client";
import { EVENT_LABELS } from "@/lib/jobs/events";

/** Newest-first activity history drawn as a dotted timeline. */
export function ActivityTimeline({ events }: { events: Pick<JobEvent, "id" | "type" | "detail" | "createdAt">[] }) {
  return (
    <section className="rounded-xl border bg-card p-5" aria-labelledby="activity-h">
      <p className="eyebrow">History</p>
      <h2 id="activity-h" className="font-display text-lg font-semibold">Activity</h2>
      {events.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nothing yet. Actions on this job will show up here.</p>
      ) : (
        <ol className="relative mt-4 space-y-4 pl-6">
          <span className="absolute bottom-2 left-[5px] top-2 w-px border-l-2 border-dotted border-dot" aria-hidden="true" />
          {events.map((e, i) => (
            <li key={e.id} className="relative">
              <span
                className={`absolute -left-6 top-1 h-3 w-3 rounded-full border-2 border-card ${i === 0 ? "bg-primary" : "bg-dot"}`}
                aria-hidden="true"
              />
              <p className="text-sm font-medium">{EVENT_LABELS[e.type]}</p>
              <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                {e.detail && <>{e.detail} · </>}
                <time dateTime={e.createdAt.toISOString()}>
                  {e.createdAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </time>
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
