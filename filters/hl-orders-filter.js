// filters/hl-orders-filter.js
// Filters Hyperliquid Core (L1) order events by monitored user addresses and enabled statuses.
//
// KV Store Lists:
//   - userstream_hl_users: Lowercase 0x addresses of monitored users
//   - userstream_hl_statuses: Enabled order statuses (e.g., "open", "filled", "canceled")
//
// IMPORTANT: Store addresses in LOWERCASE in the KV list.
//
// Order Status Reference:
//   Success: open, filled, triggered
//   Cancellation: canceled, marginCanceled, openInterestCapCanceled, reduceOnlyCanceled,
//                 scheduledCancel, selfTradeCanceled, siblingFilledCanceled
//   Rejection: badAloPxRejected, iocCancelRejected, insufficientSpotBalanceRejected,
//              minTradeNtlRejected, oracleRejected, perpMarginRejected, perpMaxPositionRejected,
//              positionFlipAtOpenInterestCapRejected, positionIncreaseAtOpenInterestCapRejected,
//              reduceOnlyRejected, tooAggressiveAtOpenInterestCapRejected

const KV_USERS = "userstream_hl_users";
const KV_STATUSES = "userstream_hl_statuses";

function normAddr(a) {
  return a ? a.toLowerCase() : null;
}

async function main(payload) {
  const events = [];
  const { data, metadata } = payload;

  for (const block of data ?? []) {
    const blockEvents = block.events ?? [];
    if (blockEvents.length === 0) continue;

    // Collect unique user addresses and statuses from this block
    const addressSet = new Set();
    const statusSet = new Set();

    for (const evt of blockEvents) {
      if (evt.user) addressSet.add(normAddr(evt.user));
      if (evt.status) statusSet.add(evt.status);
    }

    addressSet.delete(null);

    if (addressSet.size === 0) continue;

    // Batch KV lookups: users and statuses
    const addresses = Array.from(addressSet);
    const statuses = Array.from(statusSet);

    const [userHits, statusHits] = await Promise.all([
      qnLib.qnContainsListItems(KV_USERS, addresses),
      qnLib.qnContainsListItems(KV_STATUSES, statuses),
    ]);

    const userHitMap = new Map(addresses.map((a, i) => [a, userHits[i]]));
    const statusHitMap = new Map(statuses.map((s, i) => [s, statusHits[i]]));

    // Filter events: user must be monitored AND status must be enabled
    for (const evt of blockEvents) {
      const user = normAddr(evt.user);
      const status = evt.status;

      if (!user || !userHitMap.get(user)) continue;
      if (!status || !statusHitMap.get(status)) continue;

      const order = evt.order ?? {};

      events.push({
        eventId: `${block.block_number}:${order.oid ?? "unknown"}`,
        eventType: "order",
        status,
        matchedAddress: user,
        network: metadata?.network,
        blockNumber: block.block_number,
        blockTime: block.block_time,
        localTime: block.local_time,
        txHash: evt.hash ?? null,
        builder: evt.builder ?? null,
        order: {
          oid: order.oid,
          coin: order.coin,
          side: order.side,
          orderType: order.orderType,
          limitPx: order.limitPx,
          sz: order.sz,
          origSz: order.origSz,
          tif: order.tif,
          cloid: order.cloid ?? null,
          timestamp: order.timestamp,
          isTrigger: order.isTrigger,
          triggerPx: order.triggerPx,
          triggerCondition: order.triggerCondition,
          reduceOnly: order.reduceOnly,
          isPositionTpsl: order.isPositionTpsl,
          children: order.children ?? [],
        },
      });
    }
  }

  return events.length ? { events } : null;
}
