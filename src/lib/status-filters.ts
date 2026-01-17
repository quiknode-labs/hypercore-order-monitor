import {
  addToKVList,
  getHypercoreStatusesListKey,
  removeFromKVList,
} from '@/lib/quicknode'

export const DEFAULT_ENABLED_STATUSES = ['open', 'filled', 'triggered']

type StatusToggle = {
  status: string
  enabled: boolean
}

export async function syncStatusFiltersToKv(
  statuses: StatusToggle[]
): Promise<void> {
  const listKey = getHypercoreStatusesListKey()
  const results = await Promise.allSettled(
    statuses.map(async ({ status, enabled }) => {
      if (enabled) {
        await addToKVList(listKey, status)
        return
      }

      const removed = await removeFromKVList(listKey, status)
      if (!removed) {
        throw new Error(`KV removal failed for status: ${status}`)
      }
    })
  )

  const failures = results
    .map((result, index) => ({
      result,
      status: statuses[index]?.status ?? 'unknown',
    }))
    .filter(({ result }) => result.status === 'rejected')
    .map(({ status, result }) => {
      const reason = (result as PromiseRejectedResult).reason
      return `${status}: ${reason instanceof Error ? reason.message : reason}`
    })

  if (failures.length > 0) {
    throw new Error(`KV status sync failed: ${failures.join(', ')}`)
  }
}
