import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

const QN_STREAMS_API_BASE = 'https://api.quicknode.com/streams/rest/v1';
const QN_KV_API_BASE = 'https://api.quicknode.com/kv/rest/v1';
const STORE_PATH = path.resolve(process.cwd(), '.quicknode', 'streams.json');

type Args = Record<string, string>;

type SetupOptions = {
  name: string;
  network: string;
  dataset: string;
  datasetBatchSize: number;
  includeStreamMetadata: string;
  status: string;
  elasticBatchEnabled: boolean;
  destinationCompression: string;
  destinationHeaders: Record<string, string>;
  destinationMaxRetry: number;
  destinationRetryIntervalSec: number;
  destinationPostTimeoutSec: number;
  filterPath: string;
  testBlockNumber: number;
  region: string;
};

type CreateStreamResponse = {
  id: string;
  destination_attributes: {
    security_token: string;
  };
};

function normalizeKey(key: string) {
  return key.replace(/^--?/, '').toLowerCase().replace(/-/g, '_');
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (const raw of argv) {
    if (!raw) continue;
    if (raw === '--help' || raw === '-h' || raw === 'help') {
      args.help = 'true';
      continue;
    }
    const eqIndex = raw.indexOf('=');
    if (eqIndex === -1) {
      args[normalizeKey(raw)] = 'true';
      continue;
    }
    const key = normalizeKey(raw.slice(0, eqIndex));
    const value = raw.slice(eqIndex + 1);
    args[key] = value;
  }
  return args;
}

function parseNumber(value: string | undefined, fallback: number, label: string) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return parsed;
}

function parseBoolean(
  value: string | undefined,
  fallback: boolean
): boolean {
  if (value === undefined) return fallback;
  const normalized = value.toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  throw new Error(`Invalid boolean value: ${value}`);
}

function parseHeaders(value: string | undefined) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as Record<string, string>;
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Headers must be a JSON object');
    }
    return parsed;
  } catch (error) {
    throw new Error(
      `Invalid destination_headers JSON: ${(error as Error).message}`
    );
  }
}

function printUsage() {
  console.log(`Usage:
  pnpm run setup:streams [key=value ...]

Common options:
  chain=hypercore-mainnet
  network=hypercore-mainnet (alias for chain)
  name="HyperCore Order Monitor"
  dataset=block
  dataset_batch_size=1
  include_stream_metadata=body
  elastic_batch_enabled=true
  status=paused
  filter_path=filters/hl-orders-filter.js
  test_block_number=863540703
  region=usa_east

Webhook destination options:
  destination_compression=none
  destination_headers='{"Content-Type":"application/json"}'
  destination_max_retry=3
  destination_retry_interval_sec=1
  destination_post_timeout_sec=10

Environment:
  QN_API_KEY=...
  APP_URL=https://your-app.com (or app_url=...)
`);
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

async function postJson<T>(
  url: string,
  apiKey: string,
  body: Record<string, unknown>
): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await readResponseBody(response);
    throw new Error(
      `Quicknode request failed (${response.status}): ${JSON.stringify(
        errorBody
      )}`
    );
  }

  return (await response.json()) as T;
}

async function addKVListItem(listKey: string, apiKey: string, item: string) {
  const response = await fetch(
    `${QN_KV_API_BASE}/lists/${encodeURIComponent(listKey)}/items`,
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
      `Failed to add item to KV list ${listKey} (${response.status}): ${JSON.stringify(
        errorBody
      )}`
    );
  }
}

async function ensureKVList(
  listKey: string,
  apiKey: string,
  initialItems: string[] = []
) {
  console.log(`Ensuring KV list: ${listKey}...`);
  const lookup = await fetch(
    `${QN_KV_API_BASE}/lists/${encodeURIComponent(listKey)}`,
    {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-api-key': apiKey,
      },
    }
  );

  if (lookup.ok) {
    const body = await readResponseBody(lookup);
    const items = extractKVItems(body);
    const countLabel = items.length ? ` (items: ${items.length})` : '';
    console.log(`KV list exists: ${listKey}${countLabel}`);

    if (initialItems.length > 0) {
      const existing = new Set(items);
      const missing = initialItems.filter((item) => !existing.has(item));
      if (missing.length > 0) {
        console.log(
          `Seeding ${missing.length} missing items into ${listKey}: ${missing.join(
            ', '
          )}`
        );
        for (const item of missing) {
          await addKVListItem(listKey, apiKey, item);
        }
      } else {
        console.log(`No missing items to seed for ${listKey}.`);
      }
    }

    return;
  }

  if (lookup.status !== 404) {
    const errorBody = await readResponseBody(lookup);
    throw new Error(
      `Failed to read KV list ${listKey} (${lookup.status}): ${JSON.stringify(
        errorBody
      )}`
    );
  }

  const response = await fetch(`${QN_KV_API_BASE}/lists`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({ key: listKey, items: initialItems }),
  });

  if (response.ok) {
    const seededLabel = initialItems.length
      ? ` (seeded: ${initialItems.join(', ')})`
      : '';
    console.log(`KV list created: ${listKey}${seededLabel}`);
    return;
  }

  if (response.status === 409) {
    console.log(`KV list already exists: ${listKey}`);
    return;
  }

  const errorBody = await readResponseBody(response);
  throw new Error(
    `Failed to create KV list ${listKey} (${response.status}): ${JSON.stringify(
      errorBody
    )}`
  );
}

