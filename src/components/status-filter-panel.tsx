"use client";

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, AlertTriangle, XCircle, ChevronDown } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { StatusFilter } from '@/types';

const categoryOrder = ['success', 'cancellation', 'rejection'] as const;

const categoryMeta = {
  success: {
    label: 'Success',
    icon: CheckCircle2,
    tone: 'text-emerald-600 dark:text-emerald-300',
    badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-200 border-emerald-500/30',
    accent: 'accent-emerald-600',
  },
  cancellation: {
    label: 'Cancellations',
    icon: AlertTriangle,
    tone: 'text-amber-600 dark:text-amber-300',
    badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-200 border-amber-500/30',
    accent: 'accent-amber-600',
  },
  rejection: {
    label: 'Rejections',
    icon: XCircle,
    tone: 'text-rose-600 dark:text-rose-300',
    badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-200 border-rose-500/30',
    accent: 'accent-rose-600',
  },
};

type CategoryKey = keyof typeof categoryMeta;

export function StatusFilterPanel() {
  const { statusFilters, setStatusFilters } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [draftStatuses, setDraftStatuses] = useState<StatusFilter[]>([]);
  const [openSections, setOpenSections] = useState<Record<CategoryKey, boolean>>({
    success: false,
    cancellation: false,
    rejection: false,
  });

  useEffect(() => {
    setDraftStatuses(statusFilters);
  }, [statusFilters]);

  const baseEnabledMap = useMemo(() => {
    return new Map(statusFilters.map((item) => [item.status, item.enabled]));
  }, [statusFilters]);

  const grouped = useMemo(() => {
    const groupMap = new Map<CategoryKey, typeof draftStatuses>();
    for (const category of categoryOrder) {
      groupMap.set(category, []);
    }

    for (const item of draftStatuses) {
      const category = item.category as CategoryKey;
      if (!groupMap.has(category)) {
        groupMap.set(category, []);
      }
      groupMap.get(category)?.push(item);
    }

    return groupMap;
  }, [draftStatuses]);

  const pendingUpdates = useMemo(() => {
    if (statusFilters.length === 0) return [];
    return draftStatuses
      .map((item) => {
        const base = baseEnabledMap.get(item.status);
        if (typeof base !== 'boolean' || base === item.enabled) return null;
        return { status: item.status, enabled: item.enabled };
      })
      .filter((item): item is { status: string; enabled: boolean } => item !== null);
  }, [baseEnabledMap, draftStatuses, statusFilters.length]);

  const hasPendingChanges = pendingUpdates.length > 0;

  const confirmChanges = async () => {
    if (pendingUpdates.length === 0) return;
    setLoading(true);

    try {
      const res = await fetch('/api/statuses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statuses: pendingUpdates }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update statuses');
      }

      const data = await res.json();
      if (data.statuses) {
        setStatusFilters(data.statuses);
      }
      toast.success('Status filters updated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update statuses');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/statuses/reset', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to reset statuses');
      }
      const data = await res.json();
      if (data.statuses) setStatusFilters(data.statuses);
      toast.success('Statuses reset to defaults');
    } catch (error: any) {
      toast.error(error.message || 'Failed to reset statuses');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (category: CategoryKey) => {
    setOpenSections((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  const toggleStatus = (status: string) => {
    setDraftStatuses((prev) =>
      prev.map((item) =>
        item.status === status ? { ...item, enabled: !item.enabled } : item
      )
    );
  };

  const selectAllInCategory = (category: CategoryKey) => {
    const items = grouped.get(category) ?? [];
    setDraftStatuses((prev) =>
      prev.map((item) =>
        items.some((entry) => entry.status === item.status)
          ? { ...item, enabled: true }
          : item
      )
    );
  };

  const selectAll = () => {
    setDraftStatuses((prev) => prev.map((item) => ({ ...item, enabled: true })));
  };

  const clearAll = () => {
    setDraftStatuses((prev) => prev.map((item) => ({ ...item, enabled: false })));
  };

  return (
    <Card className="shadow-sm" id="status-filters">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Status Filters</CardTitle>
          <Button variant="ghost" size="sm" onClick={handleReset} disabled={loading}>
            Reset
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Enabled statuses sync to the HyperCore stream in real time.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {draftStatuses.length === 0 ? (
          <div className="text-sm text-muted-foreground">Loading statuses…</div>
        ) : (
          categoryOrder.map((category) => {
            const items = grouped.get(category) ?? [];
            const meta = categoryMeta[category];
            const Icon = meta.icon;
            const isOpen = openSections[category];
            return (
              <div key={category} className="space-y-3">
                <button
                  type="button"
                  onClick={() => toggleSection(category)}
                  className="flex w-full items-center justify-between gap-2 text-left"
                >
                  <div className={cn("flex items-center gap-2 text-sm font-medium", meta.tone)}>
                    <Icon className="h-4 w-4" />
                    <span>{meta.label}</span>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      isOpen ? "rotate-180" : ""
                    )}
                  />
                </button>

                {isOpen && (
                  <div className="space-y-2">
                    {category === 'success' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => selectAllInCategory('success')}
                        disabled={loading}
                      >
                        Select All Success
                      </Button>
                    )}
                    <div className="grid grid-cols-1 gap-2">
                      {items.map((item) => {
                        const baseEnabled = baseEnabledMap.get(item.status) ?? false;
                        const selectionState =
                          item.enabled && baseEnabled
                            ? 'already'
                            : item.enabled
                              ? 'selecting'
                              : 'empty';

                        return (
                          <label
                            key={item.status}
                            className={cn(
                              "flex items-center justify-between rounded-md border px-3 py-2 text-xs transition-colors",
                              item.enabled
                                ? meta.badge
                                : "border-border/60 text-muted-foreground hover:border-border",
                              selectionState === 'selecting' && "border-dashed"
                            )}
                          >
                            <span className="font-mono truncate">{item.status}</span>
                            <input
                              type="checkbox"
                              checked={item.enabled}
                              onChange={() => toggleStatus(item.status)}
                              disabled={loading}
                              className={cn(
                                "h-4 w-4 rounded-sm border border-border/60",
                                selectionState === 'already' && meta.accent,
                                selectionState === 'selecting' &&
                                  "accent-sky-500 ring-1 ring-sky-400/50",
                                selectionState === 'empty' && "accent-muted-foreground"
                              )}
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        <div className="flex flex-wrap gap-2 pt-2 border-t border-border/60">
          <Button variant="secondary" size="sm" onClick={selectAll} disabled={loading}>
            Select All
          </Button>
          <Button variant="secondary" size="sm" onClick={clearAll} disabled={loading}>
            Clear All
          </Button>
          <Button
            size="sm"
            onClick={confirmChanges}
            disabled={loading || !hasPendingChanges}
            className="ml-auto"
          >
            Confirm
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
