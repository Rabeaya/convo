# Feed & Comments Gap Analysis (AngularJS vs React Migration)

This document inventories **every Feed + Comments behavior** found in the legacy AngularJS implementation and compares it against the current React/Next implementation in `/Users/sanaullahirfan/Desktop/convo`.

**Goal**: 100% feature + visual parity (no simplification).

---

## Source of Truth (AngularJS)

- **Feed root**: `web_app/src/app/feed/cnvFeed.js`
- **Feed service**: `web_app/src/app/feed/feedService.js`
- **Feed item**: `web_app/src/app/feed/renderers/cnvFeedItem.js` + `web_app/src/app/feed/renderers/cnvFeedItem.tpl.html`
- **Feed styles**: `web_app/src/app/feed/feed.less` + `web_app/src/app/feed/styles/feedMain.less`
- **Comments panel**: `web_app/src/app/feed/renderers/comment/cnvCommentsPanel.js`
- **Comment item**: `web_app/src/app/feed/renderers/comment/cnvComment.js` + `web_app/src/app/feed/renderers/comment/cnvComment.tpl.html`
- **Comments service**: `web_app/src/app/comments/commentsService.js`
- **Comment editor**: `web_app/src/app/comments/commentEditor/cnvCommentEditor.js` + `web_app/src/app/comments/commentEditor/cnvCommentEditor.tpl.html` + `web_app/src/app/comments/commentEditor/styles.less`

---

## React Implementation (Current)

- **Feed page**: `app/feed/page.tsx`
- **Feed hook**: `lib/hooks/use-feed.ts`
- **Feed item**: `components/feed/FeedItem.tsx`
- **Comments panel**: `components/feed/CommentsPanel.tsx`
- **Comment item**: `components/feed/CommentItem.tsx`
- **Comment editor**: `components/feed/CommentEditor.tsx`
- **Comments API**: `lib/api/comments.ts`
- **Feed API**: `lib/api/feed.ts`
- **Global styles**: `app/globals.css`

---

## A) Feed: Functional Gaps

### A1) Feed scrolling + tab lifecycle (cnvFeed.js)
- **Angular**: `cnvFeed.js` manages `#feedScroller` (not window), stores `prevScrollTop`, restores scroll on tab activation, forces scrollTop=0 via a Chrome hack, and suppresses interactions when not active.
- **React**: `app/feed/page.tsx` uses window scroll fallback and simple container handling; no tab lifecycle behavior.
- **Status**: **Missing/Partial**
- **Impact**: scroll parity issues, “feed behind sidebar” issues, non-identical infinite scroll behavior.

### A2) Viewport-based GIF/video optimization (cnvFeed.js)
- **Angular**: caches element positions for items with GIFs in reel/comments and toggles their playback based on visibility.
- **React**: no equivalent.
- **Status**: **Missing**

### A3) “New posts available” tooltip + poll scheduling
- **Angular**: `pollFeed()` scheduling + UI notification (“new posts”) and click-to-scroll-top behavior.
- **React**: polling exists at data layer, but the UX notification is not implemented.
- **Status**: **Partial**

### A4) Admin mode first fetch switch
- **Angular**: first `feed/fetch` includes `switchToAdminMode` based on `userInfo.isAdminMode()`.
- **React**: not implemented in request payload.
- **Status**: **Missing**

---

## B) Feed Item: UI/Logic Gaps (cnvFeedItem.tpl.html + feed.less)

### B1) Dual avatar stack (created-by + edited-by)
- **Angular**: created-by 60x60 + edited-by 32x32 stacked (`dp-container`).
- **React**: partially implemented but not fully verified for positioning/parity.
- **Status**: **Partial**

### B2) Email integration state banner (PENDING/FAILED/DELETED)
- **Angular**: shows `.email-state-label` when `itemData.origin` and `itemData.state`.
- **React**: not implemented.
- **Status**: **Missing**

### B3) “Acknowledge” post UI (show_post_contents == 0)
- **Angular**: ack images and click-to-ack logic.
- **React**: not implemented.
- **Status**: **Missing**

### B4) Note details “more/less” + “Open post” link
- **Angular**: `VIEW_STATES.SUMMARY/COMPLETE`, ellipsis “more”, “less”, “Open post”.
- **React**: not 1:1 (some hover styling exists, but state machine not mirrored).
- **Status**: **Missing/Partial**

### B5) Rewards display on feed item header
- **Angular**: `<cnv-rewards-display>` on creator.
- **React**: not implemented.
- **Status**: **Missing**

### B6) Sharing-info “+X more” popover + modal
- **Angular**: popover tooltip + modal on click.
- **React**: currently simplified.
- **Status**: **Missing/Partial**

### B7) Pinned items + activated pinned post behavior
- **Angular**: pinned behavior + content toggles.
- **React**: partial at data level; UI parity not complete.
- **Status**: **Partial**

