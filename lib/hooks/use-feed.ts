import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { feedService, FeedFetchRequest, FeedFetchResponse, FeedPollRequest, FeedPollResponse } from '../api/feed';
import { useAuthStore } from '../stores/auth-store';
import { ApiError } from '../api/client';

const ITEMS_TO_FETCH_PER_CALL = 10;

export interface UseFeedOptions {
  filter?: any;
  isSearch?: boolean;
  enabled?: boolean;
}

export function useFeed(options: UseFeedOptions = {}) {
  const { filter, isSearch = false, enabled = true } = options;
  const { loginData, user, account } = useAuthStore();

  const queryKey = ['feed', filter, isSearch];

  const query = useInfiniteQuery<FeedFetchResponse, ApiError>({
    queryKey,
    queryFn: async ({ pageParam = 0 }) => {
      if (!loginData || !user || !account || !user.user_id) {
        throw new Error('Not authenticated');
      }

      const request: FeedFetchRequest = {
        authToken: loginData.xmpp_session_token,
        userID: user.user_id,
        accountID: account.account_id,
        fromIndex: pageParam as number,
        itemsCount: ITEMS_TO_FETCH_PER_CALL,
        summaryParams: null,
        sortBy: 1,
        feedIDsWithTimestamp: null,
        filter: filter || null,
        isSearch: isSearch,
        includeChats: false,
        includeDrafts: false,
        applyHighlight: true,
        postDisplayOption: 'latestActivity',
      };

      const response = await feedService.fetchFeed(request);
      return response.data;
    },
    enabled: enabled && !!loginData && !!user && !!account,
    staleTime: 0, // Feed data should always be fresh
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      // Matches AngularJS loadMoreFeed logic:
      // Keep loading until numResponseFeedItems === 0 (no items received from server)
      const lastPageItems = lastPage.feed_items || [];
      
      // If we received items, continue loading
      if (lastPageItems.length > 0) {
        const allItems = allPages.flatMap(page => page.feed_items || []);
        return allItems.length; // Next offset
      }
      
      // If no items received, we've reached the end (matches AngularJS: if numResponseFeedItems === 0, stop)
      return undefined;
    },
  });

  // Flatten all pages into a single array
  const feedItems = query.data?.pages.flatMap(page => page.feed_items || []) || [];
  
  // Merge users and groups from all pages
  const users = query.data?.pages.reduce((acc, page) => ({ ...acc, ...(page.users || {}) }), {}) || {};
  const groups = query.data?.pages.reduce((acc, page) => ({ ...acc, ...(page.groups || {}) }), {}) || {};
  const pinnedItems = query.data?.pages[0]?.pinned_items || [];

  return {
    ...query,
    feedItems,
    users,
    groups,
    pinnedItems,
  };
}

export function useFeedPoll(options: UseFeedOptions = {}) {
  const { filter } = options;
  const { loginData, user, account } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation<FeedPollResponse, ApiError, { lastPollTimestamp?: string }>({
    mutationFn: async ({ lastPollTimestamp }) => {
      if (!loginData || !user || !account) {
        throw new Error('Not authenticated');
      }

      const userId = (user as any).user_id || (user as any).userId;
      const accountId = (account as any).account_id;
      
      const request: FeedPollRequest = {
        authToken: loginData.xmpp_session_token,
        userID: userId,
        accountID: accountId,
        filter: filter || null,
        includeChats: false,
        includeDrafts: false,
        applyHighlight: true,
        mark_notifications: 1,
        client: 'w2',
        postDisplayOption: 'latestActivity',
        lastFeedPollTimestamp: lastPollTimestamp,
      };

      const response = await feedService.pollFeed(request);
      return response.data;
    },
    onSuccess: (data) => {
      // Update feed cache with new items (matches AngularJS pollFeed merge behavior)
      queryClient.setQueryData(['feed', filter], (old: FeedFetchResponse | undefined) => {
        if (!old) {
          // If no existing data, create new structure
          return {
            feed_items: data.feed_items || [],
            users: data.users || {},
            groups: data.groups || {},
            pinned_items: data.pinned_items || [],
          };
        }
        
        const newItems = data.feed_items || [];
        const existingItems = old.feed_items || [];
        
        // Merge new items with existing items (matches AngularJS processPendingFeedItemsMerging)
        // Update existing items if they have the same feed_id, otherwise add new ones at the top
        const existingIds = new Set(existingItems.map(item => item.feed_id));
        const updatedItems = existingItems.map(item => {
          const updatedItem = newItems.find(newItem => newItem.feed_id === item.feed_id);
          if (updatedItem) {
            // Merge conversations/comments from poll response (matches AngularJS updateCommentsDataReceivedInFeedPoll)
            return {
              ...item,
              ...updatedItem,
              // Merge conversations if present in poll response
              conversations: updatedItem.conversations || item.conversations,
              conversations_count: updatedItem.conversations_count ?? item.conversations_count,
            };
          }
          return item;
        });
        
        // Add new items that don't exist yet (at the top, matching AngularJS)
        const uniqueNewItems = newItems.filter(item => !existingIds.has(item.feed_id));
        
        return {
          ...old,
          feed_items: [...uniqueNewItems, ...updatedItems],
          users: { ...old.users, ...(data.users || {}) },
          groups: { ...old.groups, ...(data.groups || {}) },
          pinned_items: data.pinned_items || old.pinned_items || [],
        };
      });
      
      // Invalidate all feed queries to ensure UI updates
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

