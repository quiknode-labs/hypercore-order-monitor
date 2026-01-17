import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { syncStatusFiltersToKv } from '@/lib/status-filters'
import { verifyAuth, unauthorized } from '@/lib/auth'

export const runtime = 'nodejs'

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function GET() {
  const statuses = await prisma.statusFilter.findMany({
    orderBy: [{ category: 'asc' }, { status: 'asc' }],
  })

  return NextResponse.json({ statuses })
}

export async function PATCH(request: NextRequest) {
  if (!verifyAuth(request)) {
    return unauthorized()
  }

  let body: { statuses?: Array<{ status?: string; enabled?: boolean }> }

  try {
    body = await request.json()
  } catch {
    return jsonError('Invalid JSON', 400)
  }

  if (!Array.isArray(body.statuses) || body.statuses.length === 0) {
    return jsonError('Missing statuses payload', 400)
  }

  const updates = new Map<string, boolean>()

  for (const entry of body.statuses) {
    const status = typeof entry?.status === 'string' ? entry.status.trim() : ''
    if (!status) {
      return jsonError('Invalid status entry', 400)
    }
    if (typeof entry.enabled !== 'boolean') {
      return jsonError(`Missing enabled flag for ${status}`, 400)
    }
    updates.set(status, entry.enabled)
  }

  const statusList = Array.from(updates.keys())

  const existing = await prisma.statusFilter.findMany({
    where: { status: { in: statusList } },
    select: { status: true, enabled: true },
  })

  if (existing.length !== statusList.length) {
    const existingSet = new Set(existing.map((item) => item.status))
    const missing = statusList.filter((status) => !existingSet.has(status))
    return jsonError(`Unknown statuses: ${missing.join(', ')}`, 400)
  }

  const effectiveUpdates = existing
    .map((item) => {
      const nextEnabled = updates.get(item.status)
      if (typeof nextEnabled !== 'boolean' || nextEnabled === item.enabled) {
        return null
      }
      return { status: item.status, enabled: nextEnabled }
    })
    .filter((item): item is { status: string; enabled: boolean } => item !== null)

  if (effectiveUpdates.length > 0) {
    try {
      await syncStatusFiltersToKv(effectiveUpdates)
    } catch (error) {
      console.error('KV status sync failed:', error)
      return jsonError('KV Store error', 502)
    }

    try {
      await prisma.$transaction(
        effectiveUpdates.map((item) =>
          prisma.statusFilter.update({
            where: { status: item.status },
            data: { enabled: item.enabled },
          })
        )
      )
    } catch (error) {
      console.error('Status update failed:', error)
      return jsonError('Database update failed', 500)
    }
  }

  const statuses = await prisma.statusFilter.findMany({
    orderBy: [{ category: 'asc' }, { status: 'asc' }],
  })

  return NextResponse.json({ statuses })
}
