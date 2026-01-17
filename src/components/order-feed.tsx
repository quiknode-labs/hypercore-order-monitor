"use client";

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight, ChevronDown, Filter, RefreshCw } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, formatTimestamp, truncateAddress } from '@/lib/utils';
import type { OrderLog } from '@/types';

type StatusCategory = 'success' | 'cancellation' | 'rejection' | 'unknown';

const statusStyles: Record<StatusCategory, string> = {
  success:
    'bg-emerald-500/10 text-emerald-700 dark:text-emerald-200 border-emerald-500/30',
  cancellation:
    'bg-amber-500/10 text-amber-700 dark:text-amber-200 border-amber-500/30',
  rejection: 'bg-rose-500/10 text-rose-700 dark:text-rose-200 border-rose-500/30',
  unknown: 'bg-muted text-muted-foreground border-border/60',
};

const EXPLORER_BASE = 'https://app.hyperliquid.xyz/explorer';

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function explorerLink(type: 'tx' | 'block' | 'address', value: string) {
  return `${EXPLORER_BASE}/${type}/${encodeURIComponent(value)}`;
}

function ExplorerLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "text-primary/80 underline-offset-2 hover:text-primary hover:underline",
        className
      )}
    >
      {children}
    </Link>
  );
}

function getOrderUserDisplay(order: OrderLog) {
  const label = order.user?.displayName ?? order.user?.name ?? 'Unknown';
  const address = order.user?.walletAddress ?? null;
  return { label, address };
}

function getStatusCategory(
  status: string,
  statusMap: Map<string, StatusCategory>
): StatusCategory {
  return statusMap.get(status) ?? 'unknown';
}

