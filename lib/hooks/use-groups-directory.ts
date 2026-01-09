import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groupsDirectoryService, GroupDirectoryItem, GroupsDirectoryResponse } from '@/lib/api/groups-directory';

/**
 * Hook for fetching groups directory data
 * Matches AngularJS getGroupsDirectory behavior
 */
export function useGroupsDirectory(accountDataRevisionNo?: number) {
  return useQuery({
    queryKey: ['groups-directory', accountDataRevisionNo],
    queryFn: async () => {
      const response = await groupsDirectoryService.getGroupsDirectory(accountDataRevisionNo);
      return response.data;
    },
    refetchInterval: 30000, // Poll every 30 seconds like AngularJS
    staleTime: 0, // Always consider stale to allow polling
  });
}

/**
 * Process groups directory data to separate manage and member groups
 * Matches AngularJS processOriginalGroups and getGroupsYouManageAndYouAreAlreadyMemberOfGroup behavior
 */
export function processGroupsDirectory(groups: GroupDirectoryItem[]) {
  const manageGroups: GroupDirectoryItem[] = [];
  const memberGroups: GroupDirectoryItem[] = [];
  const allGroups: GroupDirectoryItem[] = [];

  groups.forEach((group) => {
    // Add to all groups
    allGroups.push(group);

    // Check if user manages the group
    if (group._hint_this_user_manages_group === 1) {
      manageGroups.push(group);
    } else if (group._hint_this_user_is_in_group === 1) {
      // User is a member but doesn't manage
      memberGroups.push(group);
    }
  });

  return {
    allGroups,
    manageGroups,
    memberGroups,
  };
}

/**
 * Sort groups by name
 * Matches AngularJS sortByName behavior
 */
export function sortGroupsByName(groups: GroupDirectoryItem[]): GroupDirectoryItem[] {
  return [...groups].sort((a, b) => {
    const nameA = (a.title || '').toLowerCase();
    const nameB = (b.title || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });
}



