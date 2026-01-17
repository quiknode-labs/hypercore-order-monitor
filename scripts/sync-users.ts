import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const QN_KV_API_BASE = 'https://api.quicknode.com/kv/rest/v1';
const LIST_KEY = 'userstream_hl_users';

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}`);
    process.exit(1);
  }
  return value;
}

async function readResponseBody(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractKVItems(body: unknown): string[] {
  const items =
    Array.isArray((body as { items?: unknown })?.items)
      ? (body as { items: unknown[] }).items
      : Array.isArray((body as { data?: { items?: unknown[] } })?.data?.items)
        ? (body as { data: { items: unknown[] } }).data.items
        : [];

  return items.filter((item): item is string => typeof item === 'string');
}

async function getKVItems(apiKey: string): Promise<string[]> {
  const response = await fetch(
    `${QN_KV_API_BASE}/lists/${encodeURIComponent(LIST_KEY)}`,
    {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-api-key': apiKey,
      },
    }
  );

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    const errorBody = await readResponseBody(response);
    throw new Error(
      `Failed to read KV list ${LIST_KEY} (${response.status}): ${JSON.stringify(
        errorBody
      )}`
    );
  }

  const body = await readResponseBody(response);
  return extractKVItems(body);
}

async function createKVList(apiKey: string, items: string[]) {
  const response = await fetch(`${QN_KV_API_BASE}/lists`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({ key: LIST_KEY, items }),
  });

  if (response.ok || response.status === 409) {
    return;
  }

  const errorBody = await readResponseBody(response);
  throw new Error(
    `Failed to create KV list ${LIST_KEY} (${response.status}): ${JSON.stringify(
      errorBody
    )}`
  );
}

async function addKVItem(apiKey: string, item: string) {
  const response = await fetch(
    `${QN_KV_API_BASE}/lists/${encodeURIComponent(LIST_KEY)}/items`,
    {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ item }),
    }
  );

  if (!response.ok) {
    const errorBody = await readResponseBody(response);
    throw new Error(
      `Failed to add KV item ${item} (${response.status}): ${JSON.stringify(
        errorBody
      )}`
    );
  }
}

async function removeKVItem(apiKey: string, item: string) {
  const response = await fetch(
    `${QN_KV_API_BASE}/lists/${encodeURIComponent(LIST_KEY)}/items/${encodeURIComponent(
      item
    )}`,
    {
      method: 'DELETE',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-api-key': apiKey,
      },
    }
  );

  if (!response.ok && response.status !== 404) {
    const errorBody = await readResponseBody(response);
    throw new Error(
      `Failed to remove KV item ${item} (${response.status}): ${JSON.stringify(
        errorBody
      )}`
    );
  }
}

async function main() {
  const apiKey = requireEnv('QN_API_KEY');
  const prisma = new PrismaClient();

  try {
    const users = await prisma.user.findMany({
      select: { walletAddress: true },
    });

    const addresses = Array.from(
      new Set(users.map((user) => user.walletAddress.toLowerCase()))
    );

    await createKVList(apiKey, addresses);

    const kvItems = await getKVItems(apiKey);
    const kvSet = new Set(kvItems);
    const addressSet = new Set(addresses);

    const toAdd = addresses.filter((address) => !kvSet.has(address));
    const toRemove = kvItems.filter((address) => !addressSet.has(address));

    for (const address of toAdd) {
      await addKVItem(apiKey, address);
    }

    for (const address of toRemove) {
      await removeKVItem(apiKey, address);
    }

    console.log('User sync complete.');
    console.log(`DB users: ${addresses.length}`);
    console.log(`KV list size: ${kvItems.length}`);
    console.log(`Added: ${toAdd.join(', ') || 'none'}`);
    console.log(`Removed: ${toRemove.join(', ') || 'none'}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('User sync failed:', error);
  process.exit(1);
});
