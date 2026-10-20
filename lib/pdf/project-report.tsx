import { Circle, Document, Font, Page, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import type { Project } from "@prisma/client";

import type { ReportSummary } from "@/lib/report";
import { PRIORITY_LABELS, REPORT_SECTIONS, STATUS_LABELS, type ReportSection } from "@/lib/validations";

/*
 * Print palette. Built-in PDF fonts only (Helvetica / Courier) so rendering never depends on
 * a network font fetch. Status is always printed as text; color is a secondary cue.
 */
const INK = "#0E1726";
const PAPER = "#FFFFFF";
const MUTED = "#5B6472";
const RULE = "#D5D9E0";
const DOT_OFF = "#DDE1E7";
const COBALT = "#2453D6";
const ORANGE = "#EB6834";
const RED = "#B42318";

const STATUS_COLOR: Record<Project["status"], string> = {
  PLANNING: "#7A8290",
  ACTIVE: "#2A78D6",
  ON_HOLD: "#B7791F",
  COMPLETED: "#15803D",
};

// Never hyphenate words across lines (react-pdf does by default).
Font.registerHyphenationCallback((word) => [word]);

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const date = (d: Date | null) =>
  d ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(d) : "-";

const s = StyleSheet.create({
  page: { backgroundColor: PAPER, color: INK, fontFamily: "Helvetica", fontSize: 9, paddingTop: 36, paddingBottom: 56, paddingHorizontal: 40 },
  label: { fontFamily: "Courier", fontSize: 7, letterSpacing: 1.2, textTransform: "uppercase", color: MUTED },
  h2: { fontFamily: "Helvetica-Bold", fontSize: 13, marginBottom: 2 },
  sectionHead: { marginTop: 22, marginBottom: 10 },
  // cover
  cover: { marginTop: -36, marginHorizontal: -40, height: 196, backgroundColor: INK, color: "#FFFFFF", position: "relative", overflow: "hidden" },
  coverBody: { position: "absolute", left: 40, right: 40, top: 34, bottom: 28, justifyContent: "space-between" },
  coverTitle: { fontFamily: "Helvetica-Bold", fontSize: 26, lineHeight: 1.1 },
  coverMeta: { flexDirection: "row", gap: 28 },
  coverMetaLabel: { fontFamily: "Courier", fontSize: 6.5, letterSpacing: 1.2, textTransform: "uppercase", color: "#9AA6BC", marginBottom: 3 },
  coverMetaValue: { fontSize: 9, color: "#FFFFFF" },
  // tiles
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { width: "31.9%", borderWidth: 0.75, borderColor: RULE, borderRadius: 6, padding: 10, gap: 6 },
  tileValue: { fontFamily: "Helvetica-Bold", fontSize: 20 },
  tileNote: { fontSize: 7.5, color: MUTED },
  // status rows
  statusRow: { flexDirection: "row", alignItems: "center", paddingVertical: 5, borderBottomWidth: 0.75, borderBottomColor: RULE, borderBottomStyle: "dotted" },
  // table
  th: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: INK },
  tr: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 0.75, borderBottomColor: RULE, borderBottomStyle: "dotted", alignItems: "center" },
  footer: { position: "absolute", left: 40, right: 40, bottom: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});

const COLS = { name: "34%", status: "13%", priority: "10%", progress: "17%", budget: "13%", due: "13%" };

/** Halftone dots for the cover band; radius falls off from a focal point (top right). */
function Halftone() {
  const W = 595, H = 196, gap = 11, fx = W * 0.86, fy = H * 0.2;
  const maxD = Math.hypot(fx, H - fy);
  const dots: { x: number; y: number; r: number }[] = [];
  for (let y = gap / 2; y < H; y += gap) {
    for (let x = gap / 2; x < W; x += gap) {
      const t = 1 - Math.hypot(x - fx, y - fy) / maxD;
      const r = (gap / 2.2) * Math.pow(Math.max(t, 0), 2.6);
      // Fade out toward the bottom so the meta row (prepared for / generated / scope) stays legible.
      const fade = Math.max(0, 1 - Math.max(0, y - H * 0.45) / (H * 0.3));
      const rr = r * fade;
      if (rr > 0.35) dots.push({ x, y, r: rr });
    }
  }
  return (
    <Svg width={W} height={H} style={{ position: "absolute", top: 0, left: 0 }}>
      {dots.map((d, i) => (
        <Circle key={i} cx={d.x} cy={d.y} r={d.r} fill="#3B6CF0" opacity={0.85} />
      ))}
    </Svg>
  );
}

