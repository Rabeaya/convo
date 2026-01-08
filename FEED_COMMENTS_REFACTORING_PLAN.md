# Feed and Comments 1:1 Migration Plan

## Key Findings from AngularJS Code

### 1. API Endpoints and Payloads

#### getComments_newApi
```javascript
Comments.getComments_newApi(feed_id, resource_id, app_instance_id, loadAll, fromIndex, count)
```
- `feed_id`: Can be null
- `loadAll`: Boolean - if true, loads all comments
- `fromIndex`: Starting index (0-based)
- `count`: Number of comments to fetch (null = all)

#### editComment
```javascript
Comments.editComment(conversationUID, citem_uid, commentText, resourceId, appInstanceId, 
                     attachContext, snippetData, onCommentAttachment, attachedFiles, link, commentData)
```
Request payload:
```javascript
{
  method: "updateComment",
  conversation_uid: conversationUID,
  citem_uid: citem_uid,
  comment_text: commentText,
  resource_id: resourceId,
  app_instance_id: appInstanceId,
  collaboration_info: {
    snippet_data: snippetData,
    parent_resource_index: 0,
    replied_to_comment_id: ...,
    replied_to_user_id: ...
  },
  files: attachedFiles.serverData,
  url_to_resolve: link?.url_to_resolve
}
```

#### deleteComment
```javascript
Comments.deleteComment(conversationUID, resourceId, appInstanceId)
```
Request payload:
```javascript
{
  method: "deleteComment",
  conversation_uid: conversationUID,
  resource_id: resourceId,
  app_instance_id: appInstanceId
}
```

#### likeConversation
```javascript
likesService.likeConversation(conversation_uid, resource_id, app_instance_id, action)
```
Request payload:
```javascript
{
  conversation_id: conversation_uid,  // Note: conversation_id, not conversation_uid
  action: action  // 'like' or 'unlike'
}
```

### 2. Comment Threading Logic

Threading uses:
- `thread_root_comment_id`: ID of the root comment in the thread
- `replied_to_comment_id`: ID of the comment being replied to (in `resource_link.collaboration_info`)
- `replied_to_user_id`: ID of the user being replied to

Thread building algorithm (from `cnvCommentsPanel.js`):
1. Start from the current comment
2. Walk backwards through comments array
3. For each comment, check if:
   - `replied_to == tmpComment.uid` OR
   - `currentCommentId == tmpComment.uid` OR
   - `currentCommentId == tmpComment.resource_link.collaboration_info.replied_to_comment_id`
4. If match, add to `actionComments` array
5. Update `replied_to` to `tmpComment.resource_link.collaboration_info.replied_to_comment_id`
6. Stop when `thread_root_comment_id == tmpComment.uid`
7. Hide all comments not in the thread

### 3. State Management Patterns

- **Optimistic Updates**: Update UI immediately, rollback on error
- **Event-Driven**: Uses Backbone.Events for cross-component communication
- **Reactive Updates**: AngularJS $scope for automatic re-rendering
- **Scroll Position Management**: Maintains scroll position when loading more comments

### 4. UI Constants

- `LATEST_COMMENTS_ONLY_COUNT = 2`: Initial comments to show
- `PAGE_SIZE = 10`: Comments to load per batch
- Comment width: `473px` (from LESS)
- Feed item right panel: `495px`
- Comment padding: `10px 0px`
- Comment border: `1px solid @cnv-comments-separator`

### 5. Key CSS Classes and Styles

From `feedMain.less` and `feed.less`:
- `.comment-cont`: Comment container
- `.comment`: Individual comment
- `.comment_body`: Comment body wrapper
- `.comment_txt`: Comment text container
- `.action_line`: Like/reply/thread controls
- `.reply-arrow`: Arrow indicator for replies
- `.source-comment-pointer`: Visual indicator for thread source
- `.replied-comment-pointer`: Visual indicator for replied comment
- `.thread-b-pad`: Bottom padding for thread
- `.thread-t-pad`: Top padding for thread

## Refactoring Steps

1. ✅ Read and understand AngularJS implementation
2. ⏳ Update API services to match exact payloads
3. ⏳ Refactor CommentsPanel with exact threading logic
4. ⏳ Refactor CommentItem with exact reply/thread UI
5. ⏳ Apply exact CSS styles
6. ⏳ Implement exact state management patterns
7. ⏳ Test and verify 1:1 match

