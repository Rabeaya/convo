'use client';

/**
 * Comments Panel Component
 * 
 * Displays comments for a feed item with threading support
 * Migrated from AngularJS cnv-comments-panel directive
 */

import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { FeedItem, Comment } from '@/lib/api/feed';
import { User } from '@/lib/api/auth';
import CommentItem from './CommentItem';
import CommentEditor from './CommentEditor';
import { useFeedContext } from '@/lib/contexts/FeedContext';
import { commentsService } from '@/lib/api/comments';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useFeedPoll } from '@/lib/hooks/use-feed';
import { useQueryClient } from '@tanstack/react-query';
import { rmAllSelections, selectTextNested } from '@/lib/utils/text-selections-engine';

// Helper function to get user name from users map
function getUserName(users: Record<string, User>, userId: string): string {
  const user = users[userId];
  if (!user) return 'Unknown';
  return (user as any).name || (user as any).firstName + ' ' + (user as any).lastName || userId;
}

interface CommentsPanelProps {
  item: FeedItem;
  showCommentsPanel: boolean;
  onToggleComments: () => void;
  onPostSnippetPlayback?: (snippetData: any, commentId: string) => void;
  // Allows parent (FeedItem) to trigger snippet insertion (mirrors Angular $broadcast flows)
  snippetReplySetterRef?: MutableRefObject<
    ((
      snippetWrapper: any,
      collaborationInfo: { replied_to_comment_id?: string; replied_to_user_id?: string; parent_resource_index?: number } | null,
      initialText?: string
    ) => void) | null
  >;
}

// Helper to sort comments by creation_timestamp (oldest first, newest at bottom)
const sortCommentsByTimestamp = (comments: Comment[]): Comment[] => {
  return [...comments].sort((a, b) => (a.creation_timestamp || 0) - (b.creation_timestamp || 0));
};

const LATEST_COMMENTS_ONLY_COUNT = 2; // Exact match from AngularJS
const PAGE_SIZE = 10; // Exact match from AngularJS

