import { NextRequest } from 'next/server'
import { orderEmitter } from '@/lib/sse'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`)
      )

      const onOrder = (data: unknown) => {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'order', data })}\n\n`
          )
        )
      }

      orderEmitter.on('order', onOrder)

      const heartbeat = setInterval(() => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`)
        )
      }, 30000)

      request.signal.addEventListener('abort', () => {
        orderEmitter.off('order', onOrder)
        clearInterval(heartbeat)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
