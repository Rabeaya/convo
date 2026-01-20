/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useQuery } from '@tanstack/react-query';
import type { ApiError } from '@/lib/api/client';
import { usersService, type UsersApiResponse, type UsersApiUser } from '@/lib/api/users';
import { useAuthStore } from '@/lib/stores/auth-store';

export interface UsersData {
  users: Record<string, UsersApiUser>;
  usersArray: UsersApiUser[];
  usersMap: Record<string, UsersApiUser>;
  publishableUsers: UsersApiUser[];
}

export interface UserListItem {
  id: string;
  type: 'USER' | 'GROUP';
  label: string;
  formattedlabel?: string;
  desclabel?: string;
  formatteddesclabel?: string;
  email?: string;
  access?: string;
  rank?: number;
  invited?: boolean;
  classes?: string;
  grouptype?: string;
}

export function getUserFullName(u: any): string {
  if (!u) return '';
  if (u.name) return String(u.name);
  const first = u.first_name || u.firstName || '';
  const last = u.last_name || u.lastName || '';
  const full = `${first} ${last}`.trim();
  return full || String(u.user_id || u.userId || '');
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function highlightHtml(label: string, query: string): string {
  const safeLabel = escapeHtml(label);
  const q = query.trim();
  if (!q) return safeLabel;
  const idx = label.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return safeLabel;
  const before = escapeHtml(label.slice(0, idx));
  const match = escapeHtml(label.slice(idx, idx + q.length));
  const after = escapeHtml(label.slice(idx + q.length));
  return `${before}<b>${match}</b>${after}`;
}

function createUserListItem(user: any): UserListItem | null {
  const id = String(user?.user_id || user?.userId || user?.id || '');
  if (!id) return null;
  const label = getUserFullName(user) || (user?.email ? String(user.email) : id);
  const email = user?.email ? String(user.email) : '';
  return { id, type: 'USER', label, desclabel: email, email };
}

function createGroupListItem(group: any): UserListItem | null {
  const id = String(group?.id || '');
  if (!id) return null;
  const label = String(group?.title || group?.name || id);
  const access = String(group?.access || 'PUBLIC');
  return {
    id,
    type: 'GROUP',
    label,
    desclabel: 'Group',
    access,
    rank: typeof group?.rank === 'number' ? group.rank : undefined,
    grouptype: group?.grouptype,
    classes: group?.classes,
  };
}

export function queryPublishableUsersAndGroups(
  usersArray: any[],
  groupsArray: any[],
  query: string,
  maxResults: number = 10,
  currentUserId?: string
): UserListItem[] {
  const q = (query || '').trim();
  if (!q) return [];

  const qLower = q.toLowerCase();

  const users: UserListItem[] = (usersArray || [])
    .map(createUserListItem)
    .filter((x): x is UserListItem => !!x)
    .filter((u) => !currentUserId || u.id !== String(currentUserId))
    .filter((u) => {
      const label = (u.label || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return label.includes(qLower) || email.includes(qLower);
    })
    .map((u) => ({
      ...u,
      formattedlabel: highlightHtml(u.label || '', q),
      formatteddesclabel: u.desclabel ? highlightHtml(u.desclabel, q) : u.desclabel,
    }));

  const groups: UserListItem[] = (groupsArray || [])
    .map(createGroupListItem)
    .filter((x): x is UserListItem => !!x)
    .filter((g) => (g.label || '').toLowerCase().includes(qLower))
    .sort((a, b) => {
      const ar = a.rank ?? -Infinity;
      const br = b.rank ?? -Infinity;
      if (ar !== br) return br - ar;
      return (a.label || '').localeCompare(b.label || '');
    })
    .map((g) => ({
      ...g,
      formattedlabel: highlightHtml(g.label || '', q),
      formatteddesclabel: g.desclabel ? highlightHtml(g.desclabel, q) : g.desclabel,
    }));

  return [...users, ...groups].slice(0, maxResults);
}

function uniqueStrings(arr: Array<string | undefined | null>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of arr) {
    const s = (v ?? '').toString().trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function idVariants(id: string, prefix: string): string[] {
  const raw = String(id || '').trim();
  if (!raw) return [];
  const stripped = raw.startsWith(prefix) ? raw.slice(prefix.length) : raw;
  const prefixed = raw.startsWith(prefix) ? raw : `${prefix}${raw}`;
  return uniqueStrings([raw, stripped, prefixed]);
}

function normalizeTruthy(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val === 1;
  if (typeof val === 'string') return val === '1' || val.toLowerCase() === 'true';
  return false;
}

function isUserPublishable(u: UsersApiUser): boolean {
  const anyU = u as any;
  const raw = anyU.publishable ?? anyU.isPublishable ?? anyU.is_publishable;
  if (raw === undefined) return true;
  return normalizeTruthy(raw);
}

function coerceUserId(u: any): UsersApiUser | null {
  if (!u || typeof u !== 'object') return null;
  const user_id = u.user_id ?? u.userId ?? u.id;
  if (!user_id) return null;
  return { ...u, user_id: String(user_id) } as UsersApiUser;
}

function unwrapUsersResponse(resp: UsersApiResponse): any {
  let cur: any = resp;
  for (let i = 0; i < 3; i++) {
    if (!cur || typeof cur !== 'object') break;
    if (Array.isArray(cur.accessible_users) || cur.user) return cur;
    if (cur.data && typeof cur.data === 'object') {
      cur = cur.data;
      continue;
    }
    break;
  }
  return cur;
}

function normalizeUsersResponse(resp: UsersApiResponse): UsersApiUser[] {
  const payload = unwrapUsersResponse(resp);
  const accessibleRaw = Array.isArray(payload?.accessible_users)
    ? payload.accessible_users
    : payload?.accessible_users && typeof payload.accessible_users === 'object'
      ? Object.values(payload.accessible_users)
      : [];
  const singleUserRaw = payload?.user ? [payload.user] : [];

  const mergedRaw = [...accessibleRaw, ...singleUserRaw];
  const merged = mergedRaw.map(coerceUserId).filter(Boolean) as UsersApiUser[];

  const map: Record<string, UsersApiUser> = {};
  merged.forEach((u) => {
    map[u.user_id] = { ...(map[u.user_id] || {}), ...u };
  });
  return Object.values(map);
}

function buildUsersData(users: UsersApiUser[]): UsersData {
  const usersMap: Record<string, UsersApiUser> = {};
  const usersRecord: Record<string, UsersApiUser> = {};
  const usersArray: UsersApiUser[] = [];

  users.forEach((u) => {
    const anyU = u as any;
    const keys = uniqueStrings([u.user_id, anyU.userId, anyU.id]);
    const expandedKeys = uniqueStrings(keys.flatMap((k) => idVariants(k, 'usr-')));
    for (const k of expandedKeys) usersMap[k] = u;
    usersRecord[u.user_id] = u;
    usersArray.push(u);
  });

  const publishableInvited: UsersApiUser[] = [];
  const publishableNonInvited: UsersApiUser[] = [];
  usersArray.forEach((u) => {
    if (!isUserPublishable(u)) return;
    if (u.status === 'INVITED') publishableInvited.push(u);
    else publishableNonInvited.push(u);
  });

  return {
    users: usersRecord,
    usersArray,
    usersMap,
    publishableUsers: [...publishableNonInvited, ...publishableInvited],
  };
}

export function useUsers(enabled: boolean = true) {
  const { loginData, user, account } = useAuthStore();

  return useQuery<UsersData, ApiError>({
    queryKey: ['users'],
    enabled: enabled && !!loginData && !!user && !!account,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const rawUsers = await usersService.getAllUsers();
      const normalized = rawUsers.map(coerceUserId).filter(Boolean) as UsersApiUser[];
      return buildUsersData(normalized);
    },
  });
}
