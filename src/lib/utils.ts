import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { isAddress } from 'viem'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function detectChainType(address: string): 'EVM' | 'SOL' | null {
  // EVM: Use viem's isAddress for robust validation
  if (isAddress(address)) {
    return 'EVM';
  }
  // Solana: Base58, 32-44 chars, no 0/O/I/l
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return 'SOL';
  }
  return null;
}

export function isValidHypercoreAddress(address: string): boolean {
  return isAddress(address.toLowerCase());
}

export function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

export function truncateAddress(address: string, chars = 4): string {
  const prefix = address.startsWith('0x') ? 2 : 0;
  return `${address.slice(0, chars + prefix)}...${address.slice(-chars)}`;
}

export function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

export function formatRelativeTime(date: Date): string {
  const diffMs = date.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  if (absMs < 60_000) {
    const seconds = Math.round(diffMs / 1000);
    return rtf.format(seconds, 'second');
  }

  if (absMs < 3_600_000) {
    const minutes = Math.round(diffMs / 60_000);
    return rtf.format(minutes, 'minute');
  }

  if (absMs < 86_400_000) {
    const hours = Math.round(diffMs / 3_600_000);
    return rtf.format(hours, 'hour');
  }

  const days = Math.round(diffMs / 86_400_000);
  return rtf.format(days, 'day');
}

export function getExplorerTxUrl(chain: string, txHash: string): string {
  if (chain.startsWith('solana')) {
    return `https://solscan.io/tx/${txHash}`;
  }
  return `https://etherscan.io/tx/${txHash}`;
}

export function getExplorerBlockUrl(chain: string, blockRef: string | number): string {
  if (chain.startsWith('solana')) {
    return `https://solscan.io/block/${blockRef}`;
  }
  return `https://etherscan.io/block/${blockRef}`;
}

// Parse bulk addresses (comma, newline, or space separated)
export function parseBulkAddresses(input: string): string[] {
  return input
    .split(/[,\n\s]+/)
    .map(addr => addr.trim())
    .filter(addr => addr.length > 0);
}
