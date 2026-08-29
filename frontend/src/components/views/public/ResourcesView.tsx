"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, BookOpen, Clock, Tag, AlertCircle, RotateCw } from "lucide-react";
import { useApp } from "@/lib/store";
import { api, ApiRequestError } from "@/lib/api";
import { RESOURCE_CATEGORIES } from "@/lib/constants";
import type { ResourceDTO } from "@/lib/types";
import { PageHeader, EmptyState, Spinner } from "@/components/shared/ui";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const ALL_CATEGORIES = "All";

export default function ResourcesView() {
  const navigate = useApp((s) => s.navigate);
  const [resources, setResources] = useState<ResourceDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORIES);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ResourceDTO | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.get<{ resources: ResourceDTO[] }>("/api/resources");
        if (!cancelled) setResources(data.resources ?? []);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof ApiRequestError
              ? e.message
              : "We couldn't load the resources library. Please try again."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Categories available in the data + the canonical list (deduped).
  const categories = useMemo(() => {
    const present = new Set(resources.map((r) => r.category));
    const ordered = RESOURCE_CATEGORIES.filter((c) => present.has(c));
    const extras = resources
      .map((r) => r.category)
      .filter((c) => !RESOURCE_CATEGORIES.includes(c));
    return [ALL_CATEGORIES, ...ordered, ...Array.from(new Set(extras))];
  }, [resources]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return resources.filter((r) => {
      if (activeCategory !== ALL_CATEGORIES && r.category !== activeCategory) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.summary.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [resources, activeCategory, query]);

  return (
    <div className="bg-background">
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <PageHeader
          title="Resources"
          description="A curated library of evidence-based practices for service life — breathing techniques, recovery, sleep, family separation, and more. Available to everyone, no login required."
        />

        {/* --------------------------------------------- FILTER + SEARCH BAR */}
        <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search resources by title, keyword, or tag…"
              className="pl-9"
              aria-label="Search resources"
            />
          </div>
          {error && (
            <div className="inline-flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  api
                    .get<{ resources: ResourceDTO[] }>("/api/resources")
                    .then((d) => setResources(d.resources ?? []))
                    .catch((e) =>
                      setError(e instanceof ApiRequestError ? e.message : "Failed to reload.")
                    )
                    .finally(() => setLoading(false));
                }}
              >
                <RotateCw className="h-3.5 w-3.5" /> Retry
              </Button>
            </div>
          )}
        </div>

        {/* ------------------------------------------------- CATEGORY CHIPS */}
        <div className="mt-5 flex flex-wrap gap-2">
          {categories.map((cat) => {
            const active = cat === activeCategory;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                aria-pressed={active}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* ---------------------------------------------------- RESULTS GRID */}
        <div className="mt-8">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="gap-0">
                  <CardHeader>
                    <div className="h-5 w-24 rounded bg-muted" />
                    <div className="mt-2 h-5 w-3/4 rounded bg-muted/70" />
                    <div className="mt-2 h-4 w-1/2 rounded bg-muted/50" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-4 w-full rounded bg-muted/60" />
                    <div className="mt-2 h-4 w-2/3 rounded bg-muted/60" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No resources found"
              description={
                resources.length === 0
                  ? "The library is currently empty. Check back soon."
                  : "Try a different search term or category filter."
              }
              action={
                resources.length > 0 ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setQuery("");
                      setActiveCategory(ALL_CATEGORIES);
                    }}
                  >
                    Clear filters
                  </Button>
                ) : null
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((r) => (
                <Card
                  key={r.id}
                  className="flex h-full cursor-pointer flex-col transition-shadow hover:shadow-md focus-within:shadow-md"
                  onClick={() => setSelected(r)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(r);
                    }
                  }}
                  aria-label={`Open resource: ${r.title}`}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                        {r.category}
                      </Badge>
                      {r.durationMin != null && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" /> {r.durationMin} min
                        </span>
                      )}
                    </div>
                    <CardTitle className="text-base leading-snug">{r.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-3">
                    <p className="text-sm leading-relaxed text-muted-foreground line-clamp-3">
                      {r.summary}
                    </p>
                    {r.tags.length > 0 && (
                      <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                        {r.tags.slice(0, 4).map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                          >
                            <Tag className="h-2.5 w-2.5" /> {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* --------------------------------------------------- DIALOG */}
        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent className="sm:max-w-2xl">
            {selected && (
              <>
                <DialogHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                      {selected.category}
                    </Badge>
                    {selected.durationMin != null && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> {selected.durationMin} min read
                      </span>
                    )}
                  </div>
                  <DialogTitle className="mt-2 text-xl">{selected.title}</DialogTitle>
                  <DialogDescription>{selected.summary}</DialogDescription>
                </DialogHeader>

                <div className="max-h-[55vh] overflow-y-auto pr-1 calm-scroll">
                  <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                    {selected.body}
                  </p>
                  {selected.tags.length > 0 && (
                    <div className="mt-5 flex flex-wrap gap-1.5 border-t border-border pt-4">
                      {selected.tags.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                        >
                          <Tag className="h-3 w-3" /> {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {selected.source && (
                    <p className="mt-4 text-xs italic text-muted-foreground">
                      Source: {selected.source}
                    </p>
                  )}
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setSelected(null)}>
                    Close
                  </Button>
                  <Button onClick={() => navigate("support")}>
                    Need to talk to someone?
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* ----------------------------- Loading overlay for slow fetch */}
        {loading && resources.length > 0 && (
          <div className="fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 rounded-md border border-border bg-background/90 px-3 py-2 text-xs shadow-md backdrop-blur">
            <Spinner /> Loading more…
          </div>
        )}
      </section>
    </div>
  );
}
