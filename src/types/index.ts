export interface User {
  id: string;
  name: string;
  walletAddress: string;
  displayName: string | null;
  createdAt: Date | string;
  orderCount?: number;
  lastOrderTime?: Date | string | null;
}

export interface OrderLog {
  id: number;
  eventId: string;
  userId: string;
  user?: User;
  oid: string;
  txHash: string | null;
  status: string;
  coin: string;
  side: 'B' | 'A';
  orderType: string;
  limitPx: string;
  sz: string;
  origSz: string;
  tif: string;
  cloid: string | null;
  isTrigger: boolean;
  triggerPx: string | null;
  reduceOnly: boolean;
  network: string;
  blockNumber: string;
  blockTime: Date | string;
  localTime: Date | string;
  builder: Record<string, unknown> | null;
  createdAt: Date | string;
}

export interface StatusFilter {
  id: number;
  status: string;
  enabled: boolean;
  category: 'success' | 'cancellation' | 'rejection';
}
