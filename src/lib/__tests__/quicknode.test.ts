import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  addToKVList,
  removeFromKVList,
  checkKVListContains,
  createKVList,
  getHypercoreStatusesListKey,
  getHypercoreUsersListKey,
  HYPERCORE_STATUSES_LIST_KEY,
} from '../quicknode'

describe('quicknode kv store helpers', () => {
  const originalEnv = process.env.QN_API_KEY
  const fetchMock = vi.fn()

  beforeEach(() => {
    process.env.QN_API_KEY = 'test-api-key'
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.QN_API_KEY
    } else {
      process.env.QN_API_KEY = originalEnv
    }
    vi.unstubAllGlobals()
  })

  it('adds item to list with normalized address', async () => {
    fetchMock.mockResolvedValue({ ok: true })

    await addToKVList('my-list', '0xAbC')

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toContain('/lists/my-list/items')
    expect(options?.method).toBe('POST')
    expect(options?.headers?.['x-api-key']).toBe('test-api-key')
    const body = JSON.parse(options?.body as string)
    expect(body.item).toBe('0xabc')
  })

  it('preserves status casing for HyperCore status list', async () => {
    fetchMock.mockResolvedValue({ ok: true })

    await addToKVList(HYPERCORE_STATUSES_LIST_KEY, 'Open')

    const [, options] = fetchMock.mock.calls[0]
    const body = JSON.parse(options?.body as string)
    expect(body.item).toBe('Open')
  })

  it('throws when addToKVList returns non-ok response', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 })

    await expect(addToKVList('my-list', '0xAbC')).rejects.toThrow(
      'KV Store error: 500'
    )
  })

  it('throws when API key is missing', async () => {
    delete process.env.QN_API_KEY

    await expect(addToKVList('list', '0xabc')).rejects.toThrow(
      'Missing QN_API_KEY'
    )
  })

  it('removes item from list using lowercase', async () => {
    fetchMock.mockResolvedValue({ ok: true })

    const result = await removeFromKVList('my-list', '0xAbC')

    expect(result).toBe(true)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toContain('/lists/my-list/items/0xabc')
    expect(options?.method).toBe('DELETE')
  })

  it('removes status items without lowercasing', async () => {
    fetchMock.mockResolvedValue({ ok: true })

    const result = await removeFromKVList(
      HYPERCORE_STATUSES_LIST_KEY,
      'Open'
    )

    expect(result).toBe(true)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toContain('/lists/userstream_hl_statuses/items/Open')
    expect(options?.method).toBe('DELETE')
  })

  it('checks list contains and returns true when exists', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ exists: true }),
    })

    const result = await checkKVListContains('my-list', '0xAbC')

    expect(result).toBe(true)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toContain('/lists/my-list/contains/0xabc')
    expect(options?.method).toBe('GET')
  })

  it('returns false when list contains response is not ok', async () => {
    fetchMock.mockResolvedValue({ ok: false })

    const result = await checkKVListContains('my-list', '0xAbC')

    expect(result).toBe(false)
  })

  it('returns false when list contains response has no exists field', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })

    const result = await checkKVListContains('my-list', '0xAbC')

    expect(result).toBe(false)
  })

  it('creates list with normalized initial items', async () => {
    fetchMock.mockResolvedValue({ ok: true })

    const result = await createKVList('my-list', ['0xAbC', '0xDef'])

    expect(result).toBe(true)
    const [, options] = fetchMock.mock.calls[0]
    const body = JSON.parse(options?.body as string)
    expect(body.items).toEqual(['0xabc', '0xdef'])
  })

  it('returns false when createKVList response is not ok', async () => {
    fetchMock.mockResolvedValue({ ok: false })

    const result = await createKVList('my-list', ['0xAbC'])

    expect(result).toBe(false)
  })

  it('returns HyperCore kv list keys', () => {
    expect(getHypercoreUsersListKey()).toBe('userstream_hl_users')
    expect(getHypercoreStatusesListKey()).toBe('userstream_hl_statuses')
  })
})
