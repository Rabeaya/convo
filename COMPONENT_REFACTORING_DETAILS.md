# Component Refactoring Details - Strict 1:1 Migration

## Summary

This document outlines the exact changes needed to achieve a 1:1 migration of Feed and Comments from AngularJS to React/Next.js.

## 1. CommentsPanel Component (`components/feed/CommentsPanel.tsx`)

### Current Issues:
- Missing exact threading logic (recursive comment traversal)
- Missing "View thread" / "Hide thread" functionality
- Incorrect comment loading logic (should use `LATEST_COMMENTS_ONLY_COUNT = 2`, not 3)
- Missing scroll position management
- Missing event-driven thread playback
- Missing exact scroll handling for loading more comments

### Required Changes:

#### Constants (from AngularJS):
```typescript
const LATEST_COMMENTS_ONLY_COUNT = 2; // NOT 3!
const PAGE_SIZE = 10;
```

#### Thread Building Logic (from `cnvCommentsPanel.js` lines 113-132):
```typescript
function buildThread(
  comments: Comment[],
  currentCommentId: string,
  repliedToCommentId: string,
  threadRootCommentId: string
): {
  actionComments: string[];
  actionCommentsIdx: number[];
  hideComments: Record<string, boolean>;
  displayViewAllBtn: boolean;
} {
  const actionComments: string[] = [];
  const actionCommentsIdx: number[] = [];
  const hideComments: Record<string, boolean> = {};
  let displayViewAllBtn = false;
  let replied_to = repliedToCommentId;

  // Walk backwards through comments (from end to start)
  for (let i = comments.length - 1; i >= 0; i--) {
    const tmpComment = comments[i];

    // Recursively check replied_to_comment_id to make thread
    if (
      replied_to === tmpComment.uid ||
      currentCommentId === tmpComment.uid ||
      currentCommentId === tmpComment.resource_link?.collaboration_info?.replied_to_comment_id
    ) {
      actionComments.push(tmpComment.uid);
      actionCommentsIdx.push(i);
      
      if (tmpComment.resource_link?.collaboration_info?.replied_to_comment_id) {
        replied_to = tmpComment.resource_link.collaboration_info.replied_to_comment_id;
      }

      if (threadRootCommentId === tmpComment.uid) {
        break;
      }
    } else if (actionComments.length >= 1) {
      hideComments[tmpComment.uid] = true;
      if (!displayViewAllBtn) {
        displayViewAllBtn = true;
      }
    }
  }

  return { actionComments, actionCommentsIdx, hideComments, displayViewAllBtn };
}
```

#### Scroll Position Management (from `cnvCommentsPanel.js` lines 17-32):
```typescript
class ScrollPosition {
  node: HTMLElement;
  previousScrollHeightMinusTop: number;
  readyFor: 'up' | 'down';

  constructor(node: HTMLElement) {
    this.node = node;
    this.previousScrollHeightMinusTop = 0;
    this.readyFor = 'up';
  }

  restore() {
    if (this.readyFor === 'up') {
      this.node.scrollTop = this.node.scrollHeight - this.previousScrollHeightMinusTop;
    }
  }

  prepareFor(direction: 'up' | 'down' = 'up') {
    this.readyFor = direction;
    this.previousScrollHeightMinusTop = this.node.scrollHeight - this.node.scrollTop;
  }
}
```

#### Scroll Handler for Loading More Comments (from `cnvCommentsPanel.js` lines 480-502):
```typescript
// When scrolling near top (scrollTop < 50), load more comments
const scrollHandler = (e: Event) => {
  if (loadTimeoutRef.current) {
    clearTimeout(loadTimeoutRef.current);
  }

  loadTimeoutRef.current = setTimeout(() => {
    const container = commentsContainerRef.current;
    if (!container || !commentsExpanded) return;

    if (container.clientHeight >= 435) {
      const scrollTop = container.scrollTop;
      if (scrollTop < 50) {
        scrollPosition.prepareFor('up');
        setLoadedCommentsCount(prev => prev + PAGE_SIZE);
        scrollPosition.restore();
      }
    }
  }, 50);
};
```

#### Thread Playback Handler (from `cnvCommentsPanel.js` lines 74-224):
- Listen for `Comment:ReplyCommentPlayback` event
- Build thread using `buildThread` function
- Show/hide comments based on thread
- Add visual indicators (source-comment-pointer, replied-comment-pointer)
- Handle "View all comments" button display

