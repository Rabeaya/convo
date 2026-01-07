import { useQuery } from '@tanstack/react-query';
import type { ApiError } from '../api/client';
import { usersService, type UsersApiResponse, type UsersApiUser } from '../api/users';
import { useAuthStore } from '../stores/auth-store';

export interface UsersData {
  usersArray: UsersApiUser[];
  usersMap: Record<string, UsersApiUser>;
  publishableUsers: UsersApiUser[];
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
  // Angular Users service uses `user.publishable` (truthy) from the `/users` payload.
  // Some backends/serializers may emit different keys; be tolerant here.
  const anyU = u as any;
  const raw = anyU.publishable ?? anyU.isPublishable ?? anyU.is_publishable;
  if (raw === undefined) {
    // If the flag is missing entirely, fall back to including the user; otherwise the UX becomes "groups only".
    return true;
  }
  return normalizeTruthy(raw);
}

function coerceUserId(u: any): UsersApiUser | null {
  if (!u || typeof u !== 'object') return null;
  // Keep all possible ids; we will index on multiple keys later.
  const user_id = u.user_id ?? u.userId ?? u.id;
  if (!user_id) return null;
  return { ...u, user_id: String(user_id) } as UsersApiUser;
}

function unwrapUsersResponse(resp: UsersApiResponse): any {
  // Be tolerant of extra wrapping layers (some APIs return { type, data }, others return { data: { ... } }).
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
  const accessibleRaw = Array.isArray(payload?.accessible_users) ? payload.accessible_users : [];
  const singleUserRaw = payload?.user ? [payload.user] : [];

  // Angular pushes response.user into accessible_users (and de-dupes).
  const mergedRaw = [...accessibleRaw, ...singleUserRaw];
  const merged = mergedRaw.map(coerceUserId).filter(Boolean) as UsersApiUser[];

  // De-dupe by user_id, prefer later fields (Angular merges keys into existing).
  const map: Record<string, UsersApiUser> = {};
  merged.forEach((u) => {
    map[u.user_id] = { ...(map[u.user_id] || {}), ...u };
  });

  return Object.values(map);
}

function buildUsersData(users: UsersApiUser[]): UsersData {
  const usersMap: Record<string, UsersApiUser> = {};
  const usersArray: UsersApiUser[] = [];

  users.forEach((u) => {
    const anyU = u as any;
    const keys = uniqueStrings([
      u.user_id,
      anyU.userId,
      anyU.id,
    ]);

    // Also index common prefixed Convo ids so settings like `usr-...` resolve after refresh.
    const expandedKeys = uniqueStrings(keys.flatMap((k) => idVariants(k, 'usr-')));

    for (const k of expandedKeys) {
      usersMap[k] = u;
    }
    usersArray.push(u);
  });

  const publishableInvited: UsersApiUser[] = [];
  const publishableNonInvited: UsersApiUser[] = [];

  usersArray.forEach((u) => {
    if (!isUserPublishable(u)) return;

    if (u.status === 'INVITED') publishableInvited.push(u);
    else publishableNonInvited.push(u);
  });

  // Angular appends invited users at end.
  const publishableUsers = [...publishableNonInvited, ...publishableInvited];

  return { usersArray, usersMap, publishableUsers };
}

export function useUsers(enabled: boolean = true) {
  const { loginData, user, account } = useAuthStore();

  return useQuery<UsersData, ApiError>({
    queryKey: ['users'],
    queryFn: async () => {
      if (!loginData || !user || !account) {
        throw new Error('Not authenticated');
      }

      const response = await usersService.getUsers();
      const normalized = normalizeUsersResponse(response.data);
      return buildUsersData(normalized);
    },
    enabled: enabled && !!loginData && !!user && !!account,
    staleTime: 5 * 60 * 1000,
  });
}


