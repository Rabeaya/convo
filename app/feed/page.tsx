'use client';

/**
 * Feed Page
 * 
 * Main feed page displaying feed items
 * Migrated from AngularJS cnv-feed directive
 * Implements infinite scroll like AngularJS version
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useFeed } from '@/lib/hooks/use-feed';
import FeedItem from '@/components/feed/FeedItem';
import { FeedProvider } from '@/lib/contexts/FeedContext';
import { useAuthStore } from '@/lib/stores/auth-store';
import { feedService, type FeedPollRequest, type FeedPollResponse, type FeedFetchResponse } from '@/lib/api/feed';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import InlineInsert from '@/components/feed/InlineInsert';

export default function FeedPage() {
  const {
    feedItems,
    isLoading,
    isFetching,
    isFetched,
    error,
    users,
    groups,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useFeed();
  const { loginData, user, account } = useAuthStore();
  const queryClient = useQueryClient();
  const [showUpdatesNotif, setShowUpdatesNotif] = useState(false);
  const [updatesNotifText, setUpdatesNotifText] = useState(''); // Angular: "X updates"
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLoadingMoreRef = useRef(false);
  const lastPollTsRef = useRef<string | undefined>(undefined);
  const pollingRef = useRef(false);
  const pendingNewItemsCountRef = useRef<number>(0);

  const handleFeedItemsUpdatesAvailableNotifClick = useCallback(() => {
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setShowUpdatesNotif(false);
    pendingNewItemsCountRef.current = 0;
    setUpdatesNotifText('');
    // Best parity with Angular "swap/merge pending": refetch from server to include new items without corrupting pagination offsets.
    queryClient.invalidateQueries({ queryKey: ['feed'] });
  }, []);

  // Angular parity: on reload we wait for session/auth hydration before rendering empty-state.
  // Otherwise the feed query is disabled and React shows "There is no feed to display." briefly.
  const authReady = !!loginData && !!user && !!account;

  // -----------------------
  // Angular parity: auto feed polling
  // - periodic (FEED_POLL_INTERVAL: 60s default, 15s for TNW)
  // - on tab activated/focus
  // - uses last_feed_poll_timestamp to get deltas
  // -----------------------
  useEffect(() => {
    if (!loginData || !user || !account) return;

    const userId = (user as any).user_id || (user as any).userId;
    const accountId = (account as any).account_id;
    const authToken = (loginData as any).xmpp_session_token;

    // Angular: 60s on normal accounts
    const FEED_POLL_INTERVAL = Number(process.env.NEXT_PUBLIC_FEED_POLL_INTERVAL_MS || 60000);

    const isAtTop = () => {
      const feedScroller = document.getElementById('feedScroller');
      if (feedScroller) return feedScroller.scrollTop <= 5;
      return window.scrollY <= 5;
    };

    const doPoll = async (trigger: string) => {
      if (pollingRef.current) return;
      if (document.visibilityState === 'hidden') return;
      pollingRef.current = true;
      try {
        const request: FeedPollRequest = {
          authToken,
          userID: userId,
          accountID: accountId,
          filter: null,
          includeChats: false,
          includeDrafts: false,
          applyHighlight: true,
          mark_notifications: 1,
          client: 'w2',
          postDisplayOption: 'latestActivity',
          lastFeedPollTimestamp: lastPollTsRef.current,
        };

        const res = await feedService.pollFeed(request);
        const data: FeedPollResponse = res.data;

        // Track last poll ts like Angular: last_feed_poll_timestamp
        const nextTs =
          (data as any).last_feed_poll_timestamp ||
          (data as any).lastFeedPollTimestamp ||
          (data as any).last_feed_poll_ts;
        if (nextTs) lastPollTsRef.current = String(nextTs);

        const incoming = data.feed_items || [];
        if (incoming.length === 0) return;

        // Update existing items in-place (comments/likes/etc) without changing pagination length.
        // New items are counted and shown via "X updates" banner until user scrolls top/clicks.
        const existingIds = new Set(feedItems.map((it) => it.feed_id));
        let newCount = 0;

        queryClient.setQueriesData(
          { queryKey: ['feed'] },
          (old: unknown) => {
            const o: any = old;
            if (!o) return old;
            if (!o.pages) return old;

            const inf = o as InfiniteData<FeedFetchResponse>;
            const updatedMap = new Map<string, any>();
            incoming.forEach((it) => {
              if (!it?.feed_id) return;
              updatedMap.set(it.feed_id, it);
            });

            const nextPages = inf.pages.map((p) => {
              const items = (p.feed_items || []).map((it: any) => {
                const u = updatedMap.get(it.feed_id);
                if (!u) return it;
                return {
                  ...it,
                  ...u,
                  conversations: u.conversations || it.conversations,
                  conversations_count: u.conversations_count ?? it.conversations_count,
                };
              });

              return {
                ...p,
                // Merge users/groups from poll into each page (cheap + keeps context updated)
                users: { ...(p.users || {}), ...(data.users || {}) },
                groups: { ...(p.groups || {}), ...(data.groups || {}) },
                feed_items: items,
                pinned_items: (data.pinned_items as any) || p.pinned_items,
              };
            });

            return { ...inf, pages: nextPages };
          }
        );

        // Count new items not currently in list
        for (const it of incoming) {
          if (!it?.feed_id) continue;
          if (!existingIds.has(it.feed_id)) newCount++;
        }

        if (newCount > 0) {
          if (isAtTop()) {
            // If user is at top, refresh immediately
            pendingNewItemsCountRef.current = 0;
            setShowUpdatesNotif(false);
            setUpdatesNotifText('');
            queryClient.invalidateQueries({ queryKey: ['feed'] });
          } else {
            pendingNewItemsCountRef.current += newCount;
            const c = pendingNewItemsCountRef.current;
            setUpdatesNotifText(`${c} update${c === 1 ? '' : 's'}`);
            setShowUpdatesNotif(true);
          }
        }
      } catch (e) {
        // keep silent like Angular periodic poll
      } finally {
        pollingRef.current = false;
      }
    };

    // Initial poll on mount (Angular: TAB_ACTIVATED)
    doPoll('TAB_ACTIVATED');

    const intervalId = window.setInterval(() => doPoll('PERIODIC'), FEED_POLL_INTERVAL);

    const onVis = () => {
      if (document.visibilityState === 'visible') doPoll('TAB_ACTIVATED');
    };
    const onFocus = () => doPoll('NATIVE_APP_FOCUS');
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
    };
  }, [loginData, user, account, queryClient, feedItems]);

  // Infinite scroll implementation - matches AngularJS onFeedScrolledBottom directive
  // Uses window scroll like AngularJS directive, but also supports feedScroller container
  useEffect(() => {
    const feedScroller = document.getElementById('feedScroller');
    const scrollElement = feedScroller || window;

    const handleScroll = () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = setTimeout(() => {
        if (isLoadingMoreRef.current || !hasNextPage || isFetchingNextPage) {
          return;
        }

        // Check if scrolled near bottom (within 500px, matching AngularJS)
        let scrollHeight: number;
        let documentHeight: number;

        if (feedScroller) {
          // Use feedScroller container scroll
          scrollHeight = feedScroller.scrollTop + feedScroller.clientHeight;
          documentHeight = feedScroller.scrollHeight;
        } else {
          // Use window scroll (fallback)
          scrollHeight = window.scrollY + window.innerHeight;
          documentHeight = document.documentElement.scrollHeight;
        }

        if (scrollHeight > documentHeight - 500) {
          isLoadingMoreRef.current = true;
          fetchNextPage().finally(() => {
            isLoadingMoreRef.current = false;
          });
        }
      }, 250); // Throttle like AngularJS (250ms)
    };

    if (feedScroller) {
      feedScroller.addEventListener('scroll', handleScroll, { passive: true });
      feedScroller.addEventListener('mousewheel', handleScroll, { passive: true });
    } else {
      window.addEventListener('scroll', handleScroll, { passive: true });
      window.addEventListener('mousewheel', handleScroll, { passive: true });
    }

    return () => {
      if (feedScroller) {
        feedScroller.removeEventListener('scroll', handleScroll);
        feedScroller.removeEventListener('mousewheel', handleScroll);
      } else {
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('mousewheel', handleScroll);
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const showInitialLoader = !authReady || isLoading || (!isFetched && isFetching);

  // Filter out milestones (app_instance_id == 3) and todos (app_instance_id == 14)
  const visibleFeedItems = feedItems.filter(
    item => !item._hide && item.app_instance_id !== 3 && item.app_instance_id !== 14
  );

  return (
    <FeedProvider users={users} groups={groups}>
      <div className="feed" style={{ 
        display: 'inline-block',
        width: '572px',
        textAlign: 'left',
        marginTop: '0px',
      }}>
        {/* Feed Updates Available Notification */}
        {showUpdatesNotif && (
        <div 
          id="feed-updates-available-notif" 
          className={showUpdatesNotif ? 'in-view' : ''}
          style={{
            position: 'fixed',
            top: '75px',
            left: '50%',
            marginLeft: '-50px',
            textAlign: 'center',
            zIndex: 11,
            transform: showUpdatesNotif ? 'translateY(0)' : 'translateY(-200px)',
            transition: 'transform 500ms cubic-bezier(0, 1.02, 0, 1.06) 500ms',
          }}
        >
          <div 
            className="btn-cont" 
            onClick={handleFeedItemsUpdatesAvailableNotifClick}
            style={{
              fontSize: '12px',
              fontWeight: '600',
              border: '1px solid #d0d0d0',
              color: '#4183d7',
              cursor: 'pointer',
              borderRadius: '3px',
              minWidth: '90px',
              minHeight: '27px',
              padding: '0px 8px 0px 3px',
              boxShadow: '0px 1px 10px -1px rgba(0, 0, 0, 0.35)',
              backgroundColor: '#f6f7f8',
            }}
          >
            <i className="cnv-icons-20 Icon1__UpArrow-blue" style={{
              backgroundSize: 'cover',
              borderTop: '1px solid transparent',
              width: '12px',
              height: '11px',
              marginTop: '5px',
              display: 'inline-block',
            }}></i>
            <span style={{
              verticalAlign: 'middle',
              padding: '8px 2px',
            }}>{updatesNotifText}</span>
          </div>
        </div>
      )}

      {/* Feed Container */}
      <div className="feed-cont">
        {/* New Post Composer - Angular parity: cnvHomeCenterPanel.tpl.html inline-insert-wrapper */}
        <div className="inline-insert-wrapper">
          <InlineInsert />
        </div>

        {showInitialLoader ? (
          <div className="feed_load_status">Loading...</div>
        ) : error ? (
          <div className="feed_load_status" style={{ color: '#e56564' }}>
            Error loading feed: {error.message}
          </div>
        ) : isFetched && visibleFeedItems.length === 0 ? (
          <div className="feed_load_status" style={{ textAlign: 'center', padding: '40px', color: '#7b8386', fontSize: '14px' }}>
            There is no feed to display.
          </div>
        ) : (
          visibleFeedItems.map((item) => <FeedItem key={item.feed_id} item={item} />)
        )}
      </div>

      {/* Loading More Indicator */}
      {isFetchingNextPage && !showInitialLoader && !error && (
        <div style={{
          textAlign: 'center',
          padding: '20px',
          color: '#7b8386',
          fontSize: '14px',
        }}>
          Loading more...
        </div>
      )}

      {/* Feed End Placeholder */}
      {visibleFeedItems.length > 0 && !hasNextPage && !showInitialLoader && !error && (
        <div className="feed-end-placeholder" style={{
          background: 'url(/assets/img/feed/infinitescrollend2x.png)',
          backgroundRepeat: 'no-repeat',
          backgroundSize: '56px 28px',
          backgroundPosition: 'center',
          padding: '15px',
          marginTop: '15px',
          marginBottom: '60px',
        }}></div>
        )}
      </div>
    </FeedProvider>
  );
}
