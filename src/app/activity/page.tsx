import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatTimestamp, truncateAddress, cn } from '@/lib/utils';
import { ArrowDownLeft, ArrowUpRight, Filter } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Force dynamic since we're fetching data
export const dynamic = 'force-dynamic';

function formatDate(date: Date) {
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    }).format(date);
}

type StatusCategory = 'success' | 'cancellation' | 'rejection' | 'unknown';

const statusStyles: Record<StatusCategory, string> = {
    success:
        'bg-emerald-500/10 text-emerald-700 dark:text-emerald-200 border-emerald-500/30',
    cancellation:
        'bg-amber-500/10 text-amber-700 dark:text-amber-200 border-amber-500/30',
    rejection:
        'bg-rose-500/10 text-rose-700 dark:text-rose-200 border-rose-500/30',
    unknown: 'bg-muted text-muted-foreground border-border/60',
};

function HistoryItem({
    order,
    statusCategory,
}: {
    order: any;
    statusCategory: StatusCategory;
}) {
    const isBuy = order.side === 'B';
    const sizeLabel =
        order.sz === order.origSz ? order.sz : `${order.sz} (orig ${order.origSz})`;
    const blockTime = new Date(order.blockTime);
    const userLabel = order.user?.displayName ?? order.user?.name ?? 'Unknown';
    const statusClass = statusStyles[statusCategory];

    const builder = order.builder
        ? (() => {
            try {
                return JSON.parse(order.builder);
            } catch {
                return null;
            }
        })()
        : null;

    return (
        <div className="flex flex-col gap-4 p-4 rounded-lg border border-border/60 bg-card/80 hover:border-border hover:shadow-sm transition-all">
            <div className={cn(
                "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
                isBuy ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" : "bg-rose-500/15 text-rose-500 dark:text-rose-300"
            )}>
                {isBuy ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
            </div>

            <div className="flex-1 min-w-0 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={cn("text-[10px] uppercase", statusClass)}>
                            {order.status}
                        </Badge>
                        <span className="font-medium text-foreground">
                            {userLabel} {isBuy ? 'bought' : 'sold'} {order.coin} @ ${order.limitPx}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatDate(blockTime)}</span>
                        <span>•</span>
                        <span>{formatTimestamp(blockTime)}</span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>Order: {order.orderType} {order.tif}</span>
                    <span className="text-muted-foreground/50">•</span>
                    <span>Size: {sizeLabel}</span>
                    {order.reduceOnly && (
                        <Badge variant="secondary" className="bg-muted text-muted-foreground">
                            Reduce Only
                        </Badge>
                    )}
                </div>

                <details className="rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                    <summary className="cursor-pointer list-none font-medium text-foreground">
                        View details
                    </summary>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <div>
                            <span className="text-muted-foreground/70">OID:</span>{' '}
                            <span className="font-mono">{order.oid.toString()}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground/70">Block:</span>{' '}
                            <span className="font-mono">{order.blockNumber.toString()}</span>
                        </div>
                        {order.txHash && (
                            <div>
                                <span className="text-muted-foreground/70">Tx Hash:</span>{' '}
                                <span className="font-mono">{truncateAddress(order.txHash)}</span>
                            </div>
                        )}
                        {order.cloid && (
                            <div>
                                <span className="text-muted-foreground/70">Client OID:</span>{' '}
                                <span className="font-mono">{truncateAddress(order.cloid)}</span>
                            </div>
                        )}
                        {order.isTrigger && (
                            <div>
                                <span className="text-muted-foreground/70">Trigger:</span>{' '}
                                <span className="font-mono">{order.triggerPx ?? 'N/A'}</span>
                            </div>
                        )}
                        {builder?.b && (
                            <div>
                                <span className="text-muted-foreground/70">Builder:</span>{' '}
                                <span className="font-mono">{truncateAddress(builder.b)}</span>
                            </div>
                        )}
                    </div>
                </details>
            </div>
        </div>
    );
}

export default async function ActivityPage(props: {
    searchParams: Promise<{ page?: string }>
}) {
    const searchParams = await props.searchParams;
    const page = Number(searchParams.page) || 1;
    const pageSize = 10;

    const [orders, totalCount, statusFilters] = await Promise.all([
        prisma.orderLog.findMany({
            take: pageSize,
            skip: (page - 1) * pageSize,
            orderBy: [{ blockTime: 'desc' }, { localTime: 'desc' }, { id: 'desc' }],
            include: { user: true },
        }),
        prisma.orderLog.count(),
        prisma.statusFilter.findMany(),
    ]);

    const statusMap = new Map(
        statusFilters.map((item) => [item.status, item.category as StatusCategory])
    );

    const totalPages = Math.ceil(totalCount / pageSize);

    return (
        <main className="min-h-screen bg-background text-foreground dot-grid">
            <div className="container mx-auto p-4 lg:p-8 max-w-4xl">
                <header className="mb-8">
                    <Link href="/" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">
                        ← Back to Dashboard
                    </Link>
                    <h1 className="text-3xl font-semibold tracking-tight mb-2">
                        Order History
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Full history of monitored HyperCore orders
                    </p>
                </header>

                <Card className="shadow-sm bg-card/70 backdrop-blur-sm border-border/60">
                    <CardHeader className="border-b border-border/60 bg-card/80">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Filter className="w-5 h-5 text-muted-foreground" />
                                All Orders
                            </CardTitle>
                            <div className="text-sm text-muted-foreground">
                                Total: {totalCount} orders
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {orders.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Filter className="w-8 h-8 text-muted-foreground/70" />
                                </div>
                                <h3 className="font-medium mb-1">No orders recorded</h3>
                            </div>
                        ) : (
                            <div className="divide-y divide-border/60">
                                {orders.map((order) => (
                                    <div key={order.id} className="p-2">
                                        <HistoryItem
                                            order={order}
                                            statusCategory={
                                                statusMap.get(order.status) ?? 'unknown'
                                            }
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="p-4 border-t border-border/60 flex items-center justify-between bg-card/70">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page <= 1}
                                    asChild={page > 1}
                                >
                                    {page > 1 ? (
                                        <Link href={`/activity?page=${page - 1}`}>Previous</Link>
                                    ) : (
                                        <span>Previous</span>
                                    )}

                                </Button>
                                <span className="text-sm text-muted-foreground">
                                    Page {page} of {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page >= totalPages}
                                    asChild={page < totalPages}
                                >
                                    {page < totalPages ? (
                                        <Link href={`/activity?page=${page + 1}`}>Next</Link>
                                    ) : (
                                        <span>Next</span>
                                    )}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}
