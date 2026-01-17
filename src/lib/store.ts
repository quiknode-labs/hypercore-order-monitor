import { create } from 'zustand';
import type { User, OrderLog, StatusFilter } from '@/types';

interface AppState {
  users: User[];
  orders: OrderLog[];
  statusFilters: StatusFilter[];
  isConnected: boolean;
  setUsers: (users: User[]) => void;
  setOrders: (orders: OrderLog[]) => void;
  addOrder: (order: OrderLog) => void;
  setStatusFilters: (statuses: StatusFilter[]) => void;
  setConnected: (connected: boolean) => void;
  removeUser: (id: string) => void;
  addUser: (user: User) => void;
}

export const useAppStore = create<AppState>((set) => ({
  users: [],
  orders: [],
  statusFilters: [],
  isConnected: false,
  setUsers: (users) => set({ users }),
  setOrders: (orders) => set({ orders }),
  addOrder: (order) =>
    set((state) => ({
      orders: [order, ...state.orders].slice(0, 50)
    })),
  setStatusFilters: (statusFilters) => set({ statusFilters }),
  setConnected: (isConnected) => set({ isConnected }),
  removeUser: (id) =>
    set((state) => ({
      users: state.users.filter((u) => u.id !== id)
    })),
  addUser: (user) =>
    set((state) => ({
      users: [user, ...state.users]
    })),
}));
