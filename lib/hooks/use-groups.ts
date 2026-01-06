import { useQuery } from '@tanstack/react-query';
import { groupsService, GroupsResponse, Group } from '../api/groups';
import { relevanciesService } from '../api/relevancies';
import { useAuthStore } from '../stores/auth-store';
import { ApiError } from '../api/client';

export function useGroups(enabled: boolean = true) {
  const { loginData, user, account } = useAuthStore();

  const groupsQuery = useQuery<GroupsResponse, ApiError>({
    queryKey: ['groups'],
    queryFn: async () => {
      if (!loginData || !user || !account || !user.user_id) {
        throw new Error('Not authenticated');
      }

      const response = await groupsService.getGroups();
      let groupsData = response.data;
      
      console.log('useGroups - Response from service:', response);
      console.log('useGroups - Groups data:', groupsData);
      console.log('useGroups - Groups data type:', typeof groupsData);
      console.log('useGroups - Groups data keys:', groupsData ? Object.keys(groupsData) : 'null/undefined');
      
      // Ensure we have the right structure
      if (!groupsData.groups && Array.isArray(groupsData)) {
        // If groupsData is directly an array, wrap it
        groupsData = { groups: groupsData, account_data_revision_number: 0 };
      }
      
      // Fetch relevancies for groups if we have groups
      if (groupsData.groups && Array.isArray(groupsData.groups) && groupsData.groups.length > 0) {
        const groupIds = groupsData.groups.map(g => g.id);
        console.log('useGroups - Fetching relevancies for', groupIds.length, 'groups');
        
        try {
          const relevanciesResponse = await relevanciesService.getRelevancies(
            groupIds,
            loginData.xmpp_session_token,
            user.user_id,
            account.account_id
          );
          
          const relevancies = relevanciesResponse.data;
          console.log('useGroups - Relevancies received:', relevancies);
          
          // Merge relevancies into groups
          groupsData.groups = groupsData.groups.map(group => ({
            ...group,
            rank: relevancies[group.id] || undefined,
          }));
        } catch (error) {
          console.warn('useGroups - Failed to fetch relevancies:', error);
          // Continue without relevancies
        }
      } else {
        console.warn('useGroups - No groups to fetch relevancies for. groupsData:', groupsData);
      }
      
      console.log('useGroups - Returning groupsData:', groupsData);
      return groupsData;
    },
    enabled: enabled && !!loginData && !!user && !!account,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return groupsQuery;
}

// Helper function to filter and sort groups
export function processGroups(groups: Group[]): {
  privateGroups: Group[];
  publicGroups: Group[];
} {
  const privateGroups: Group[] = [];
  const publicGroups: Group[] = [];

  if (!groups || !Array.isArray(groups) || groups.length === 0) {
    console.log('processGroups: No groups to process');
    return { privateGroups, publicGroups };
  }

  console.log('processGroups: Processing', groups.length, 'groups');
  console.log('processGroups: Sample group:', groups[0]);

  // Normalize group data - ensure title exists and handle missing fields
  const normalizedGroups = groups.map((group) => {
    // If title is missing, try to get it from the group object or use a fallback
    const normalizedGroup: Group = {
      ...group,
      title: group.title || (group as any).name || `Group ${group.id}`,
      isListable: group.isListable !== false, // Default to true
      access: group.access || 'PUBLIC', // Default access type
    };
    
    if (!normalizedGroup.title || normalizedGroup.title === `Group ${group.id}`) {
      console.warn('Group missing title:', group.id, 'Full group:', group);
    }
    
    return normalizedGroup;
  });

  // Filter to only listable groups (default to true if undefined to be more permissive)
  const listableGroups = normalizedGroups.filter((group) => {
    // If isListable is explicitly false, filter it out
    // Otherwise, include it (handles undefined, true, or any other value)
    return group.isListable !== false;
  });

  console.log('processGroups: Listable groups:', listableGroups.length);

  // Sort groups by pinned status and rank
  const sortedGroups = [...listableGroups].sort((a, b) => {
    // Pinned groups first
    if (a.pinned_at && !b.pinned_at) return -1;
    if (!a.pinned_at && b.pinned_at) return 1;
    // Then by rank (relevancy)
    if (a.rank !== undefined && b.rank !== undefined) {
      return b.rank - a.rank; // Higher rank first
    }
    if (a.rank !== undefined) return -1;
    if (b.rank !== undefined) return 1;
    // Finally by title
    const titleA = a.title || '';
    const titleB = b.title || '';
    return titleA.localeCompare(titleB);
  });

  sortedGroups.forEach((group) => {
    const access = group.access || 'PUBLIC';
    if (access === 'SECRET' || access === 'PRIVATE') {
      privateGroups.push(group);
    } else if (access === 'PUBLIC') {
      publicGroups.push(group);
    } else {
      console.log('Group with unknown access type:', group.id, group.title, access);
    }
  });

  console.log('processGroups: Result - Private:', privateGroups.length, 'Public:', publicGroups.length);
  if (privateGroups.length > 0) {
    console.log('Sample private group:', privateGroups[0]);
  }
  if (publicGroups.length > 0) {
    console.log('Sample public group:', publicGroups[0]);
  }

  return { privateGroups, publicGroups };
}

