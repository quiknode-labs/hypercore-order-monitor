import { NextRequest, NextResponse } from 'next/server'
import { processStreamPayload } from '@/lib/webhook-processor'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Disabled in production' }, { status: 403 })
  }

  const payload = await request.json()
  const result = await processStreamPayload(payload)

  return NextResponse.json({
    success: true,
    processed: result.processed,
    skipped: result.skipped,
  })
}
