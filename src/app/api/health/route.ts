import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getLastOrderTime } from '@/lib/sse'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  let dbStatus = false

  try {
    await prisma.$queryRaw`SELECT 1`
    dbStatus = true
  } catch {
    dbStatus = false
  }

  const lastOrder = getLastOrderTime()

  return NextResponse.json({
    status: dbStatus ? 'ok' : 'degraded',
    db: dbStatus,
    lastWebhook: lastOrder ? lastOrder.toISOString() : null,
    timestamp: new Date().toISOString(),
  })
}
