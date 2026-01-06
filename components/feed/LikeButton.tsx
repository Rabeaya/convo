'use client';

/**
 * Like Button Component
 * 
 * Handles like/unlike functionality for feed items and comments
 * Migrated from AngularJS cnv-like-button directive
 */

import { useState } from 'react';

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
}

export default function LikeButton({ likeInfo, onLikeClick, disabled = false }: LikeButtonProps) {
  const [likePending, setLikePending] = useState(false);
  const [localLikeInfo, setLocalLikeInfo] = useState(likeInfo);

  const handleLikeClick = async () => {
    if (likePending || disabled) {
      return;
    }

    setLikePending(true);

    const previousLikedBy = localLikeInfo.liked_by;
    const action = localLikeInfo.liked_by_me ? 'unlike' : 'like';

    // Optimistically update UI
    const optimisticLikeInfo = { ...localLikeInfo };
    if (action === 'like') {
      optimisticLikeInfo.liked_by_me = true;
      optimisticLikeInfo.likes_count++;
    } else {
      optimisticLikeInfo.liked_by_me = false;
      if (optimisticLikeInfo.likes_count > 0) {
        optimisticLikeInfo.likes_count--;
      }
    }
    setLocalLikeInfo(optimisticLikeInfo);

    try {
      const response = await onLikeClick(action);
      
      if (response?.success) {
        // Update with server response
        setLocalLikeInfo({
          ...localLikeInfo,
          liked_by_me: optimisticLikeInfo.liked_by_me,
          likes_count: parseInt(response.like_count) || optimisticLikeInfo.likes_count,
          liked_by: response.liked_by || response.likedBy || optimisticLikeInfo.liked_by,
        });
      } else {
        // Revert on failure
        setLocalLikeInfo({
          ...localLikeInfo,
          liked_by_me: action === 'like' ? false : true,
          likes_count: action === 'like' ? localLikeInfo.likes_count - 1 : localLikeInfo.likes_count + 1,
          liked_by: previousLikedBy,
        });
      }
    } catch (error) {
      // Revert on error
      setLocalLikeInfo({
        ...localLikeInfo,
        liked_by_me: action === 'like' ? false : true,
        likes_count: action === 'like' ? localLikeInfo.likes_count - 1 : localLikeInfo.likes_count + 1,
        liked_by: previousLikedBy,
      });
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

