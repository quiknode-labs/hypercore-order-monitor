import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const statusFilters = [
  { status: 'open', category: 'success', enabled: true },
  { status: 'filled', category: 'success', enabled: true },
  { status: 'triggered', category: 'success', enabled: true },
  { status: 'canceled', category: 'cancellation', enabled: false },
  { status: 'marginCanceled', category: 'cancellation', enabled: false },
  { status: 'openInterestCapCanceled', category: 'cancellation', enabled: false },
  { status: 'reduceOnlyCanceled', category: 'cancellation', enabled: false },
  { status: 'scheduledCancel', category: 'cancellation', enabled: false },
  { status: 'selfTradeCanceled', category: 'cancellation', enabled: false },
  { status: 'siblingFilledCanceled', category: 'cancellation', enabled: false },
  { status: 'badAloPxRejected', category: 'rejection', enabled: false },
  { status: 'iocCancelRejected', category: 'rejection', enabled: false },
  { status: 'insufficientSpotBalanceRejected', category: 'rejection', enabled: false },
  { status: 'minTradeNtlRejected', category: 'rejection', enabled: false },
  { status: 'oracleRejected', category: 'rejection', enabled: false },
  { status: 'perpMarginRejected', category: 'rejection', enabled: false },
  { status: 'perpMaxPositionRejected', category: 'rejection', enabled: false },
  { status: 'positionFlipAtOpenInterestCapRejected', category: 'rejection', enabled: false },
  { status: 'positionIncreaseAtOpenInterestCapRejected', category: 'rejection', enabled: false },
  { status: 'reduceOnlyRejected', category: 'rejection', enabled: false },
  { status: 'tooAggressiveAtOpenInterestCapRejected', category: 'rejection', enabled: false },
]

const seedTrader = {
  name: 'Whale Trader',
  walletAddress: '0xd48374090fe4df231f7002d592b6c67c4c875b1a',
}

async function main() {
  for (const statusFilter of statusFilters) {
    await prisma.statusFilter.upsert({
      where: { status: statusFilter.status },
      update: {
        category: statusFilter.category,
        enabled: statusFilter.enabled,
      },
      create: statusFilter,
    })
  }

  await prisma.user.upsert({
    where: { walletAddress: seedTrader.walletAddress },
    update: { name: seedTrader.name },
    create: {
      name: seedTrader.name,
      walletAddress: seedTrader.walletAddress,
    },
  })
}

main()
  .catch((error) => {
    console.error('Failed to seed status filters:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
