"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  FileDown,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PriorityBadge, ProgressBar, StatusBadge } from "@/components/projects/project-badges";
import { useDebounce } from "@/hooks/use-debounce";
import { useProjects } from "@/hooks/use-projects";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  PROJECT_STATUSES,
  STATUS_LABELS,
  projectQuerySchema,
  type SortColumn,
} from "@/lib/validations";
import { useUIStore } from "@/store/ui-store";

const COLUMNS: { key: SortColumn; label: string; className?: string }[] = [
  { key: "name", label: "Name" },
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority", className: "hidden md:table-cell" },
  { key: "progress", label: "Progress", className: "hidden lg:table-cell" },
  { key: "budget", label: "Budget", className: "hidden sm:table-cell text-right" },
  { key: "dueDate", label: "Due", className: "hidden md:table-cell" },
];

const PAGE_SIZES = [10, 20, 50];

export function ProjectsTable() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // URL is the source of truth → filters are shareable, bookmarkable and survive refresh.
  const query = projectQuerySchema.parse(Object.fromEntries(searchParams));
  const [searchInput, setSearchInput] = useState(query.search);
  const debouncedSearch = useDebounce(searchInput, 300);

  const setParams = (patch: Record<string, string | number | undefined>, resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "") next.delete(k);
      else next.set(k, String(v));
    }
    if (resetPage) next.delete("page");
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  useEffect(() => {
    if (debouncedSearch !== query.search) setParams({ search: debouncedSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const { data, isLoading, isError, isFetching, refetch } = useProjects(query);

  // e.g. deleting the last row on the last page → step back to the new last page.
  useEffect(() => {
    if (data && data.total > 0 && data.page > data.pageCount) setParams({ page: data.pageCount }, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  const openCreateProject = useUIStore((s) => s.openCreateProject);
  const openEditProject = useUIStore((s) => s.openEditProject);
  const setDeleteTarget = useUIStore((s) => s.setDeleteTarget);

  const toggleSort = (key: SortColumn) =>
    setParams({ sort: key, order: query.sort === key && query.order === "asc" ? "desc" : "asc" }, false);

  const hasFilters = !!(query.search || query.status || query.priority);
  const exportParams = new URLSearchParams(
    Object.entries({ search: query.search, status: query.status, priority: query.priority, sort: query.sort, order: query.order })
      .filter(([, v]) => v) as [string, string][],
  ).toString();
  const clearFilters = () => {
    setSearchInput("");
    setParams({ search: undefined, status: undefined, priority: undefined });
  };

  const from = data ? (data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1) : 0;
  const to = data ? Math.min(data.page * data.pageSize, data.total) : 0;

  return (
    <Card className="overflow-hidden rounded-xl">
      {/* Filters */}
      <div className="flex flex-col gap-3 border-b bg-muted/30 p-4 md:flex-row md:items-center" role="search">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <label htmlFor="project-search" className="sr-only">
            Search projects
          </label>
          <Input
            id="project-search"
            type="search"
            placeholder="Search projects…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 md:flex">
          <NativeSelect
            aria-label="Filter by status"
            value={query.status ?? ""}
            onChange={(e) => setParams({ status: e.target.value })}
            className="md:w-40"
          >
            <option value="">All statuses</option>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="Filter by priority"
            value={query.priority ?? ""}
            onChange={(e) => setParams({ priority: e.target.value })}
            className="md:w-40"
          >
            <option value="">All priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </NativeSelect>
        </div>
        {hasFilters && (
          <Button variant="ghost" onClick={clearFilters}>
            <X aria-hidden="true" /> Clear
          </Button>
        )}
        {/* Exports exactly what the table shows (filters + sort), across all pages. */}
        <Button variant="outline" asChild>
          <a href={`/api/reports/projects?${exportParams}`} target="_blank" rel="noopener">
            <FileDown aria-hidden="true" /> Export PDF
          </a>
        </Button>
      </div>

      {/* Table */}
      <Table aria-busy={isFetching} className={cn(isFetching && !isLoading && "opacity-70 transition-opacity")}>
        <TableCaption className="sr-only">
          Projects, sorted by {query.sort} {query.order === "asc" ? "ascending" : "descending"}
        </TableCaption>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {COLUMNS.map((col) => {
              const active = query.sort === col.key;
              const Icon = !active ? ArrowUpDown : query.order === "asc" ? ArrowUp : ArrowDown;
              return (
                <TableHead
                  key={col.key}
                  className={col.className}
                  aria-sort={active ? (query.order === "asc" ? "ascending" : "descending") : "none"}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className={cn(
                      "-mx-2 inline-flex items-center gap-1 rounded px-2 py-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active && "text-foreground",
                    )}
                  >
                    {col.label}
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </TableHead>
              );
            })}
            <TableHead className="w-12">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={COLUMNS.length + 1}>
                  <Skeleton className="h-6 w-full" />
                </TableCell>
              </TableRow>
            ))
          ) : isError ? (
            <TableRow>
              <TableCell colSpan={COLUMNS.length + 1} className="py-12 text-center">
                <p className="mb-3 text-sm text-destructive">Couldn’t load projects.</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Retry
                </Button>
              </TableCell>
            </TableRow>
          ) : data?.data.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={COLUMNS.length + 1} className="py-16 text-center">
                <FolderOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" aria-hidden="true" />
                <p className="font-medium">{hasFilters ? "No projects match your filters" : "No projects yet"}</p>
                <p className="mb-4 text-sm text-muted-foreground">
                  {hasFilters ? "Try a different search or clear the filters." : "Create your first project to get started."}
                </p>
                {hasFilters ? (
                  <Button variant="outline" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : (
                  <Button onClick={openCreateProject}>
                    <Plus aria-hidden="true" /> New project
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ) : (
            data?.data.map((p) => {
              const overdue = p.dueDate && p.status !== "COMPLETED" && new Date(p.dueDate) < new Date();
              return (
                <TableRow key={p.id}>
                  <TableCell className="max-w-[16rem]">
                    <button
                      type="button"
                      onClick={() => openEditProject(p)}
                      className="block max-w-full truncate text-left font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {p.name}
                    </button>
                    {p.description && <p className="truncate text-xs text-muted-foreground">{p.description}</p>}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={p.status} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <PriorityBadge priority={p.priority} />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <ProgressBar value={p.progress} />
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatCurrency(p.budget)}</TableCell>
                  <TableCell className={cn("hidden whitespace-nowrap md:table-cell", overdue && "font-medium text-red-700 dark:text-red-400")}>
                    {formatDate(p.dueDate)}
                    {overdue && <span className="ml-1 text-xs">(overdue)</span>}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Actions for ${p.name}`}>
                          <MoreHorizontal aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => openEditProject(p)}>
                          <Pencil aria-hidden="true" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => setDeleteTarget(p)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 aria-hidden="true" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      <nav
        aria-label="Pagination"
        className="flex flex-col gap-3 border-t p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="text-muted-foreground" aria-live="polite">
          {data ? `Showing ${from}–${to} of ${data.total}` : " "}
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor="page-size" className="text-muted-foreground">
            Rows
          </label>
          <NativeSelect
            id="page-size"
            value={query.pageSize}
            onChange={(e) => setParams({ pageSize: e.target.value })}
            className="w-20"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </NativeSelect>
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous page"
            disabled={!data || data.page <= 1}
            onClick={() => setParams({ page: query.page - 1 }, false)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <span className="min-w-[5rem] text-center tabular-nums">
            Page {data?.page ?? query.page} of {data?.pageCount ?? 1}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next page"
            disabled={!data || data.page >= data.pageCount}
            onClick={() => setParams({ page: query.page + 1 }, false)}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </nav>
    </Card>
  );
}
