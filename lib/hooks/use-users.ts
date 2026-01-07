import { useQuery } from '@tanstack/react-query';
import type { ApiError } from '../api/client';
import { usersService, type UsersApiResponse, type UsersApiUser } from '../api/users';
import { useAuthStore } from '../stores/auth-store';

export interface UsersData {
  usersArray: UsersApiUser[];
  usersMap: Record<string, UsersApiUser>;
  publishableUsers: UsersApiUser[];
}

function normalizeUsersResponse(resp: UsersApiResponse): UsersApiUser[] {
  const accessible = Array.isArray(resp.accessible_users) ? resp.accessible_users : [];
  const singleUser = resp.user ? [resp.user] : [];

  // Angular pushes response.user into accessible_users (and de-dupes).
  const merged = [...accessible, ...singleUser].filter(Boolean) as UsersApiUser[];

  // De-dupe by user_id, prefer later fields (Angular merges keys into existing).
  const map: Record<string, UsersApiUser> = {};
  merged.forEach((u) => {
    if (!u.user_id) return;
    map[u.user_id] = { ...(map[u.user_id] || {}), ...u };
  });

  return Object.values(map);
}

function buildUsersData(users: UsersApiUser[]): UsersData {
  const usersMap: Record<string, UsersApiUser> = {};
  const usersArray: UsersApiUser[] = [];

  users.forEach((u) => {
    if (!u.user_id) return;
    usersMap[u.user_id] = u;
    usersArray.push(u);
  });

  const publishableInvited: UsersApiUser[] = [];
  const publishableNonInvited: UsersApiUser[] = [];

  usersArray.forEach((u) => {
    const publishable = !!u.publishable;
    if (!publishable) return;

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


