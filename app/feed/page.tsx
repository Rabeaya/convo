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

export default function FeedPage() {
  const { feedItems, isLoading, error, users, groups, fetchNextPage, hasNextPage, isFetchingNextPage } = useFeed();
  const [showUpdatesNotif, setShowUpdatesNotif] = useState(false);
  const [updatesNotifText] = useState(''); // Will be set when feed polling is implemented
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLoadingMoreRef = useRef(false);

  const handleFeedItemsUpdatesAvailableNotifClick = useCallback(() => {
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setShowUpdatesNotif(false);
  }, []);

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

  if (isLoading) {
    return (
      <div style={{
        minHeight: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
      }}>
        <div style={{
          fontSize: '14px',
          color: '#7b8386',
        }}>
          Loading feed...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
      }}>
        <div style={{
          fontSize: '14px',
          color: '#e56564',
        }}>
          Error loading feed: {error.message}
        </div>
      </div>
    );
  }

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
        {visibleFeedItems.length === 0 ? (
          <div className="feed_load_status" style={{
            textAlign: 'center',
            padding: '40px',
            color: '#7b8386',
            fontSize: '14px',
          }}>
            There is no feed to display.
          </div>
        ) : (
          visibleFeedItems.map((item) => (
            <FeedItem key={item.feed_id} item={item} />
          ))
        )}
      </div>

      {/* Loading More Indicator */}
      {isFetchingNextPage && (
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
      {visibleFeedItems.length > 0 && !hasNextPage && (
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
