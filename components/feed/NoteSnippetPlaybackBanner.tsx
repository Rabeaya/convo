'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import UserProfileImage from '@/components/common/UserProfileImage';
import { commentsService, type Comment } from '@/lib/api/comments';
import { useAuthStore } from '@/lib/stores/auth-store';
import { limitHtmlText } from '@/lib/utils/html-truncate';

type Props = {
  visible: boolean;
  feedId: string | null;
  resourceId: string;
  appInstanceId: number;
  commentId: string;
  highlightTop: number; // relative to feed-item container (Angular: snippetCoordinates.top)
  onDismiss: () => void;
  onBackToComments: () => void;
};

export default function NoteSnippetPlaybackBanner({
  visible,
  feedId,
  resourceId,
  appInstanceId,
  commentId,
  highlightTop,
  onDismiss,
  onBackToComments,
}: Props) {
  const { user, loginData, account } = useAuthStore();
  const [comment, setComment] = useState<Comment | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState<number>(0);

  useEffect(() => {
    if (!visible) return;
    // Mirrors Angular: top = coordinates.top - contHeight - 10
    setTimeout(() => {
      const h = wrapperRef.current?.getBoundingClientRect().height || 0;
      setTop(highlightTop - h - 10);
    }, 0);
  }, [visible, highlightTop]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!visible) return;
      if (!loginData || !user || !account) return;
      const userId = (user as any).user_id || (user as any).userId;
      const accountId = (account as any).account_id;
      const authToken = loginData.xmpp_session_token;
      const res = await commentsService.getComment(feedId, resourceId, appInstanceId, commentId, authToken, userId, accountId);
      if (!cancelled) setComment(res.data);
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [visible, feedId, resourceId, appInstanceId, commentId, loginData, user, account]);

  const truncatedHtml = useMemo(() => {
    if (!comment?.comment_text) return '';
    const res = limitHtmlText(comment.comment_text, 160, true) as any;
    const html = String(res?.htmlStr || comment.comment_text);
    // Mirrors Angular: strip <i> tags from banner body
    return html.replace(/<\/? *i *>/gi, '');
  }, [comment]);

  useEffect(() => {
    if (!visible) return;
    if (!comment) return;
    const el = bodyRef.current;
    if (!el) return;

    // Mirrors Angular: lessPlaceholder.html(''); lessPlaceholder.append(content.htmlStr.replace(...))
    el.innerHTML = '';
    el.insertAdjacentHTML('beforeend', truncatedHtml);

    const link = document.createElement('a');
    link.className = 'back-btn';
    link.href = '#';
    link.innerHTML = 'Back&nbsp;to&nbsp;comments';
    link.onclick = (e) => {
      e.preventDefault();
      onBackToComments();
      return false;
    };

    // Mirrors Angular: if (lessPlaceholder.height() > 24 && lastChild.nodeName === 'P') append into last <p>, else append.
    setTimeout(() => {
      const last = el.lastChild as HTMLElement | null;
      if (el.offsetHeight > 24 && last && last.nodeName === 'P') {
        last.append(' ');
        last.appendChild(link);
      } else {
        el.appendChild(link);
      }
    }, 0);
  }, [visible, comment, truncatedHtml, onBackToComments]);

  if (!visible) return null;

  return (
    <div ref={wrapperRef} className="note-snippet-playback-banner-wrapper" style={{ top: `${top}px`, left: '75px' }}>
      <div className="banner-container">
        <i className="cnv-icons-10 icons2_Close-darkgray" onClick={onDismiss}></i>
        {comment && (
          <>
            <div className="dp-cont">
              <a href={`#/feed?filter=user:${comment.from_user}`}>
                <UserProfileImage userId={comment.from_user} width={40} height={40} />
              </a>
            </div>
            <div className="comment-body" ref={bodyRef}></div>
          </>
        )}
      </div>
    </div>
  );
}


