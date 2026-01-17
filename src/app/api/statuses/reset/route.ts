import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  DEFAULT_ENABLED_STATUSES,
  syncStatusFiltersToKv,
} from '@/lib/status-filters'
import { verifyAuth, unauthorized } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return unauthorized()
  }

  const previous = await prisma.statusFilter.findMany({
    select: { status: true, enabled: true },
  })

  try {
    await syncStatusFiltersToKv(
      previous.map((item) => ({
        status: item.status,
        enabled: DEFAULT_ENABLED_STATUSES.includes(item.status),
      }))
    )
  } catch (error) {
    console.error('KV status sync failed:', error)
    return NextResponse.json({ error: 'KV Store error' }, { status: 502 })
  }

  try {
    await prisma.statusFilter.updateMany({
      data: { enabled: false },
    })

    await prisma.statusFilter.updateMany({
      where: { status: { in: DEFAULT_ENABLED_STATUSES } },
      data: { enabled: true },
    })
  } catch (error) {
    console.error('Status reset failed:', error)
    return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
  }

  const statuses = await prisma.statusFilter.findMany({
    orderBy: [{ category: 'asc' }, { status: 'asc' }],
  })

  return NextResponse.json({ statuses })
}