### UI Structure (from `cnvFeedItem.tpl.html` lines 312-343):
```tsx
<div className="comments-panel-wrapper l-pad">
  {/* Likes count container */}
  {item.like_info.likes_count + item.like_info.sub_res_like_count > 0 && (
    <div className="likes-count-container">
      <i className="cnv-icons-20 icons2_Like-darkgray" style={{ opacity: 0.5 }}></i>
      <a href={`#/feed?filter=user:${item.like_info.liked_by}`}>
        {getNameById(users, groups, item.like_info.liked_by)}
      </a>
      {totalLikes > 1 && (
        <>
          <span>, </span>
          <a href="javascript:void(0)" onClick={openLikeInfoModal}>
            +{totalLikes - 1} more
          </a>
        </>
      )}
    </div>
  )}

  {/* Comments info bar */}
  {totalComments > LATEST_COMMENTS_ONLY_COUNT && (
    <div className={`bar comments_info ${commentsExpanded ? 'b-pad' : ''}`}>
      <i className="cnv-icons-16 icons_Comments-darkgray" style={{ opacity: 0.7 }}></i>
      {loadedCommentsCount <= LATEST_COMMENTS_ONLY_COUNT ? (
        <a onClick={loadAllComments} href="javascript:void(0)">
          {totalComments} comments
        </a>
      ) : (
        <a onClick={showLatestCommentsOnly} href="javascript:void(0)">
          Hide comments
        </a>
      )}
    </div>
  )}

  {/* Comments collection */}
  <div className={`comments-collection comments-scrollable-panel ${commentsExpanded ? 'expanded' : ''}`}>
    {displayedComments.map((comment) => (
      <CommentItem
        key={comment.uid}
        comment={comment}
        item={item}
        isHidden={hideComments[comment.uid]}
        isThreadSource={actionComments.includes(comment.uid)}
        isThreadReplied={actionComments.includes(comment.uid)}
        onReplyClick={handleReplyClick}
        onViewThread={handleViewThread}
        onHideThread={handleHideThread}
      />
    ))}
  </div>

  {/* Comment editor */}
  <div className="feed-comment-editor l-pad r-pad">
    <div className="new-comments-badge" onClick={() => scrollToBottom(true)}>
      <span>New Comments</span>
    </div>
    {/* Comment editor component */}
  </div>
</div>
```

## 2. CommentItem Component (`components/feed/CommentItem.tsx`)

### Required Changes:

#### Thread Display Logic:
- Show "View thread" button if `comment.resource_link.collaboration_info.replied_to_user_id` exists AND `comment.thread_root_comment_id` exists AND `!currentlyPlayingCommentSnippet`
- Show "Hide thread" button if `currentlyPlayingCommentSnippet` is true
- Show reply arrow if `comment.resource_link.collaboration_info.replied_to_user_id` exists

#### Action Line Structure (from `cnvComment.tpl.html` lines 132-184):
```tsx
<div className="action_line">
  <span className="meta comment_info">
    <a className="meta" href={`#/feed?filter=user:${comment.from_user}`}>
      {getUserName(users, comment.from_user)}
    </a>
    {!comment.is_posting && (
      <>
        <span style={{ color: '#959595' }}>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
        {comment.update_kind === 2 ? (
          <span>deleted&nbsp;&nbsp;•</span>
        ) : (
          <>
            <a className="meta" href={getCommentUrl(comment)}>
              {comment.update_timestamp > comment.creation_timestamp ? 'edited' : ''}
            </a>
            <a className="time hover_underline meta" href={getCommentUrl(comment)}>
              {formatDateAgo(comment.update_timestamp)}
            </a>
          </>
        )}
      </>
    )}
  </span>

  {/* Reply button */}
  {relatedPermissions.canComment && comment.update_kind !== 2 && (
    <>
      <span style={{ color: '#959595' }}>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
      <a href="javascript:void(0)" onClick={handleReplyClick} className="reply-btn hover_underline">
        Reply
      </a>
    </>
  )}

  {/* Like button */}
  {!comment.is_posting && comment.update_kind !== 2 && (
    <>
      <span style={{ color: '#959595' }}>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
      <LikeButton likeInfo={comment.like_info} onLikeClick={handleLikeClick} />
      {comment.like_info.likes_count > 0 && (
        <>
          <span style={{ color: '#959595' }}>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
          <span className="likes_count" onClick={openLikeInfoModal}>
            <i className="cnv-icons-15 icons2_Like-darkgray" style={{ opacity: 0.7 }}></i>
            &nbsp;
            <span className="count">{comment.like_info.likes_count}</span>
          </span>
        </>
      )}
    </>
  )}

  {/* View thread / Hide thread */}
  {comment.resource_link?.collaboration_info?.replied_to_user_id &&
    !currentlyPlayingCommentSnippet &&
    comment.thread_root_comment_id && (
      <>
        <span style={{ color: '#959595' }}>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
        <span className="reply-btn hover_underline thread-control" onClick={handleViewThread}>
          View thread
        </span>
      </>
    )}
  {comment.resource_link?.collaboration_info?.replied_to_user_id &&
    currentlyPlayingCommentSnippet && (
      <>
        <span style={{ color: '#959595' }}>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
        <span className="reply-btn hover_underline thread-control" onClick={handleHideThread}>
          Hide thread
        </span>
      </>
    )}
