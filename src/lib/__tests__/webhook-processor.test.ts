import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    orderLog: {
      upsert: vi.fn(),
    },
  },
  emitter: {
    emit: vi.fn(),
  },
}))

vi.mock('../prisma', () => ({
  prisma: mocks.prisma,
}))

vi.mock('../sse', () => ({
  orderEmitter: mocks.emitter,
}))

import { processStreamPayload } from '../webhook-processor'

describe('processStreamPayload', () => {
  beforeEach(() => {
    mocks.prisma.user.findUnique.mockReset()
    mocks.prisma.orderLog.upsert.mockReset()
    mocks.emitter.emit.mockReset()
  })

  it('processes order events and upserts order logs', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      walletAddress: '0x258a4b8a8447c61aabf1bef9bb14ee4d69efff03',
    })
    mocks.prisma.orderLog.upsert.mockResolvedValue({
      id: 1,
      eventId: '862932944:295452566198',
      userId: 'user-1',
      oid: BigInt('295452566198'),
      txHash: '0x4b4647c0f2bbd3fb4cc004336f4fd0012b005fa68dbef2cdef0ef313b1bfade5',
      status: 'open',
      coin: 'HBAR',
      side: 'B',
      orderType: 'Limit',
      limitPx: '0.11675',
      sz: '597.0',
      origSz: '597.0',
      tif: 'Alo',
      cloid: '0x019bc527f32a75c08ea7672430dc6425',
      isTrigger: false,
      triggerPx: '0.0',
      reduceOnly: true,
      network: 'hypercore-mainnet',
      blockNumber: BigInt('862932944'),
      blockTime: new Date('2026-01-16T04:54:48.716Z'),
      localTime: new Date('2026-01-16T04:54:48.965Z'),
      builder: '{"b":"0xbuilder","f":20}',
      createdAt: new Date('2026-01-16T04:54:48.716Z'),
      user: {
        id: 'user-1',
        name: 'Trader 1',
        walletAddress: '0x258a4b8a8447c61aabf1bef9bb14ee4d69efff03',
        displayName: null,
        createdAt: new Date('2026-01-16T04:54:48.716Z'),
      },
    })

    const payload = {
      events: [
        {
          eventId: '862932944:295452566198',
          eventType: 'order',
          status: 'open',
          matchedAddress: '0x258A4B8A8447C61AABF1BEF9BB14EE4D69EFFF03',
          network: 'hypercore-mainnet',
          blockNumber: 862932944,
          blockTime: '2026-01-16T04:54:48.716513415',
          localTime: '2026-01-16T04:54:48.965178473',
          txHash: '0x4b4647c0f2bbd3fb4cc004336f4fd0012b005fa68dbef2cdef0ef313b1bfade5',
          builder: { b: '0xbuilder', f: 20 },
          order: {
            oid: 295452566198,
            coin: 'HBAR',
            side: 'B',
            orderType: 'Limit',
            limitPx: '0.11675',
            sz: '597.0',
            origSz: '597.0',
            tif: 'Alo',
            cloid: '0x019bc527f32a75c08ea7672430dc6425',
            isTrigger: false,
            triggerPx: '0.0',
            reduceOnly: true,
          },
        },
      ],
    }

    const result = await processStreamPayload(payload)

    expect(result.processed).toBe(1)
    expect(mocks.prisma.user.findUnique).toHaveBeenCalledWith({
      where: { walletAddress: '0x258a4b8a8447c61aabf1bef9bb14ee4d69efff03' },
    })
    expect(mocks.prisma.orderLog.upsert).toHaveBeenCalledOnce()
    const upsertArgs = mocks.prisma.orderLog.upsert.mock.calls[0][0]
    expect(upsertArgs.where).toEqual({
      eventId_status: { eventId: '862932944:295452566198', status: 'open' },
    })
    expect(upsertArgs.create.coin).toBe('HBAR')
    expect(upsertArgs.create.oid).toBe(BigInt('295452566198'))
    expect(upsertArgs.create.blockNumber).toBe(BigInt('862932944'))
    expect(upsertArgs.create.blockTime).toBeInstanceOf(Date)
    expect(upsertArgs.create.localTime).toBeInstanceOf(Date)
    expect(upsertArgs.create.builder).toContain('"b":"0xbuilder"')
    const emitted = mocks.emitter.emit.mock.calls[0][1]
    expect(mocks.emitter.emit).toHaveBeenCalledWith('order', emitted)
    expect(emitted.oid).toBe('295452566198')
    expect(emitted.blockNumber).toBe('862932944')
    expect(emitted.builder).toEqual({ b: '0xbuilder', f: 20 })
  })

  it('skips events when user is not found', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(null)

    const payload = {
      events: [
        {
          eventId: '862932944:295452566826',
          eventType: 'order',
          status: 'open',
          matchedAddress: '0x72358ece04efcf447dbed03968809160635a5843',
          blockNumber: 862932944,
          blockTime: '2026-01-16T04:54:48.716513415',
          localTime: '2026-01-16T04:54:48.965178473',
          order: {
            oid: 295452566826,
            coin: 'XRP',
            side: 'B',
            orderType: 'Limit',
            limitPx: '2.0576',
            sz: '40.0',
            origSz: '40.0',
            tif: 'Gtc',
          },
        },
      ],
    }

    const result = await processStreamPayload(payload)

    expect(result.processed).toBe(0)
    expect(result.skipped).toBe(1)
    expect(mocks.prisma.orderLog.upsert).not.toHaveBeenCalled()
  })

  it('skips invalid events', async () => {
    const payload = {
      events: [
        { eventType: 'transfer' },
        { eventType: 'order', matchedAddress: 'not-an-address' },
      ],
    }

    const result = await processStreamPayload(payload)

    expect(result.processed).toBe(0)
    expect(result.skipped).toBe(2)
  })
})
