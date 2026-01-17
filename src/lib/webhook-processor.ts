import { prisma } from '@/lib/prisma'
import { orderEmitter } from '@/lib/sse'
import { isValidHypercoreAddress, normalizeAddress } from '@/lib/utils'

type HyperCoreOrderEvent = {
  eventId?: string
  eventType?: string
  status?: string
  matchedAddress?: string
  network?: string
  blockNumber?: number | string
  blockTime?: string
  localTime?: string
  txHash?: string | null
  builder?: Record<string, unknown> | null
  order?: Record<string, unknown>
}

type StreamPayloadInput = {
  events?: HyperCoreOrderEvent[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toBigInt(value: unknown): bigint | null {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number' && Number.isFinite(value)) {
    return BigInt(Math.trunc(value))
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    try {
      return BigInt(value)
    } catch {
      return null
    }
  }
  return null
}

function normalizeIsoTimestamp(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  let normalized = value.trim()
  if (!normalized) return null

  if (normalized.includes('.')) {
    normalized = normalized.replace(/(\.\d{3})\d+/, '$1')
  }

  const hasTimezone = /[zZ]|[+-]\d{2}:\d{2}$/.test(normalized)
  if (!hasTimezone) {
    normalized = `${normalized}Z`
  }

  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function processStreamPayload(
  payload: StreamPayloadInput
): Promise<{ processed: number; skipped: number }> {
  const events = Array.isArray(payload?.events) ? payload.events : []

  let processed = 0
  let skipped = 0

  for (const event of events) {
    if (!event || event.eventType !== 'order') {
      skipped += 1
      continue
    }

    if (!event.matchedAddress || !isValidHypercoreAddress(event.matchedAddress)) {
      skipped += 1
      continue
    }

    const eventId = typeof event.eventId === 'string' ? event.eventId : null
    const status = typeof event.status === 'string' ? event.status : null
    const blockNumber = toBigInt(event.blockNumber)
    const blockTime = normalizeIsoTimestamp(event.blockTime)
    const localTime = normalizeIsoTimestamp(event.localTime) ?? blockTime
    const network =
      typeof event.network === 'string' ? event.network : 'hypercore-mainnet'

    if (!eventId || !status || !blockNumber || !blockTime || !localTime) {
      skipped += 1
      continue
    }

    if (!isRecord(event.order)) {
      skipped += 1
      continue
    }

    const order = event.order
    const oid = toBigInt(order.oid)
    const coin = typeof order.coin === 'string' ? order.coin : null
    const side = typeof order.side === 'string' ? order.side : null
    const orderType = typeof order.orderType === 'string' ? order.orderType : null
    const limitPx = typeof order.limitPx === 'string' ? order.limitPx : null
    const sz = typeof order.sz === 'string' ? order.sz : null
    const origSz = typeof order.origSz === 'string' ? order.origSz : null
    const tif = typeof order.tif === 'string' ? order.tif : null

    if (
      !oid ||
      !coin ||
      !side ||
      !orderType ||
      !limitPx ||
      !sz ||
      !origSz ||
      !tif
    ) {
      skipped += 1
      continue
    }

    if (side !== 'B' && side !== 'A') {
      skipped += 1
      continue
    }

    const cloid = typeof order.cloid === 'string' ? order.cloid : null
    const isTrigger = typeof order.isTrigger === 'boolean' ? order.isTrigger : false
    const triggerPx = typeof order.triggerPx === 'string' ? order.triggerPx : null
    const reduceOnly =
      typeof order.reduceOnly === 'boolean' ? order.reduceOnly : false

    const normalizedAddress = normalizeAddress(event.matchedAddress)
    const user = await prisma.user.findUnique({
      where: { walletAddress: normalizedAddress },
    })

    if (!user) {
      skipped += 1
      continue
    }

    const txHash = typeof event.txHash === 'string' ? event.txHash : null
    const builder = isRecord(event.builder) ? JSON.stringify(event.builder) : null

    const orderLog = await prisma.orderLog.upsert({
      where: { eventId_status: { eventId, status } },
      create: {
        eventId,
        userId: user.id,
        oid,
        txHash,
        status,
        coin,
        side,
        orderType,
        limitPx,
        sz,
        origSz,
        tif,
        cloid,
        isTrigger,
        triggerPx,
        reduceOnly,
        network,
        blockNumber,
        blockTime,
        localTime,
        builder,
      },
      update: {
        txHash,
        sz,
        blockTime,
        localTime,
        builder,
      },
      include: { user: true },
    })

    const serializedOrder = {
      ...orderLog,
      oid: orderLog.oid.toString(),
      blockNumber: orderLog.blockNumber.toString(),
      builder: orderLog.builder ? JSON.parse(orderLog.builder) : null,
    }

    orderEmitter.emit('order', serializedOrder)
    processed += 1
  }

  return { processed, skipped }
}
