'use client';

/**
 * Like Button Component
 * 
 * Handles like/unlike functionality for feed items and comments
 * Migrated from AngularJS cnv-like-button directive
 */

import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';

export interface LikeInfo {
  liked_by: string | null;
  liked_by_me: boolean;
  likes_count: number;
  like_timestamp?: number;
  sub_res_like_count?: number;
}

interface LikeButtonProps {
  likeInfo: LikeInfo;
  onLikeClick: (action: 'like' | 'unlike') => Promise<any>;
  disabled?: boolean;
  onLikeInfoChange?: (next: LikeInfo) => void;
}

export default function LikeButton({ likeInfo, onLikeClick, disabled = false, onLikeInfoChange }: LikeButtonProps) {
  const [likePending, setLikePending] = useState(false);
  const [localLikeInfo, setLocalLikeInfo] = useState(likeInfo);
  const { user } = useAuthStore();
  const currentUserId = useMemo(() => (user as any)?.user_id || (user as any)?.userId || null, [user]);

  // Keep in sync with server/poll updates (Angular binds directly to the object; React needs explicit sync).
  useEffect(() => {
    setLocalLikeInfo(likeInfo);
  }, [likeInfo]);

  const setLikeInfo = (next: LikeInfo) => {
    setLocalLikeInfo(next);
    onLikeInfoChange?.(next);
  };

  const handleLikeClick = async () => {
    if (likePending || disabled) {
      return;
    }

    setLikePending(true);

    const previousLikedBy = localLikeInfo.liked_by;
    const action = localLikeInfo.liked_by_me ? 'unlike' : 'like';

    // Optimistically update UI (matches Angular cnvLikeButton.js)
    const optimisticLikeInfo: LikeInfo = { ...localLikeInfo };
    if (action === 'like') {
      optimisticLikeInfo.liked_by_me = true;
      optimisticLikeInfo.likes_count = (optimisticLikeInfo.likes_count || 0) + 1;
      if (currentUserId) optimisticLikeInfo.liked_by = String(currentUserId);
    } else {
      optimisticLikeInfo.liked_by_me = false;
      if ((optimisticLikeInfo.likes_count || 0) > 0) {
        optimisticLikeInfo.likes_count = optimisticLikeInfo.likes_count - 1;
      }
      // keep liked_by until server returns new last likedBy (Angular does this)
    }
    setLikeInfo(optimisticLikeInfo);

    try {
      const response = await onLikeClick(action);
      
      if (response?.success) {
        // Update with server response (Angular: response.like_count + response.liked_by/likedBy)
        const likeCount = Number.parseInt(String((response as any).like_count ?? (response as any).likeCount ?? ''), 10);
        const likedBy = (response as any).liked_by ?? (response as any).likedBy ?? optimisticLikeInfo.liked_by;
        const likeTimestamp = (response as any).like_timestamp ?? (response as any).likeTimestamp ?? optimisticLikeInfo.like_timestamp;

        setLikeInfo({
          ...optimisticLikeInfo,
          likes_count: Number.isFinite(likeCount) ? likeCount : optimisticLikeInfo.likes_count,
          liked_by: likedBy ?? null,
          like_timestamp: likeTimestamp ?? optimisticLikeInfo.like_timestamp,
        });
      } else {
        // Revert on failure (matches Angular revertAction)
        const reverted: LikeInfo = { ...optimisticLikeInfo };
        if (action === 'like') {
          reverted.liked_by_me = false;
          reverted.likes_count = Math.max(0, (reverted.likes_count || 0) - 1);
          reverted.liked_by = previousLikedBy;
        } else {
          reverted.liked_by_me = true;
          // Angular does not increment likes_count back on unlike failure (server is source of truth later)
          reverted.liked_by = previousLikedBy;
        }
        setLikeInfo(reverted);
      }
    } catch (error) {
      // Revert on error (matches Angular revertAction)
      const reverted: LikeInfo = { ...optimisticLikeInfo };
      if (action === 'like') {
        reverted.liked_by_me = false;
        reverted.likes_count = Math.max(0, (reverted.likes_count || 0) - 1);
        reverted.liked_by = previousLikedBy;
      } else {
        reverted.liked_by_me = true;
        reverted.liked_by = previousLikedBy;
      }
      setLikeInfo(reverted);
    } finally {
      setLikePending(false);
    }
  };

  return (
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault();
        handleLikeClick();
      }}
      className={`like_btn hover_underline ${likePending ? 'like_btn_disabled' : ''}`}
      style={{
        color: 'rgb(51, 113, 189)', // Theme color
        textDecoration: 'none',
        cursor: likePending ? 'not-allowed' : 'pointer',
        opacity: likePending ? 0.6 : 1,
      }}
      onMouseEnter={(e) => {
        if (!likePending) {
          e.currentTarget.style.textDecoration = 'underline';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.textDecoration = 'none';
      }}
    >
      {localLikeInfo.liked_by_me ? 'Unlike' : 'Like'}
    </a>
  );
}