---

## C) Comments Panel: Functional Gaps (cnvCommentsPanel.js)

### C1) ScrollPosition preservation when fetching
- **Angular**: `ScrollPosition.prepareFor('up')` then restore after fetch (keeps content stable).
- **React**: implemented via `scrollRestoreRef` (preserves `scrollHeight - scrollTop` when increasing loaded count / fetching more).
- **Status**: **Implemented**

### C2) Shadows top/bottom based on scroll
- **Angular**: toggles `.shadow-bottom` and `.shadow-top`.
- **React**: implemented (`.comments_info.shadow-bottom` + `.feed-comment-editor.shadow-top`) in `app/globals.css` and toggled from scroll handler.
- **Status**: **Implemented**

### C3) “New comments” badge logic
- **Angular**: shows badge if new comment arrives and user isn’t at bottom; hides on scroll to bottom.
- **React**: implemented (`.new-comments-badge` + enter/leave sequences) and wired to scroll-to-bottom.
- **Status**: **Implemented**

### C4) Thread playback mode (View thread / Hide thread)
- **Angular**: hides unrelated comments via slideUp/slideDown, draws pointer rails, inserts “View all comments” gap buttons, fetches more from server if thread root isn’t present.
- **React**: implemented (state machine + fetch behavior), but still needs full animation/DOM parity for all edge cases.
- **Status**: **Implemented/Needs QA**

---

## D) Comment Item: UI/Logic Gaps (cnvComment.tpl.html + cnvComment.js + feed.less)

### D1) More/Less truncation (inline)
- **Angular**: renders both `.comment-inner.less` and `.comment-inner.full` and appends inline `more/less` spans in DOM.
- **React**: implemented basic toggle + classes, but not yet DOM-appended into the last `<p>` exactly.
- **Status**: **Partial**

### D2) Snippet playback (text selection highlight + pointers + scroll to start)
- **Angular**: `Comments:highlightText`, `textSelections.selectText`, snippet wrappers, “Comment on this” onboarding tooltips.
- **React**: not implemented.
- **Status**: **Missing**

### D3) Comment snippet renderer cases
- **Angular**: several conditional snippet blocks:
  - note text snippet
  - file snippet
  - comment snippet playback
  - image snippet with video indicator/time
- **React**: not implemented.
- **Status**: **Missing**

### D4) Posting failed UI: Retry/Delete
- **Angular**: shows “Unable to post comment. Retry • Delete”.
- **React**: not implemented.
- **Status**: **Missing**

### D5) Dropdown menu show-on-hover
- **Angular**: dropdown hidden until `.comment:hover`.
- **React**: implemented via CSS in `app/globals.css`.
- **Status**: **Implemented**

### D6) Like info modal (click likes_count)
- **Angular**: opens modal with liked-by list.
- **React**: not implemented.
- **Status**: **Missing**

---

## E) Comment Editor: Major Parity Gaps (cnvCommentEditor.tpl.html/.js)

### E1) Rich text editor parity (Quill + modules)
- **Angular**: uses `cnv-editor` (Quill) with modules:
  - @mentions (users + groups)
  - hashtags
  - emoji
  - URL resolver/link preview
  - submit-on-enter with specific key handling
- **React**: textarea-based editor; mentions implemented, but not Quill-embedded mention tokens.
- **Status**: **Missing/Partial (High impact)**

### E2) Attachment integrations + dropzone + paste
- **Angular**: attachments via UploadService + dropzone + file providers (Dropbox/Box/Google Drive) + giphy.
- **React**: partially displays attachments, but no full upload manager parity.
- **Status**: **Missing**

### E3) Permissions + alerts
- **Angular**: at-mention alert + comments-closed alert with exact messages/icons.
- **React**: minimal “comments closed” UI exists; at-mention alert not implemented.
- **Status**: **Partial**

---

## F) APIs & Data Flow Gaps

### F1) Comments store behavior
- **Angular**: maintains per-resource comments store and separate search-results store; merges feed-fetch/poll comments into store.
- **React**: relies on feed poll merge into query cache; no separate comments store.
- **Status**: **Partial**

### F2) Optimistic comment insertion (initNewComment)
- **Angular**: inserts temporary comment immediately (`is_posting: true`) then updates/marks posted.
- **React**: implemented (optimistic insert with stable `conversation_uid`, `is_posting`, `posting_failed`, retry/delete UI).
- **Status**: **Implemented**

---

## Priority Implementation Order (Next)

1. **Quill-based comment editor parity** (mentions as tokens, paste/dropzone, link preview, key handling).
2. **CommentsPanel scroll parity** (ScrollPosition restore, shadows, new comments badge).
3. **Comment snippet playback + highlight** (thread/snippet UX).
4. **Feed-level tab/scroll parity** (`#feedScroller` only, activation/restore).
5. **Feed item “more/less” + acknowledge UI**.