/** 5×5 dot-matrix "N" logo mark. */
function LogoMark({ size = 14, on = "#FFFFFF", off = "#3A4458" }) {
  const cell = size / 5;
  return (
    <Svg width={size} height={size}>
      {Array.from({ length: 25 }, (_, i) => {
        const r = Math.floor(i / 5), c = i % 5, lit = c === 0 || c === 4 || r === c;
        return <Circle key={i} cx={c * cell + cell / 2} cy={r * cell + cell / 2} r={lit ? cell * 0.42 : cell * 0.2} fill={lit ? on : off} />;
      })}
    </Svg>
  );
}

function DotMeter({ value, dots = 10, color = COBALT, size = 4.2 }: { value: number; dots?: number; color?: string; size?: number }) {
  const filled = Math.round((Math.max(0, Math.min(100, value)) / 100) * dots);
  const step = size + 2.2;
  return (
    <Svg width={dots * step} height={size}>
      {Array.from({ length: dots }, (_, i) => (
        <Circle key={i} cx={i * step + size / 2} cy={size / 2} r={size / 2} fill={i < filled ? color : DOT_OFF} />
      ))}
    </Svg>
  );
}

function DotRule() {
  return (
    <Svg width={515} height={2}>
      {Array.from({ length: 74 }, (_, i) => (
        <Circle key={i} cx={i * 7 + 1} cy={1} r={0.8} fill={RULE} />
      ))}
    </Svg>
  );
}

function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <View style={s.sectionHead} minPresenceAhead={60}>
      <Text style={s.label}>{eyebrow}</Text>
      <Text style={s.h2}>{title}</Text>
    </View>
  );
}

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

export type ProjectReportProps = {
  title: string;
  preparedFor: string;
  generatedAt: Date;
  filters: string;
  sections: ReportSection[];
  rows: Project[];
  summary: ReportSummary;
  truncated: boolean;
};