export default function CommentsPanel({ item, showCommentsPanel, onToggleComments: _onToggleComments, snippetReplySetterRef, onPostSnippetPlayback }: CommentsPanelProps) {
  const { users } = useFeedContext();
  const feedPoll = useFeedPoll();
  const queryClient = useQueryClient();
  const { user, loginData, account } = useAuthStore();
  const commentEditorRef = useRef<{ activate: (initialText: string) => void }>(null);
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [loadedCommentsCount, setLoadedCommentsCount] = useState(LATEST_COMMENTS_ONLY_COUNT);
  const [loadingComments, setLoadingComments] = useState(false);
  // Initialize comments and sort by creation_timestamp (oldest first, newest at bottom - matches AngularJS)
  const [allComments, setAllComments] = useState<Comment[]>(sortCommentsByTimestamp(item.conversations || []));
  const commentsContainerRef = useRef<HTMLDivElement>(null);
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [replyEventData, setReplyEventData] = useState<{ citem_uid: string; from_user: string } | null>(null);
  const [showNewCommentsBadge, setShowNewCommentsBadge] = useState(false);
  const [badgeAnimClass, setBadgeAnimClass] = useState<'new-comments-badge-enter-sequence' | 'new-comments-badge-leave-sequence' | ''>('');
  const prevTotalCommentsRef = useRef<number>(item.conversations_count || 0);
  const scrollRestoreRef = useRef<{ prevScrollHeightMinusTop: number } | null>(null);
  const [shadowBottom, setShadowBottom] = useState(false);
  const [shadowTop, setShadowTop] = useState(false);
  const [localTotalComments, setLocalTotalComments] = useState<number>(item.conversations_count || 0);
  const [editorSnippetData, setEditorSnippetData] = useState<any | null>(null);
  const [editorCollaborationInfo, setEditorCollaborationInfo] = useState<{ replied_to_comment_id?: string; replied_to_user_id?: string; parent_resource_index?: number } | null>(null);

  type ThreadPlaybackState = {
    active: boolean;
    currentlyPlayingSnippetForComment: string | null;
    hidden: Record<string, boolean>;
    sourcePointers: Record<string, boolean>;
    repliedPointers: Record<string, boolean>;
    threadBPad: Record<string, boolean>;
    threadTPad: Record<string, boolean>;
    showAllButtonForSource: Record<string, boolean>;
  };

  const emptyThreadPlayback: ThreadPlaybackState = {
    active: false,
    currentlyPlayingSnippetForComment: null,
    hidden: {},
    sourcePointers: {},
    repliedPointers: {},
    threadBPad: {},
    threadTPad: {},
    showAllButtonForSource: {},
  };

  const [threadPlayback, setThreadPlayback] = useState<ThreadPlaybackState>(emptyThreadPlayback);

  // Update comments when item.conversations changes (e.g., after pollFeed response)
  // Deduplicate by uid to avoid duplicate keys (matches AngularJS mergeComments behavior)
  useEffect(() => {
    if (item.conversations && item.conversations.length > 0) {
      // Merge comments: update existing ones, add new ones (matches AngularJS mergeComments)
      setAllComments((prevComments) => {
        // Create a map of existing comments by uid
        const existingCommentsMap = new Map(prevComments.map(c => [c.uid, c]));
        
        // Update or add comments from feed item
        item.conversations.forEach((comment: Comment) => {
          if (comment.uid) {
            existingCommentsMap.set(comment.uid, comment);
          }
        });
        
        // Convert back to array and sort by timestamp
        const mergedComments = Array.from(existingCommentsMap.values());
        return sortCommentsByTimestamp(mergedComments);
      });
    } else if (item.conversations_count === 0) {
      // Clear comments if count is 0
      setAllComments([]);
    }
  }, [item.conversations, item.conversations_count]);

  const comments = allComments;
  const totalComments = localTotalComments;
  // Display latest comments at bottom (negative slice = from end, matches AngularJS limitTo:-loadedCommentsCount)
  const displayedComments = commentsExpanded 
    ? comments.slice(-loadedCommentsCount)
    : comments.slice(-LATEST_COMMENTS_ONLY_COUNT);

  const scrollToBottom = (animate?: boolean) => {
    const container = commentsContainerRef.current;
    if (!container) return;
    const target = container.scrollHeight - container.clientHeight + 10;
    if (!animate) {
      container.scrollTop = target;
      return;
    }
    container.scrollTo({ top: target, behavior: 'smooth' });
  };

  const loadAllComments = async () => {
    if (loadingComments || !loginData || !user || !account) return;
    
    setLoadingComments(true);
    setCommentsExpanded(true);
    // Angular sets loadedCommentsCount = 10 (and keeps it) while fetching all comments in background.
    setLoadedCommentsCount(Math.min(PAGE_SIZE, totalComments || PAGE_SIZE));
    
    const userId = (user as any).user_id || (user as any).userId;
    const accountId = (account as any).account_id;
    const authToken = loginData.xmpp_session_token;
    
    try {
      // First fetch (matching AngularJS): extend the local list (usually latest 2) by fetching more.
      const response = await commentsService.getComments_newApi(
        item.feed_id || null, // feed_id
        item.resource_id,
        item.app_instance_id,
        true, // fetchFromServerIfNotAvailableLocally
        comments.length, // offset (Angular continues from current local length)
        PAGE_SIZE, // limit
        authToken,
        userId,
        accountId
      );
      
      if (response.data) {
        const newComments = response.data.comments || [];
        // Merge and deduplicate comments by uid (matches AngularJS mergeComments behavior)
        const existingCommentsMap = new Map(comments.map(c => [c.uid, c]));
        newComments.forEach((comment: Comment) => {
          if (comment.uid) {
            existingCommentsMap.set(comment.uid, comment);
          }
        });
        const mergedComments = Array.from(existingCommentsMap.values());
        setAllComments(sortCommentsByTimestamp(mergedComments));
        // Keep showing latest PAGE_SIZE (Angular keeps loadedCommentsCount = 10)
        setLoadedCommentsCount(Math.min(PAGE_SIZE, response.data.total_comments || totalComments || PAGE_SIZE));
        
        // Then load ALL comments into local store (matching AngularJS second call)
        const allResponse = await commentsService.getComments_newApi(
          item.feed_id || null,
          item.resource_id,
          item.app_instance_id,
          true,
          0,
          null, // null = all comments
          authToken,
          userId,
          accountId
        );
        
        if (allResponse.data) {
          // Deduplicate and sort all comments by timestamp (oldest first, newest at bottom)
          const allCommentsMap = new Map<string, Comment>();
          (allResponse.data.comments || []).forEach((comment: Comment) => {
            if (comment.uid) {
              allCommentsMap.set(comment.uid, comment);
            }
          });
          const deduplicatedComments = Array.from(allCommentsMap.values());
          setAllComments(sortCommentsByTimestamp(deduplicatedComments));
          // Keep showing latest PAGE_SIZE (Angular stores all but shows last 10 initially)
          setLoadedCommentsCount(Math.min(PAGE_SIZE, allResponse.data.total_comments || totalComments || PAGE_SIZE));
        }
      }
    } catch (error) {
      console.error('Failed to load all comments:', error);
    } finally {
      setLoadingComments(false);
      // Scroll to bottom after loading
      setTimeout(() => {
        scrollToBottom(false);
      }, 0);
    }
  };

  const showLatestCommentsOnly = () => {
    setLoadedCommentsCount(LATEST_COMMENTS_ONLY_COUNT);
    setCommentsExpanded(false);
    // Matches AngularJS $broadcast('Comments:showAll') when collapsing panel
    setThreadPlayback(emptyThreadPlayback);
    rmAllSelections();
    setShowNewCommentsBadge(false);
    setBadgeAnimClass('');
    if (commentsContainerRef.current) {
      commentsContainerRef.current.scrollTop = commentsContainerRef.current.scrollHeight; // Scroll to bottom
    }
  };

  const handleReplyClick = (commentId: string, fromUser: string) => {
    // Matches AngularJS onCommentReplyButtonClick behavior
    // Activate comment editor with @mention
    setReplyEventData({ citem_uid: commentId, from_user: fromUser });
    if (commentEditorRef.current) {
      const replyUser = users[fromUser];
      let initialText = '';
      
      if (replyUser) {
        // Get user name (matches AngularJS getUserListItem)
        const userName = (replyUser as any).name || 
                        ((replyUser as any).first_name || (replyUser as any).firstName || '') + ' ' + 
                        ((replyUser as any).last_name || (replyUser as any).lastName || '').trim();
        const name = userName.trim() || fromUser;
        
        // Create @mention text (simplified - AngularJS uses Quill with HTML)
        initialText = `@${name} `;
      }
      
      // Activate the comment editor with @mention
      commentEditorRef.current.activate(initialText);
    }
  };

  const setSnippetReply = (snippetWrapper: any, collaborationInfo: { replied_to_comment_id?: string; replied_to_user_id?: string; parent_resource_index?: number } | null, initialText?: string) => {
    // Mirrors Angular: commentEditorCtrl.snippetData = snippetData; setAllowAttachments(false); scope.collaborationInfo = collaborationInfo; activate panel
    setEditorSnippetData(snippetWrapper);
    setEditorCollaborationInfo(collaborationInfo || null);
    setReplyEventData(null);
    setCommentsExpanded(true);
    setLoadedCommentsCount((c) => Math.max(c, PAGE_SIZE));
    if (initialText && commentEditorRef.current) {
      commentEditorRef.current.activate(initialText);
    } else {
      commentEditorRef.current?.activate('');
    }
  };

  useEffect(() => {
    if (snippetReplySetterRef) {
      snippetReplySetterRef.current = setSnippetReply;
    }
  }, [snippetReplySetterRef, setSnippetReply]);

  const checkIfCommentIsInView = (commentId: string): boolean => {
    const container = commentsContainerRef.current;
    if (!container) return false;
    const el = container.querySelector(`#${CSS.escape(commentId)}`) as HTMLElement | null;
    if (!el) return false;
    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    return eRect.top > cRect.top && eRect.top < cRect.bottom;
  };

  const bringCommentInView = (commentId: string) => {
    const container = commentsContainerRef.current;
    if (!container) return;
    const el = container.querySelector(`#${CSS.escape(commentId)}`) as HTMLElement | null;
    if (!el) return;
    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const delta = eRect.top - cRect.top;
    container.scrollTop = container.scrollTop + delta;
  };

  const handleUnHideAll = (commentId?: string) => {
    // Matches AngularJS Comments:unHideAll handler
    setThreadPlayback(emptyThreadPlayback);
    rmAllSelections();
    if (commentId) {
      window.setTimeout(() => {
        if (!checkIfCommentIsInView(commentId)) {
          window.setTimeout(() => {
            bringCommentInView(commentId);
          }, 0);
        }
      }, 900);
    }
  };

  const handleReplyCommentPlayback = async (
    collaborationInfo: any,
    currentCommentId: string,
    thread_root_comment_id?: string
  ) => {
    if (!collaborationInfo || !collaborationInfo.replied_to_comment_id) return;
    if (!loginData || !user || !account) return;

    // If a thread is already playing and a different one is clicked, clear instantly (matches Comments:showAllWithoutAnim)
    if (threadPlayback.active && threadPlayback.currentlyPlayingSnippetForComment) {
      setThreadPlayback(emptyThreadPlayback);
      rmAllSelections();
    }

    const userId = (user as any).user_id || (user as any).userId;
    const accountId = (account as any).account_id;
    const authToken = loginData.xmpp_session_token;

    const fetchAllFromServer = async (doFetchComments: boolean) => {
      const res = await commentsService.getComments_newApi(
        null,
        item.resource_id,
        item.app_instance_id,
        doFetchComments,
        0,
        null,
        authToken,
        userId,
        accountId
      );
      const fetched = sortCommentsByTimestamp(res.data.comments || []);
      setAllComments(fetched);
      setCommentsExpanded(true);
      setLoadedCommentsCount(fetched.length);
      return fetched;
    };

    const startPlaybackSequence = (commentsToUse: Comment[], scrollToBottom?: boolean) => {
      const actionComments: string[] = [];
      const actionCommentsIdx: number[] = [];
      const hideComments: Record<string, boolean> = {};
      let displayViewAllBtn = false;

      let replied_to = collaborationInfo.replied_to_comment_id;

      for (let i = commentsToUse.length - 1; i >= 0; i--) {
        const tmpComment: any = commentsToUse[i];
        const tmpRepliedTo = tmpComment?.resource_link?.collaboration_info?.replied_to_comment_id;

        if (replied_to == tmpComment.uid || currentCommentId == tmpComment.uid || currentCommentId == tmpRepliedTo) {
          actionComments.push(tmpComment.uid);
          actionCommentsIdx.push(i);
          replied_to = tmpRepliedTo;
          if (thread_root_comment_id && thread_root_comment_id == tmpComment.uid) {
            break;
          }
        } else if (actionComments.length >= 1) {
          hideComments[tmpComment.uid] = true;
          if (!displayViewAllBtn) displayViewAllBtn = true;
        }
      }

      if (actionComments.length < LATEST_COMMENTS_ONLY_COUNT) {
        // Angular shows banner; here we just abort playback and show all
        setThreadPlayback(emptyThreadPlayback);
        return;
      }

      if (scrollToBottom && commentsContainerRef.current) {
        commentsContainerRef.current.scrollTop = commentsContainerRef.current.scrollHeight;
      }

      const timer = displayViewAllBtn ? 600 : 0;

      // eventArray => show "View all comments" buttons for gaps
      const showAllButtonForSource: Record<string, boolean> = {};
      const threadBPad: Record<string, boolean> = {};
      const threadTPad: Record<string, boolean> = {};

      if (displayViewAllBtn) {
        const eventArray: Array<{ source_cid: string; dest_cid: string; show_pad: boolean }> = [];
        for (let i = actionCommentsIdx.length - 1; i > 0; i--) {
          if (
            actionCommentsIdx[i] >= 0 &&
            actionCommentsIdx[i - 1] &&
            actionCommentsIdx[i - 1] - actionCommentsIdx[i] > 1
          ) {
            eventArray.push({
              source_cid: actionComments[i],
              dest_cid: actionComments[i - 1],
              show_pad: false,
            });
          }
        }

        if (eventArray.length > 1) {
          eventArray[eventArray.length - 1].show_pad = true;
        }

        eventArray.forEach((e) => {
          showAllButtonForSource[e.source_cid] = true;
          threadBPad[e.source_cid] = true;
          if (e.show_pad) {
            threadTPad[e.dest_cid] = true;
          }
        });
      }

      // Apply hide first (timer/2), then pointers (timer)
      window.setTimeout(() => {
        setThreadPlayback((prev) => ({
          ...prev,
          active: true,
          hidden: hideComments,
          showAllButtonForSource,
          threadBPad,
          threadTPad,
        }));
      }, timer / 2);

      window.setTimeout(() => {
        const repliedPointers: Record<string, boolean> = {};
        const sourcePointers: Record<string, boolean> = {};

        actionComments.slice(0, -1).forEach((id) => {
          repliedPointers[id] = true;
        });
        actionComments.slice(1).forEach((id) => {
          sourcePointers[id] = true;
        });

        setThreadPlayback({
          active: true,
          currentlyPlayingSnippetForComment: actionComments[1] || null,
          hidden: hideComments,
          repliedPointers,
          sourcePointers,
          showAllButtonForSource,
          threadBPad,
          threadTPad,
        });

        // Mirrors Angular: $broadcast('Comments:highlightText', actionComments[1], data.snippet_data)
        const snippetObj = collaborationInfo?.snippet_data;
        const sd = snippetObj?.data || snippetObj?.snippetData?.data || snippetObj?.snippetData || null;
        const highlightCommentId = actionComments[1];
        if (sd && highlightCommentId && commentsContainerRef.current) {
          const commentEl = commentsContainerRef.current.querySelector(`#${CSS.escape(highlightCommentId)}`) as HTMLElement | null;
          const inner = commentEl?.querySelector('.comment_txt .comment-inner') as HTMLElement | null;
          if (inner) {
            rmAllSelections();
            selectTextNested({
              commentId: highlightCommentId,
              data: sd,
              nodes: inner,
              scrollContainer: commentsContainerRef.current,
              highlight: true,
              highlightRemoveTime: null,
              selectionOffset: 10,
              getContent: () => inner.innerText.replace(/\n/g, ''),
            });
          }
        }

        // bring start of thread in view (matches Angular)
        window.setTimeout(() => {
          const threadStartId = actionComments[actionComments.length - 1];
          if (threadStartId && !checkIfCommentIsInView(threadStartId)) {
            bringCommentInView(threadStartId);
          }
        }, 0);
      }, timer);
    };

    const localHasRepliedTo = allComments.some((c) => c.uid == collaborationInfo.replied_to_comment_id);

    if (localHasRepliedTo) {
      // Determine if first comment of thread exists; if not, fetch all (matches Angular logic)
      let commentId: string | null = collaborationInfo.replied_to_comment_id;
      let lastCommentId: string = commentId;

      for (let idx = allComments.length - 1; idx >= 0; idx--) {
        const c: any = allComments[idx];
        if (c.uid == commentId) {
          const next = c?.resource_link?.collaboration_info?.replied_to_comment_id;
          if (next) {
            commentId = next;
            lastCommentId = next;
          } else {
            commentId = null;
          }
        }
      }

      const doFetchComments = commentId != null;
      const isVisibleInDom =
        commentsContainerRef.current?.querySelector(`#${CSS.escape(lastCommentId)}`) != null;

      if (!doFetchComments && isVisibleInDom) {
        startPlaybackSequence(allComments);
      } else {
        // Expand and fetch as needed
        const fetched = await fetchAllFromServer(doFetchComments);
        startPlaybackSequence(fetched, true);
      }
    } else {
      const fetched = await fetchAllFromServer(true);
      startPlaybackSequence(fetched, true);
    }
  };

  const handleCommentUpdated = (updatedComment: any) => {
    // CommentItem handles its own local state update
    // This callback can be used for parent-level updates if needed
    // For now, local state in CommentItem provides immediate UI feedback
  };

  const handleCommentDeleted = (commentId: string) => {
    // CommentItem marks the comment as deleted in its local state
    // This provides immediate UI feedback
    // Parent can handle query invalidation if needed
  };

  const handleCommentPosted = async (newComment: any) => {
    // Matches AngularJS cnvFeedItem.commentPosted behavior
    // After posting a comment, AngularJS calls pollFeed to refresh the feed
    // IMPORTANT: Do NOT automatically expand comments panel - it should only expand when user clicks the comments link/button
    if (newComment) {
      // Only update count and scroll if comments are already expanded
      // Do NOT expand the panel automatically (matches AngularJS behavior)
      if (commentsExpanded && loadedCommentsCount > LATEST_COMMENTS_ONLY_COUNT) {
        setLoadedCommentsCount(loadedCommentsCount + 1);
        
        // Scroll to bottom after a short delay (matches AngularJS)
        setTimeout(() => {
          if (commentsContainerRef.current) {
            commentsContainerRef.current.scrollTop = commentsContainerRef.current.scrollHeight;
          }
        }, 100);
      }
      // If comments are not expanded, do nothing - user must click the comments link to expand
      
      // Call feed poll API to refresh the feed (matches AngularJS $rootScope.$broadcast('pollFeedRequest'))
      // The poll response will include updated feed items with conversations/comments
      // The feed cache update in useFeedPoll will merge the new data, and useEffect above will update comments
      try {
        const pollResponse = await feedPoll.mutateAsync({ lastPollTimestamp: undefined });
        
        // Find the updated feed item in the poll response
        if (pollResponse?.feed_items) {
          const updatedItem = pollResponse.feed_items.find(
            (feedItem: FeedItem) => feedItem.feed_id === item.feed_id
          );
          
          if (updatedItem && updatedItem.conversations) {
            // Merge comments from poll response (matches AngularJS updateCommentsDataReceivedInFeedPoll)
            // Deduplicate by uid to avoid duplicate keys
            setAllComments((prevComments) => {
              // Create a map of existing comments by uid
              const existingCommentsMap = new Map(prevComments.map(c => [c.uid, c]));
              
              // Update or add comments from poll response
              updatedItem.conversations.forEach((comment: Comment) => {
                if (comment.uid) {
                  existingCommentsMap.set(comment.uid, comment);
                }
              });
              
              // Convert back to array and sort by timestamp
              const mergedComments = Array.from(existingCommentsMap.values());
              return sortCommentsByTimestamp(mergedComments);
            });
            
            // Update loaded count if comments are already expanded
            if (commentsExpanded && updatedItem.conversations_count !== undefined) {
              setLoadedCommentsCount(Math.max(loadedCommentsCount, updatedItem.conversations_count));
              
              // Scroll to bottom to show the new comment (only if panel is expanded)
              setTimeout(() => {
                if (commentsContainerRef.current) {
                  commentsContainerRef.current.scrollTop = commentsContainerRef.current.scrollHeight;
                }
              }, 100);
            }
          }
        }
        
        // Also invalidate feed query to ensure fresh data
        queryClient.invalidateQueries({ queryKey: ['feed'] });
      } catch (error) {
        console.error('Failed to poll feed after posting comment:', error);
      }
    }
  };

  const handleCommentWillPost = (optimisticComment: any) => {
    // Mirrors AngularJS commentsService.initNewComment optimistic insertion
    setAllComments((prev) => sortCommentsByTimestamp([...prev, optimisticComment]));
    setLocalTotalComments((prev) => prev + 1);

    // Mirrors cnvFeedItem.commentPosted behavior: if expanded beyond latest-2, increment and scroll bottom
    if (commentsExpanded && loadedCommentsCount > LATEST_COMMENTS_ONLY_COUNT) {
      setLoadedCommentsCount((c) => c + 1);
      setTimeout(() => scrollToBottom(true), 100);
    }
  };

  const handleCommentPostFailed = (conversationUID: string) => {
    setAllComments((prev) =>
      prev.map((c: any) =>
        c.uid === conversationUID
          ? { ...c, is_posting: false, posting_failed: true, update_timestamp: Date.now() }
          : c
      )
    );
  };

  const retryFailedPostComment = async (comment: any) => {
    if (!loginData || !user || !account) return;
    const userId = (user as any).user_id || (user as any).userId;
    const accountId = (account as any).account_id;
    const authToken = loginData.xmpp_session_token;

    setAllComments((prev) =>
      prev.map((c: any) =>
        c.uid === comment.uid ? { ...c, is_posting: true, posting_failed: false } : c
      )
    );

    try {
      await commentsService.postComment(
        comment.comment_text,
        item.feed_id || null,
        item.resource_id,
        item.resource_type || '',
        item.app_instance_id,
        false,
        null,
        null,
        null,
        null,
        authToken,
        userId,
        accountId,
        item.hierarchy as any,
        comment.resource_link?.collaboration_info || null,
        null,
        comment.uid
      );
      // Let poll merge replace the optimistic comment; mark posting=false for immediate UX
      setAllComments((prev) =>
        prev.map((c: any) =>
          c.uid === comment.uid ? { ...c, is_posting: false, posting_failed: false } : c
        )
      );
    } catch (e) {
      console.error('Retry failed:', e);
      setAllComments((prev) =>
        prev.map((c: any) =>
          c.uid === comment.uid ? { ...c, is_posting: false, posting_failed: true } : c
        )
      );
    }
  };

  const discardFailedPostComment = (commentId: string) => {
    setAllComments((prev) => prev.filter((c) => c.uid !== commentId));
    setLocalTotalComments((prev) => Math.max(0, prev - 1));
  };

  // ScrollPosition restore (mirrors Angular ScrollPosition.restore after we increase loadedCommentsCount or merge more comments)
  useEffect(() => {
    const container = commentsContainerRef.current;
    if (!container) return;
    if (!commentsExpanded) return;
    if (!scrollRestoreRef.current) return;

    const prev = scrollRestoreRef.current.prevScrollHeightMinusTop;
    scrollRestoreRef.current = null;

    // Restore on next tick after DOM updates
    setTimeout(() => {
      const c = commentsContainerRef.current;
      if (!c) return;
      c.scrollTop = c.scrollHeight - prev;
    }, 0);
  }, [commentsExpanded, loadedCommentsCount, allComments.length]);

  // Infinite scroll: load more comments when scrolling to top (mirrors Angular loadMoreComments + ScrollPosition.prepareFor('up'))
  useEffect(() => {
    const container = commentsContainerRef.current;
    if (!container || !commentsExpanded) return;
    if (!loginData || !user || !account) return;

    const userId = (user as any).user_id || (user as any).userId;
    const accountId = (account as any).account_id;
    const authToken = loginData.xmpp_session_token;

    const isNearBottom = () => {
      return (container.scrollHeight - container.scrollTop - 30) <= container.clientHeight;
    };

    const updateShadows = () => {
      // Mirrors Angular drawShadowsIfScrollable
      if (container.scrollHeight >= 435) {
        const scrollTop = container.scrollTop;
        const atTop = scrollTop <= 0;
        const atBottom = scrollTop + container.clientHeight + 2 >= container.scrollHeight;
        setShadowBottom(!atBottom);
        setShadowTop(!atTop);
      } else {
        setShadowBottom(false);
        setShadowTop(false);
      }
    };

    const maybeLoadMore = async () => {
      if (loadingComments) return;
      if (loadedCommentsCount >= totalComments) return;

      // Prepare scroll restore (Angular ScrollPosition.prepareFor('up'))
      scrollRestoreRef.current = { prevScrollHeightMinusTop: container.scrollHeight - container.scrollTop };

      const desired = Math.min(loadedCommentsCount + PAGE_SIZE, totalComments);
      const missing = Math.max(0, desired - allComments.length);

      // If our local store doesn't have enough comments yet, fetch the missing chunk from server.
      if (missing > 0) {
        setLoadingComments(true);
        try {
          const res = await commentsService.getComments_newApi(
            item.feed_id || null,
            item.resource_id,
            item.app_instance_id,
            true,
            allComments.length,
            missing,
            authToken,
            userId,
            accountId
          );

          const existingMap = new Map(allComments.map((c) => [c.uid, c]));
          (res.data.comments || []).forEach((c) => {
            if (c.uid) existingMap.set(c.uid, c);
          });
          const merged = sortCommentsByTimestamp(Array.from(existingMap.values()));
          setAllComments(merged);
        } catch (e) {
          console.error('Failed to load more comments:', e);
          // On failure, cancel scroll restore to avoid jump
          scrollRestoreRef.current = null;
        } finally {
          setLoadingComments(false);
        }
      }

      setLoadedCommentsCount(desired);
    };

    const handleScroll = () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
      loadTimeoutRef.current = setTimeout(() => {
        updateShadows();
        if (showNewCommentsBadge && isNearBottom()) {
          // Hide badge when user reaches bottom (matches Angular scrollHandlerForNewComment)
          setBadgeAnimClass('new-comments-badge-leave-sequence');
          setTimeout(() => {
            setShowNewCommentsBadge(false);
            setBadgeAnimClass('');
          }, 400);
        }

        // Load more when user reaches near top
        if (container.scrollTop < 50) {
          void maybeLoadMore();
        }
      }, 50);
    };

    container.addEventListener('scroll', handleScroll);
    // Initial evaluation
    updateShadows();

    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
  }, [commentsExpanded, loadedCommentsCount, totalComments, loadingComments, allComments.length, loginData, user, account, showNewCommentsBadge, item.feed_id, item.resource_id, item.app_instance_id]);

  // New comments badge behavior (mirrors Angular render handler)
  useEffect(() => {
    const newTotal = item.conversations_count || 0;
    const prevTotal = prevTotalCommentsRef.current;
    prevTotalCommentsRef.current = newTotal;
    setLocalTotalComments(newTotal);

    if (!commentsExpanded) return;
    if (!commentsContainerRef.current) return;
    if (newTotal <= prevTotal) return;

    const last = allComments[allComments.length - 1];
    const currentUserId = (user as any)?.user_id || (user as any)?.userId;
    if (last && currentUserId && last.from_user === currentUserId) {
      return;
    }

    const container = commentsContainerRef.current;
    const isNearBottom = (container.scrollHeight - container.scrollTop - 30) <= container.clientHeight;
    if (!isNearBottom) {
      setTimeout(() => {
        setShowNewCommentsBadge(true);
        setBadgeAnimClass('new-comments-badge-enter-sequence');
      }, 800);
    }
  }, [item.conversations_count, commentsExpanded, allComments.length, user]);

  return (
    <div 
      className="comments-panel-wrapper l-pad"
      style={{
        marginTop: '5px',
        marginBottom: '7px',
        position: 'relative',
        background: '#f2f4f8',
        borderRadius: '3px',
        padding: '0px',
      }}
    >
      {/* Likes Count Container */}
      {item.like_info.likes_count > 0 && (
        <div className="likes-count-container" style={{
          borderBottom: '1px solid #e2e5ea',
          borderTop: '1px solid transparent',
          padding: '9px 10px',
          margin: '0px 10px',
        }}>
          <i className="cnv-icons-20 icons2_Like-darkgray" style={{
            verticalAlign: 'bottom',
            position: 'relative',
            top: '-2px',
            opacity: 0.5,
            display: 'inline-block',
          }}></i>
          {item.like_info.liked_by && (
            <>
              <a 
                href={`#/feed?filter=user:${item.like_info.liked_by}`}
                style={{
                  marginLeft: '10px',
                  color: '#7b8386',
                  textDecoration: 'none',
                }}
              >
                {getUserName(users, item.like_info.liked_by)}
              </a>
              {item.like_info.likes_count > 1 && (
                <>
                  <span style={{ color: '#7b8386' }}>, </span>
                  <a 
                    href="#"
                    style={{
                      color: '#7b8386',
                      textDecoration: 'none',
                    }}
                  >
                    +{item.like_info.likes_count - 1} more
                  </a>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Comments Info Bar */}
      {totalComments > LATEST_COMMENTS_ONLY_COUNT && (
        <div 
          className={`bar comments_info ${shadowBottom ? 'shadow-bottom' : ''} ${commentsExpanded ? 'b-pad' : ''}`}
          style={{
            padding: '9px 10px 0px 10px',
            margin: '0px 10px',
            position: 'relative',
          }}
        >
          <i className="cnv-icons-16 icons_Comments-darkgray" style={{
            verticalAlign: 'middle',
            opacity: 0.7,
            display: 'inline-block',
          }}></i>
          {loadedCommentsCount <= LATEST_COMMENTS_ONLY_COUNT ? (
            <>
              {loadingComments && (
                <span className="fetch-more-spinner" style={{
                  marginLeft: '10px',
                  display: 'inline-block',
                }}>
                  <span style={{
                    display: 'inline-block',
                    width: '12px',
                    height: '12px',
                    border: '2px solid #f3f3f3',
                    borderTop: '2px solid rgb(51, 113, 189)', // Theme color
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }}></span>
                </span>
              )}
              <a 
                onClick={(e) => {
                  e.preventDefault();
                  loadAllComments();
                }}
                href="#"
                className="hover_underline"
                style={{
                  marginLeft: '10px',
                  color: 'rgb(51, 113, 189)', // Theme color
                  textDecoration: 'none',
                  cursor: loadingComments ? 'wait' : 'pointer',
                }}
                onMouseEnter={(e) => {
                  if (!loadingComments) {
                    e.currentTarget.style.textDecoration = 'underline';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = 'none';
                }}
              >
                {totalComments} comments
              </a>
            </>
          ) : (
            <a 
              onClick={(e) => {
                e.preventDefault();
                showLatestCommentsOnly();
              }}
              href="#"
              className="hover_underline"
              style={{
                marginLeft: '10px',
                color: 'rgb(51, 113, 189)', // Theme color
                textDecoration: 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.textDecoration = 'underline';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.textDecoration = 'none';
              }}
            >
              Hide comments
            </a>
          )}
        </div>
      )}

      {/* Comments Collection */}
      <div 
        ref={commentsContainerRef}
        className={`comments-collection comments-scrollable-panel ${commentsExpanded ? 'expanded' : ''}`}
        style={{
          position: 'relative',
          maxHeight: commentsExpanded ? '435px' : 'auto',
          overflowY: commentsExpanded ? 'auto' : 'hidden',
          overflowX: 'hidden',
          padding: '0px 10px',
          marginRight: '2px',
        }}
      >
        {displayedComments.map((comment) => (
          <CommentItem 
            key={comment.uid} 
            comment={comment}
            resourceId={item.resource_id}
            appInstanceId={item.app_instance_id}
            onReplyClick={handleReplyClick}
            onCreateSnippetReply={(snippetWrapper, collaborationInfo) => {
              // Prefill with @mention (Angular uses Quill <a>, we use plain text)
              let initialText = '';
              if (collaborationInfo?.replied_to_user_id) {
                const replyUser = users[collaborationInfo.replied_to_user_id];
                const userName =
                  (replyUser as any)?.name ||
                  (((replyUser as any)?.first_name || (replyUser as any)?.firstName || '') +
                    ' ' +
                    ((replyUser as any)?.last_name || (replyUser as any)?.lastName || '')).trim();
                const name = (userName || collaborationInfo.replied_to_user_id).trim();
                initialText = `@${name} `;
              }
              setSnippetReply(snippetWrapper, collaborationInfo, initialText);
            }}
            onViewThread={handleReplyCommentPlayback}
            onHideThread={handleUnHideAll}
            onPostSnippetPlayback={onPostSnippetPlayback}
            threadPlayback={{
              active: threadPlayback.active,
              currentlyPlayingSnippetForComment: threadPlayback.currentlyPlayingSnippetForComment,
              isSourcePointer: !!threadPlayback.sourcePointers[comment.uid],
              isRepliedPointer: !!threadPlayback.repliedPointers[comment.uid],
              isThreadBPad: !!threadPlayback.threadBPad[comment.uid],
              isThreadTPad: !!threadPlayback.threadTPad[comment.uid],
              showViewAllButton: !!threadPlayback.showAllButtonForSource[comment.uid],
            }}
            isHiddenByThreadPlayback={!!threadPlayback.hidden[comment.uid]}
            onRetryFailedPost={retryFailedPostComment}
            onDiscardFailedPost={discardFailedPostComment}
            onCommentUpdated={handleCommentUpdated}
            onCommentDeleted={handleCommentDeleted}
            relatedPermissions={{ canComment: true }}
          />
        ))}
      </div>

      {/* Comment Editor - Always show (matches AngularJS) */}
      <div 
        className={`feed-comment-editor l-pad r-pad ${shadowTop ? 'shadow-top' : ''}`}
        style={{
          paddingBottom: '10px',
          paddingTop: '10px',
          position: 'relative',
          paddingLeft: '10px',
          paddingRight: '10px',
        }}
      >
        <div
          className={`new-comments-badge ${badgeAnimClass}`}
          style={{ display: showNewCommentsBadge ? 'block' : 'none' }}
          onClick={() => scrollToBottom(true)}
        >
          <span>New Comments</span>
        </div>
        <CommentEditor
          ref={commentEditorRef}
          resourceId={item.resource_id}
          appInstanceId={item.app_instance_id}
          feedId={item.feed_id}
          resourceType={item.resource_type}
          hierarchy={item.hierarchy}
          replyEventData={replyEventData}
          snippetData={editorSnippetData}
          collaborationInfo={editorCollaborationInfo}
          onSnippetCleared={() => {
            setEditorSnippetData(null);
            setEditorCollaborationInfo(null);
          }}
          onReplyContextCleared={() => setReplyEventData(null)}
          onCommentWillPost={handleCommentWillPost}
          onCommentPostFailed={(conversationUID) => handleCommentPostFailed(conversationUID)}
          onCommentPosted={handleCommentPosted}
          relatedPermissions={{ canComment: true }}
        />
      </div>
    </div>
  );
}
