'use client';

import { useQuery } from '@tanstack/react-query';
import type { User } from '@/lib/api/auth';
import type { Group } from '@/lib/api/groups';
import type { ApiError } from '@/lib/api/client';
import { usersService } from '@/lib/api/users';
import { useAuthStore } from '@/lib/stores/auth-store';

export type UsersQueryData = {
  users: Record<string, User>;
  usersArray: User[];
};

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
  const id = String(user?.user_id || user?.userId || '');
  if (!id) return null;
  const label = getUserFullName(user) || (user?.email ? String(user.email) : id);
  const email = user?.email ? String(user.email) : '';
  return {
    id,
    type: 'USER',
    label,
    desclabel: email,
    email,
  };
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

/**
 * Angular parity: atMentionsListProvider.queryPublishableUsersAndGroups()
 * - Users first, then groups
 * - Returns [] if query is empty
 * - Adds <b> highlighting markup in formattedlabel/formatteddesclabel
 */
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

  // Angular ordering: users first, then groups
  return [...users, ...groups].slice(0, maxResults);
}

export function useUsers(enabled: boolean = true) {
  const { loginData, user, account } = useAuthStore();

  return useQuery<UsersQueryData, ApiError>({
    queryKey: ['users'],
    enabled: enabled && !!loginData && !!user && !!account,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const response = await usersService.getUsers();
      // Backend normally returns { users: {id -> user} }
      const users = (response.data as any)?.users || (response.data as any) || {};
      const usersArray = Object.values(users || {}) as User[];
      return { users, usersArray };
    },
  });
}