export function ProjectReport({ title, preparedFor, generatedAt, filters, sections, rows, summary, truncated }: ProjectReportProps) {
  const has = (x: ReportSection) => sections.includes(x);
  // Number only the sections actually included, in canonical order.
  const included = REPORT_SECTIONS.filter(has);
  const num = (x: ReportSection) => String(included.indexOf(x) + 1).padStart(2, "0");
  const now = generatedAt;
  const maxStatus = Math.max(1, ...summary.byStatus.map((b) => b.count));
  const maxMonth = Math.max(1, ...summary.monthly.flatMap((m) => [m.created, m.completed]));
  const yStep = Math.max(1, Math.ceil(maxMonth / 4));
  const yMax = yStep * 4;
  const CHART_H = 110;

  return (
    <Document title={title} author="Nexus" subject="Project portfolio report" creator="Nexus" producer="Nexus">
      <Page size="A4" style={s.page} wrap>
        {/* Cover band */}
        <View style={s.cover}>
          <Halftone />
          <View style={s.coverBody}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
              <LogoMark />
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10, letterSpacing: 2.4 }}>NEXUS</Text>
            </View>
            <View>
              <Text style={[s.coverMetaLabel, { marginBottom: 6 }]}>Project portfolio report</Text>
              <Text style={s.coverTitle}>{title}</Text>
            </View>
            <View style={s.coverMeta}>
              <View>
                <Text style={s.coverMetaLabel}>Prepared for</Text>
                <Text style={s.coverMetaValue}>{preparedFor}</Text>
              </View>
              <View>
                <Text style={s.coverMetaLabel}>Generated</Text>
                <Text style={s.coverMetaValue}>
                  {new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }).format(generatedAt)} UTC
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.coverMetaLabel}>Scope</Text>
                <Text style={s.coverMetaValue}>{filters}</Text>
              </View>
            </View>
          </View>
        </View>

        {has("summary") && (
          <View>
            <SectionHead eyebrow={`${num("summary")} · Summary`} title="Key figures" />
            <View style={s.tiles}>
              {[
                { l: "Projects", v: String(summary.total), n: "In this report" },
                { l: "Total budget", v: money.format(summary.budget), n: `Across ${summary.total} projects` },
                { l: "Avg. progress", v: `${summary.avgProgress}%`, n: "Mean of all rows", m: summary.avgProgress, c: "#C98500" },
                { l: "Active", v: String(summary.active), n: `${pct(summary.active, summary.total)}% of projects`, m: pct(summary.active, summary.total), c: COBALT },
                { l: "Completed", v: String(summary.completed), n: `${pct(summary.completed, summary.total)}% delivered`, m: pct(summary.completed, summary.total), c: "#15803D" },
                { l: "Overdue", v: String(summary.overdue), n: `${pct(summary.overdue, summary.open)}% of open work`, m: pct(summary.overdue, summary.open), c: RED },
              ].map((t) => (
                <View key={t.l} style={s.tile} wrap={false}>
                  <Text style={s.label}>{t.l}</Text>
                  <Text style={[s.tileValue, t.l === "Overdue" && summary.overdue > 0 ? { color: RED } : {}]}>{t.v}</Text>
                  {t.m !== undefined ? <DotMeter value={t.m} dots={14} color={t.c} /> : <View style={{ height: 4.2 }} />}
                  <Text style={s.tileNote}>{t.n}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {has("status") && (
          <View wrap={false}>
            <SectionHead eyebrow={`${num("status")} · Pipeline`} title="Status breakdown" />
            {summary.byStatus.map((b) => {
              const dots = Math.round((b.count / maxStatus) * 40);
              return (
                <View key={b.status} style={s.statusRow}>
                  <View style={{ width: 80, flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: STATUS_COLOR[b.status] }} />
                    <Text>{STATUS_LABELS[b.status]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Svg width={40 * 8.2} height={6}>
                      {Array.from({ length: 40 }, (_, i) => (
                        <Circle key={i} cx={i * 8.2 + 3} cy={3} r={3} fill={i < dots ? STATUS_COLOR[b.status] : DOT_OFF} />
                      ))}
                    </Svg>
                  </View>
                  <Text style={{ width: 40, textAlign: "right", fontFamily: "Helvetica-Bold" }}>{b.count}</Text>
                  <Text style={{ width: 44, textAlign: "right", color: MUTED }}>{pct(b.count, summary.total)}%</Text>
                </View>
              );
            })}
          </View>
        )}

        {has("activity") && (
          <View wrap={false}>
            <SectionHead eyebrow={`${num("activity")} · Throughput`} title="Monthly activity" />
            <View style={{ flexDirection: "row", gap: 14, marginBottom: 8 }}>
              {[["Created", COBALT], ["Completed", ORANGE]].map(([l, c]) => (
                <View key={l} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: c }} />
                  <Text style={{ color: MUTED }}>{l}</Text>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: "row" }}>
              {/* y axis */}
              <View style={{ width: 22, height: CHART_H, justifyContent: "space-between", alignItems: "flex-end", paddingRight: 5 }}>
                {[4, 3, 2, 1, 0].map((k) => (
                  <Text key={k} style={{ fontFamily: "Courier", fontSize: 7, color: MUTED, marginTop: k === 4 ? -4 : 0, marginBottom: k === 0 ? -4 : 0 }}>
                    {k * yStep}
                  </Text>
                ))}
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ height: CHART_H, position: "relative" }}>
                  {[0, 1, 2, 3, 4].map((k) => (
                    <View
                      key={k}
                      style={{ position: "absolute", left: 0, right: 0, top: (CHART_H * k) / 4, borderTopWidth: 0.75, borderTopColor: RULE, borderTopStyle: k === 4 ? "solid" : "dotted" }}
                    />
                  ))}
                  <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, top: 0, flexDirection: "row", alignItems: "flex-end" }}>
                    {summary.monthly.map((m) => (
                      <View key={m.month} style={{ flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "flex-end", gap: 3 }}>
                        {[
                          [m.created, COBALT],
                          [m.completed, ORANGE],
                        ].map(([v, c], i) => (
                          <View key={i} style={{ alignItems: "center" }}>
                            <Text style={{ fontSize: 6.5, color: INK, marginBottom: 2 }}>{v as number}</Text>
                            <View
                              style={{
                                width: 16,
                                height: Math.max(0.5, ((v as number) / yMax) * (CHART_H - 12)),
                                backgroundColor: c as string,
                                borderTopLeftRadius: 2,
                                borderTopRightRadius: 2,
                              }}
                            />
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                </View>
                <View style={{ flexDirection: "row", marginTop: 5 }}>
                  {summary.monthly.map((m) => (
                    <Text key={m.month} style={{ flex: 1, textAlign: "center", fontFamily: "Courier", fontSize: 7, color: MUTED }}>
                      {m.month.toUpperCase()}
                    </Text>
                  ))}
                </View>
              </View>
            </View>
          </View>
        )}

        {has("projects") && (
          // Own page when other sections precede it, so the repeating table header never
          // lands orphaned at the bottom of page 1.
          <View break={included.length > 1}>
            <SectionHead eyebrow={`${num("projects")} · Register`} title={`Project register (${rows.length})`} />
            {rows.length === 0 ? (
              <Text style={{ color: MUTED, paddingVertical: 16 }}>No projects match this report’s filters.</Text>
            ) : (
              <>
                <View style={s.th} fixed>
                  {(
                    [
                      ["Project", COLS.name, "left"],
                      ["Status", COLS.status, "left"],
                      ["Priority", COLS.priority, "left"],
                      ["Progress", COLS.progress, "left"],
                      ["Budget", COLS.budget, "right"],
                      ["Due", COLS.due, "right"],
                    ] as const
                  ).map(([l, w, a]) => (
                    <Text key={l} style={[s.label, { width: w, textAlign: a, color: INK }]}>
                      {l}
                    </Text>
                  ))}
                </View>
                {rows.map((p) => {
                  const overdue = p.status !== "COMPLETED" && p.dueDate && p.dueDate < now;
                  return (
                    <View key={p.id} style={s.tr} wrap={false}>
                      <View style={{ width: COLS.name, paddingRight: 8 }}>
                        <Text style={{ fontFamily: "Helvetica-Bold" }}>{p.name}</Text>
                        {p.description ? <Text style={{ color: MUTED, fontSize: 7.5, marginTop: 1.5 }}>{p.description}</Text> : null}
                      </View>
                      <View style={{ width: COLS.status, flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: STATUS_COLOR[p.status] }} />
                        <Text>{STATUS_LABELS[p.status]}</Text>
                      </View>
                      <Text style={{ width: COLS.priority, fontFamily: p.priority === "HIGH" ? "Helvetica-Bold" : "Helvetica" }}>
                        {PRIORITY_LABELS[p.priority]}
                      </Text>
                      <View style={{ width: COLS.progress, flexDirection: "row", alignItems: "center", gap: 5 }}>
                        <DotMeter value={p.progress} dots={10} size={3.6} />
                        <Text style={{ fontFamily: "Courier", fontSize: 7.5 }}>{p.progress}%</Text>
                      </View>
                      <Text style={{ width: COLS.budget, textAlign: "right" }}>{money.format(p.budget)}</Text>
                      <Text style={{ width: COLS.due, textAlign: "right", color: overdue ? RED : INK, fontFamily: overdue ? "Helvetica-Bold" : "Helvetica" }}>
                        {date(p.dueDate)}
                        {overdue ? "\nOVERDUE" : ""}
                      </Text>
                    </View>
                  );
                })}
                <View style={{ flexDirection: "row", paddingTop: 7 }} wrap={false}>
                  <Text style={[s.label, { flex: 1, color: INK }]}>Total · {rows.length} projects</Text>
                  <Text style={{ width: COLS.budget, textAlign: "right", fontFamily: "Helvetica-Bold" }}>{money.format(summary.budget)}</Text>
                  <Text style={{ width: COLS.due }} />
                </View>
                {truncated && (
                  <Text style={{ color: MUTED, marginTop: 8 }}>
                    Showing the first {rows.length} matching projects. Narrow the filters to include the rest.
                  </Text>
                )}
              </>
            )}
          </View>
        )}

        {/* Footer on every page */}
        <View style={s.footer} fixed>
          <View style={{ position: "absolute", top: -8, left: 0 }}>
            <DotRule />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <LogoMark size={8} on={INK} off={DOT_OFF} />
            <Text style={s.label}>Nexus · {title}</Text>
          </View>
          <Text style={s.label} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