</div>
```

#### Comment Text Display (from `cnvComment.js` lines 149-188):
- Show `comment.comment_text_less` or `comment.summary` if available
- Show "more" link if text is truncated
- Show "less" link when expanded
- Handle snippet data display

#### Edit/Delete Functionality:
- Edit: Opens comment editor with current text, files, and snippet data
- Delete: Shows confirmation modal, then calls `commentsService.deleteComment`
- Both use exact API payloads from AngularJS

## 3. FeedItem Component (`components/feed/FeedItem.tsx`)

### Required Changes:

#### Shared With Container (from `cnvFeedItem.tpl.html` lines 26-58):
- Exact spacing: No space before "To", space after "To" before first share link
- Show first 2 sharing info items
- Show "+X more" if more than 2
- Exact color: `#959595` for "To" and commas
- Exact color: `#339fb8` for links

#### Action Items (from `cnvFeedItem.tpl.html` lines 276-310):
- Comment button with exact styling
- Like button with exact styling
- Tags dropdown with exact styling
- Exact spacing with `&nbsp;&nbsp;•&nbsp;&nbsp;` separators

#### Comments Panel Integration:
- Pass exact props to CommentsPanel
- Handle comments expansion/collapse
- Maintain exact state management

## 4. CSS Styles

### Required CSS Classes (from `feedMain.less` and `feed.less`):

```css
.comments-panel-wrapper {
  /* Exact styles from AngularJS */
}

.comment-cont {
  background-color: #f2f4f8;
  position: relative;
}

.comment-cont.source-comment-pointer {
  /* Thread source indicator styles */
}

.comment-cont.replied-comment-pointer {
  /* Thread reply indicator styles */
}

.comment {
  position: relative;
  padding: 10px 0px;
  border-bottom: 1px solid #e0e0e0;
  width: 473px;
}

.comment_txt {
  word-wrap: break-word;
  overflow: hidden;
  position: relative;
  display: block;
}

.action_line {
  color: #596d97;
  margin: 4px 0 0 0;
}

.reply-arrow {
  width: 13px;
  height: 5px;
  background: url(/assets/img/common/reply_arrow.png);
  background-size: 13px 5px;
  display: inline-block;
  vertical-align: middle;
  float: left;
  margin-top: 8px;
  margin-right: 4px;
}
```

## 5. State Management

### Event System:
- Use React Context or EventEmitter for cross-component communication
- Emit events: `Comment:ReplyCommentPlayback`, `Comments:unHideAll`, `Comments:showAll`
- Listen for events: `Comment:ReplyCommentPlayback`, `Comments:hideCommentsForReplySnippetPlayback`

### Optimistic Updates:
- Update UI immediately on like/edit/delete
- Rollback on error
- Match AngularJS rollback logic exactly

## Next Steps

1. ✅ Create comments API service
2. ✅ Create API proxy routes
3. ⏳ Refactor CommentsPanel with exact threading logic
4. ⏳ Refactor CommentItem with exact reply/thread UI
5. ⏳ Refactor FeedItem with exact styling
6. ⏳ Apply exact CSS styles
7. ⏳ Implement event-driven state management
8. ⏳ Test and verify 1:1 match

