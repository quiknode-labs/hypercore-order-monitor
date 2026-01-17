import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { verifyAuth, unauthorized } from '@/lib/auth'

export const runtime = 'nodejs'

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function parseDate(value: string | null, label: string): Date | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${label}`)
  }
  return date
}

function parseNumber(value: string | null, label: string): number | null {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${label}`)
  }
  return parsed
}

function safeParseJson(value: string | null) {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) {
    return unauthorized()
  }

  const params = request.nextUrl.searchParams

  const where: Prisma.OrderLogWhereInput = {}

  const userId = params.get('userId')
  if (userId) {
    where.userId = userId
  }

  const statusParam = params.get('status')
  if (statusParam) {
    const statuses = statusParam
      .split(',')
      .map((status) => status.trim())
      .filter(Boolean)

    if (statuses.length > 0) {
      where.status = { in: statuses }
    }
  }

  const coin = params.get('coin')
  if (coin) {
    where.coin = coin
  }

  const side = params.get('side')
  if (side) {
    if (side !== 'B' && side !== 'A') {
      return jsonError('Invalid side filter', 400)
    }
    where.side = side
  }

  const orderType = params.get('orderType')
  if (orderType) {
    where.orderType = orderType
  }

  try {
    const startTime = parseDate(params.get('startTime'), 'startTime')
    const endTime = parseDate(params.get('endTime'), 'endTime')

    if (startTime || endTime) {
      where.blockTime = {}
      if (startTime) {
        where.blockTime.gte = startTime
      }
      if (endTime) {
        where.blockTime.lte = endTime
      }
    }
  } catch (error) {
    return jsonError((error as Error).message, 400)
  }

  let limit = 50
  let offset = 0

  try {
    const parsedLimit = parseNumber(params.get('limit'), 'limit')
    const parsedOffset = parseNumber(params.get('offset'), 'offset')

    if (parsedLimit !== null) {
      if (parsedLimit <= 0) {
        return jsonError('Limit must be positive', 400)
      }
      limit = Math.min(parsedLimit, 200)
    }

    if (parsedOffset !== null) {
      if (parsedOffset < 0) {
        return jsonError('Offset must be zero or positive', 400)
      }
      offset = parsedOffset
    }
  } catch (error) {
    return jsonError((error as Error).message, 400)
  }

  const orders = await prisma.orderLog.findMany({
    where,
    orderBy: [{ blockTime: 'desc' }, { localTime: 'desc' }, { id: 'desc' }],
    take: limit,
    skip: offset,
    include: { user: true },
  })

  const formatted = orders.map((order) => ({
    ...order,
    oid: order.oid.toString(),
    blockNumber: order.blockNumber.toString(),
    builder: safeParseJson(order.builder),
  }))

  return NextResponse.json({ orders: formatted, limit, offset })
}
