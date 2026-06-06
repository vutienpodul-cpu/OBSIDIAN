/**
 * Account Store — quản lý danh sách tài khoản Google/service.
 * Mỗi account có session Playwright riêng (sessions/<id>).
 */
import { create } from 'zustand';

export const useAccountStore = create((set, get) => ({
  accounts: [],
  loaded: false,

  load: async () => {
    const res = await window.obsidian.accounts.load();
    if (res.ok) set({ accounts: res.accounts, loaded: true });
  },

  add: (fields) => {
    const id = `acc_${Date.now()}`;
    const account = {
      id,
      email: '',
      password: '',
      notes: '',
      service: 'Google',
      creditStatus: 'unknown', // 'ok' | 'empty' | 'unknown'
      sessionReady: false,
      createdAt: new Date().toISOString(),
      ...fields
    };
    const accounts = [...get().accounts, account];
    set({ accounts });
    window.obsidian.accounts.save(accounts);
    return id;
  },

  update: (id, patch) => {
    const accounts = get().accounts.map(a => a.id === id ? { ...a, ...patch } : a);
    set({ accounts });
    window.obsidian.accounts.save(accounts);
  },

  remove: (id) => {
    const accounts = get().accounts.filter(a => a.id !== id);
    set({ accounts });
    window.obsidian.accounts.save(accounts);
  },

  // Check if session folder exists on disk
  refreshSessionStatus: async (id) => {
    const res = await window.obsidian.accounts.sessionExists(id);
    get().update(id, { sessionReady: res.exists });
  },

  deleteSession: async (id) => {
    await window.obsidian.accounts.deleteSession(id);
    get().update(id, { sessionReady: false, creditStatus: 'unknown' });
  },
}));