async function testFilter(
  apiKey: string,
  payload: Record<string, unknown>
) {
  return postJson<Record<string, unknown>>(
    `${QN_STREAMS_API_BASE}/streams/test_filter`,
    apiKey,
    payload
  );
}

async function createStream(apiKey: string, payload: Record<string, unknown>) {
  return postJson<CreateStreamResponse>(
    `${QN_STREAMS_API_BASE}/streams`,
    apiKey,
    payload
  );
}

function saveStreamState(stream: CreateStreamResponse, options: SetupOptions) {
  const dir = path.dirname(STORE_PATH);
  fs.mkdirSync(dir, { recursive: true });

  let existing: Record<string, unknown> = {};
  if (fs.existsSync(STORE_PATH)) {
    try {
      existing = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
    } catch {
      existing = {};
    }
  }

  const chainKey = options.network;
  const byChain = (existing as { by_chain?: Record<string, unknown> }).by_chain ?? {};
  const timestamp = new Date().toISOString();

  const updated = {
    ...existing,
    last_created: {
      id: stream.id,
      name: options.name,
      network: options.network,
      dataset: options.dataset,
      created_at: timestamp,
    },
    by_chain: {
      ...byChain,
      [chainKey]: {
        id: stream.id,
        name: options.name,
        network: options.network,
        dataset: options.dataset,
        created_at: timestamp,
      },
    },
  };

  fs.writeFileSync(STORE_PATH, JSON.stringify(updated, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }

  const apiKey = process.env.QN_API_KEY;
  const appUrl = args.app_url ?? process.env.APP_URL;

  if (!apiKey || !appUrl) {
    console.error('Missing QN_API_KEY or APP_URL');
    process.exit(1);
  }

  const requestedNetwork = args.chain ?? args.network;
  const network = requestedNetwork ?? 'hypercore-mainnet';

  const options: SetupOptions = {
    name: args.name ?? 'HyperCore Order Monitor',
    network,
    dataset: args.dataset ?? 'orders',
    datasetBatchSize: parseNumber(
      args.dataset_batch_size,
      1,
      'dataset_batch_size'
    ),
    includeStreamMetadata: args.include_stream_metadata ?? 'body',
    status: args.status ?? 'paused',
    elasticBatchEnabled: parseBoolean(args.elastic_batch_enabled, true),
    destinationCompression: args.destination_compression ?? 'none',
    destinationHeaders: parseHeaders(args.destination_headers),
    destinationMaxRetry: parseNumber(
      args.destination_max_retry,
      3,
      'destination_max_retry'
    ),
    destinationRetryIntervalSec: parseNumber(
      args.destination_retry_interval_sec,
      1,
      'destination_retry_interval_sec'
    ),
    destinationPostTimeoutSec: parseNumber(
      args.destination_post_timeout_sec,
      10,
      'destination_post_timeout_sec'
    ),
    filterPath:
      args.filter_path ?? 'filters/hl-orders-filter.js',
    testBlockNumber: parseNumber(
      args.test_block_number,
      863540703,
      'test_block_number'
    ),
    region: args.region ?? 'usa_east',
  };

  const filterPath = path.resolve(process.cwd(), options.filterPath);
  if (!fs.existsSync(filterPath)) {
    console.error(`Filter file not found: ${filterPath}`);
    process.exit(1);
  }

  const filterCode = fs.readFileSync(filterPath, 'utf-8');
  const filterBase64 = Buffer.from(filterCode, 'utf-8').toString('base64');

  console.log('Creating HyperCore KV lists...');
  await ensureKVList('userstream_hl_users', apiKey, [
    '0xd48374090fe4df231f7002d592b6c67c4c875b1a',
  ]);
  await ensureKVList('userstream_hl_statuses', apiKey, [
    'open',
    'filled',
    'triggered',
  ]);

  console.log('Testing filter...');
  const testResult = await testFilter(apiKey, {
    network: options.network,
    dataset: options.dataset,
    filter_function: filterBase64,
    block: options.testBlockNumber.toString(),
  });
  console.log('Filter test response:', JSON.stringify(testResult));

  console.log('Creating stream...');
  const stream = await createStream(apiKey, {
    name: options.name,
    network: options.network,
    dataset: options.dataset,
    dataset_batch_size: options.datasetBatchSize,
    include_stream_metadata: options.includeStreamMetadata,
    status: options.status,
    region: options.region,
    elastic_batch_enabled: options.elasticBatchEnabled,
    filter_function: filterBase64,
    destination: 'webhook',
    destination_attributes: {
      url: `${appUrl.replace(/\/$/, '')}/api/webhook/streams`,
      compression: options.destinationCompression,
      headers: options.destinationHeaders,
      max_retry: options.destinationMaxRetry,
      retry_interval_sec: options.destinationRetryIntervalSec,
      post_timeout_sec: options.destinationPostTimeoutSec,
    },
  });

  saveStreamState(stream, options);

  console.log('Stream created!');
  console.log('Stream ID:', stream.id);
  console.log('Security Token:', stream.destination_attributes.security_token);
  console.log('Stream related details are stored in ./.quicknode/streams.json')
  console.log('\nAdd this to your .env:');
  console.log(`QN_STREAM_SECURITY_TOKEN="${stream.destination_attributes.security_token}"`);
  console.log('\nWhen ready, activate the stream:');
  console.log('pnpm run activate:streams');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