function OrderCard({
  order,
  statusCategory,
}: {
  order: OrderLog;
  statusCategory: StatusCategory;
}) {
  const isBuy = order.side === 'B';
  const icon = isBuy ? ArrowUpRight : ArrowDownLeft;
  const Icon = icon;
  const sizeLabel =
    order.sz === order.origSz ? order.sz : `${order.sz} (orig ${order.origSz})`;

  const blockTime = new Date(order.blockTime);
  const statusClass = statusStyles[statusCategory];

  const builder =
    order.builder && typeof order.builder === 'object' ? order.builder : null;
  const builderAddress =
    builder && typeof builder['b'] === 'string' ? (builder['b'] as string) : null;
  const builderFee =
    builder && typeof builder['f'] === 'number' ? (builder['f'] as number) : null;

  const extraFlags = [
    order.reduceOnly ? 'Reduce Only' : null,
    order.isTrigger ? 'Trigger' : null,
  ].filter(Boolean) as string[];

  const { label: userLabel, address: userAddress } = getOrderUserDisplay(order);
  const userDisplay = userAddress ? (
    <Link
      href={explorerLink('address', userAddress)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5"
    >
      <span className="text-sm font-medium text-foreground">{userLabel}</span>
      <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-mono text-primary/70">
        {truncateAddress(userAddress)}
      </span>
    </Link>
  ) : (
    <span className="text-sm font-medium text-foreground">{userLabel}</span>
  );

  return (
    <div className="rounded-xl border border-border/60 bg-card/80 p-3 shadow-sm transition-all hover:border-border hover:shadow-md">
      <div className="flex gap-3">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full",
            isBuy
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
              : "bg-rose-500/15 text-rose-500 dark:text-rose-300"
          )}
        >
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge variant="outline" className={cn("text-[10px] uppercase", statusClass)}>
              {order.status}
            </Badge>
            {userDisplay}
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {isBuy ? 'Buy' : 'Sell'}
            </span>
            <span className="text-sm font-semibold text-foreground">{sizeLabel}</span>
            <span className="text-sm font-medium text-foreground">{order.coin}</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              at
            </span>
            <span className="text-sm text-foreground">${order.limitPx}</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              on
            </span>
            <ExplorerLink
              href={explorerLink('block', order.blockNumber)}
              className="font-mono text-xs"
            >
              {order.blockNumber}
            </ExplorerLink>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground/80">
            <span className="rounded-full border border-border/60 bg-background/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground/80">
              {formatDate(blockTime)} • {formatTimestamp(blockTime)}
            </span>
            <span>
              Order: {order.orderType} {order.tif}
            </span>
            <span className="text-muted-foreground/40">•</span>
            <span>
              OID: <span className="font-mono">{order.oid}</span>
            </span>
            {order.txHash && (
              <>
                <span className="text-muted-foreground/40">•</span>
                <span>
                  Tx:{' '}
                  <ExplorerLink href={explorerLink('tx', order.txHash)} className="font-mono">
                    {truncateAddress(order.txHash)}
                  </ExplorerLink>
                </span>
              </>
            )}
            {order.isTrigger && (
              <>
                <span className="text-muted-foreground/40">•</span>
                <span>
                  Trigger: <span className="font-mono">{order.triggerPx ?? 'N/A'}</span>
                </span>
              </>
            )}
            {builderAddress && (
              <>
                <span className="text-muted-foreground/40">•</span>
                <span>
                  Builder:{' '}
                  <ExplorerLink
                    href={explorerLink('address', builderAddress)}
                    className="font-mono"
                  >
                    {truncateAddress(builderAddress)}
                  </ExplorerLink>
                  {builderFee !== null ? ` (fee ${builderFee})` : null}
                </span>
              </>
            )}
            {extraFlags.map((flag) => (
              <Badge
                key={flag}
                variant="secondary"
                className="bg-muted text-muted-foreground"
              >
                {flag}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function OrderFeed() {
  const { orders, setOrders, users, statusFilters } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedCoin, setSelectedCoin] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const statusCategoryMap = useMemo(() => {
    return new Map(
      statusFilters.map((item) => [item.status, item.category as StatusCategory])
    );
  }, [statusFilters]);

  const statusOptions = useMemo(() => {
    if (statusFilters.length > 0) return statusFilters.map((item) => item.status);
    return Array.from(new Set(orders.map((order) => order.status))).sort();
  }, [orders, statusFilters]);

  const coinOptions = useMemo(() => {
    return Array.from(new Set(orders.map((order) => order.coin))).sort();
  }, [orders]);

  const userOptions = useMemo(() => {
    return users
      .map((user) => ({
        id: user.id,
        label: user.displayName ?? user.name,
        address: user.walletAddress,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [users]);

  const selectedUser = useMemo(() => {
    if (!selectedUserId) return null;
    return users.find((user) => user.id === selectedUserId) ?? null;
  }, [selectedUserId, users]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('limit', '50');

    if (selectedStatuses.length > 0) {
      params.set('status', selectedStatuses.join(','));
    }
    if (selectedCoin) {
      params.set('coin', selectedCoin);
    }
    if (selectedUserId) {
      params.set('userId', selectedUserId);
    }

    const controller = new AbortController();
    setLoading(true);

    fetch(`/api/orders?${params.toString()}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (data.orders) setOrders(data.orders);
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') {
          console.error('Failed to load orders:', error);
        }
      })
      .finally(() => {
        setLoading(false);
      });

    return () => controller.abort();
  }, [selectedCoin, selectedStatuses, selectedUserId, setOrders]);

  const statusLabel = selectedStatuses.length
    ? selectedStatuses.length === 1
      ? selectedStatuses[0]
      : `${selectedStatuses.length} Statuses`
    : 'All Statuses';

  const coinLabel = selectedCoin ?? 'All Coins';
  const userLabel = selectedUser
    ? selectedUser.displayName ?? selectedUser.name
    : 'All Users';

  const clearFilters = () => {
    setSelectedStatuses([]);
    setSelectedCoin(null);
    setSelectedUserId(null);
  };

  return (
    <Card className="shadow-sm h-full min-h-[600px] flex flex-col bg-card/70 backdrop-blur-sm">
      <CardHeader className="pb-4 space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-5 h-5 text-muted-foreground" />
            Live Order Feed
          </CardTitle>
          <div className="flex items-center gap-2">
            <Link href="/activity">
              <Badge variant="outline" className="cursor-pointer hover:bg-accent font-normal">
                View All
              </Badge>
            </Link>
            <Badge variant="secondary" className="bg-muted text-muted-foreground">
              {orders.length} Orders
            </Badge>
          </div>
        </div>

        <div className="flex flex-col md:flex-row flex-wrap items-stretch md:items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 w-full md:w-auto justify-between">
                {statusLabel}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Status Filters</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {statusOptions.length === 0 ? (
                <div className="px-2 py-1 text-xs text-muted-foreground">No statuses yet</div>
              ) : (
                statusOptions.map((status) => (
                  <DropdownMenuCheckboxItem
                    key={status}
                    checked={selectedStatuses.includes(status)}
                    onCheckedChange={(checked) => {
                      setSelectedStatuses((current) =>
                        checked
                          ? [...current, status]
                          : current.filter((item) => item !== status)
                      );
                    }}
                  >
                    {status}
                  </DropdownMenuCheckboxItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 w-full md:w-auto justify-between">
                {coinLabel}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Coins</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={selectedCoin ?? 'all'}
                onValueChange={(value) =>
                  setSelectedCoin(value === 'all' ? null : value)
                }
              >
                <DropdownMenuRadioItem value="all">All Coins</DropdownMenuRadioItem>
                {coinOptions.map((coin) => (
                  <DropdownMenuRadioItem key={coin} value={coin}>
                    {coin}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 w-full md:w-auto justify-between">
                {userLabel}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Users</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={selectedUserId ?? 'all'}
                onValueChange={(value) =>
                  setSelectedUserId(value === 'all' ? null : value)
                }
              >
                <DropdownMenuRadioItem value="all">All Users</DropdownMenuRadioItem>
                {userOptions.map((user) => (
                  <DropdownMenuRadioItem key={user.id} value={user.id}>
                    <span className="flex flex-col">
                      <span>{user.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {truncateAddress(user.address)}
                      </span>
                    </span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-2 w-full md:w-auto">
            <RefreshCw className="h-4 w-4" />
            Clear
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full px-6 pb-6">
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                Loading orders…
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Filter className="w-8 h-8 text-muted-foreground/70" />
                </div>
                <h3 className="font-medium mb-1">No orders yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  HyperCore order updates will appear here in real time.
                </p>
              </div>
            ) : (
              orders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  statusCategory={getStatusCategory(order.status, statusCategoryMap)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
