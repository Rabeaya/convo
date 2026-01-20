'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { likesApi } from '@/lib/api/likes';
import UserProfileImage from '@/components/common/UserProfileImage';

type LikeUser = {
  id: string;
  name?: string;
  email_or_phone?: string;
  accessible?: boolean;
  profile_image_type?: number;
  profile_image_version?: number | string;
};

function extractUsersFromUsersMap(users: Record<string, any> | null | undefined): LikeUser[] {
  if (!users || typeof users !== 'object') return [];
  return Object.keys(users).map((id) => ({
    id,
    ...(users as any)[id],
  }));
}

function extractLikeUsersFromLikeDetailsResponse(resp: any): LikeUser[] {
  // Angular resourceLikeInfoModalService:
  // - post: response.data.data.users + response.data.data.resources[*].user_ids_who_liked
  // - comment: response.data is a users map (no `data.users`)

  const data = resp?.data ?? resp;
  const inner = data?.data ?? data;

  // Comment-like shape: { userId: {name...}, ... }
  if (inner && typeof inner === 'object' && !inner.users && !inner.resources) {
    // heuristic: if keys look like user ids, treat as map
    const keys = Object.keys(inner);
    if (keys.length && typeof (inner as any)[keys[0]] === 'object') {
      return extractUsersFromUsersMap(inner);
    }
  }

  const usersMap = inner?.users || null;
  const resources = Array.isArray(inner?.resources) ? inner.resources : [];

  const usersById: Record<string, any> = usersMap && typeof usersMap === 'object' ? usersMap : {};

  // If resources present, follow their order (Angular maps user_ids_who_liked)
  if (resources.length) {
    // In feed we only show the first matching resource.
    const userIds: string[] = Array.isArray(resources[0]?.user_ids_who_liked) ? resources[0].user_ids_who_liked : [];
    return userIds
      .map((id) => ({ id, ...(usersById as any)[id] }))
      .filter((u) => !!u.id);
  }

  return extractUsersFromUsersMap(usersById);
}

export type LikeInfoModalProps =
  | {
      kind: 'post';
      pathId: string;
      resourceId: string;
      appInstanceId: number;
      includeSubResources?: number | null;
      isViewMode?: boolean;
      onClose: () => void;
    }
  | {
      kind: 'comment';
      conversationUid: string;
      onClose: () => void;
    };

// Distributive omit across the union, so callers can pass either the 'post' or 'comment' shape.
export type LikeInfoModalOpenProps =
  LikeInfoModalProps extends infer P ? (P extends any ? Omit<P, 'onClose'> : never) : never;

export default function LikeInfoModal(props: LikeInfoModalProps) {
  const [state, setState] = useState<'wait' | 'active'>('wait');
  const [viewedBy, setViewedBy] = useState(true);
  const [users, setUsers] = useState<LikeUser[]>([]);
  const [limit, setLimit] = useState(20);
  const bodyRef = useRef<HTMLDivElement>(null);

  const isViewMode = props.kind === 'post' ? !!props.isViewMode : false;

  useEffect(() => {
    let mounted = true;
    async function load() {
      setState('wait');
      setUsers([]);
      try {
        if (props.kind === 'comment') {
          const res = await likesApi.getLikeDetailsForConversation({ conversation_uid: props.conversationUid });
          if (!mounted) return;
          setUsers(extractLikeUsersFromLikeDetailsResponse(res.data));
          setState('active');
          return;
        }

        if (isViewMode && !viewedBy) {
          const res = await likesApi.getUsersNotAcknowledged({
            path_id: props.pathId,
            resource_id: props.resourceId,
            app_instance_id: props.appInstanceId,
            include_sub_resources: props.includeSubResources ?? 1,
          });
          if (!mounted) return;
          setUsers(extractLikeUsersFromLikeDetailsResponse(res.data));
          setState('active');
          return;
        }

        const res = await likesApi.getLikeDetailsForResource({
          path_id: props.pathId,
          resource_id: props.resourceId,
          app_instance_id: props.appInstanceId,
          include_sub_resources: props.includeSubResources ?? 1,
        });
        if (!mounted) return;

        // If view mode, Angular filters resources to the exact resourceId; our extractor already focuses the first resource.
        setUsers(extractLikeUsersFromLikeDetailsResponse(res.data));
        setState('active');
      } catch {
        if (!mounted) return;
        setUsers([]);
        setState('active');
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [props, isViewMode, viewedBy]);

  // Infinite scroll in modal (Angular scrolled-to-bottom-of-div increments limit by 20)
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) {
        setLimit((l) => l + 20);
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll as any);
  }, []);

  const visibleUsers = useMemo(() => users.slice(0, limit), [users, limit]);

  return (
    <div className="modal fade in" style={{ display: 'block' }}>
      <div className="modal-backdrop fade in" onClick={props.onClose} />
      <div className="modal-dialog cnv-like-info-modal" style={{ width: isViewMode ? 450 : 500 }}>
        <div className="modal-content">
          {!isViewMode ? (
            <div className="modal-header">
              <h4>People who like this</h4>
              <button type="button" className="close" onClick={props.onClose}>
                ×
              </button>
            </div>
          ) : (
            <div className="modal-header viewed-header">
              <button type="button" className="close view-close" onClick={props.onClose}>
                ×
              </button>
              <div className="viewed-header-container">
                <span
                  className={`viewed-title ${viewedBy ? 'viewed-border' : ''}`}
                  onClick={() => {
                    setLimit(20);
                    setViewedBy(true);
                  }}
                >
                  Viewed by
                </span>
                <span
                  className={`viewed-title ${!viewedBy ? 'viewed-border' : ''}`}
                  onClick={() => {
                    setLimit(20);
                    setViewedBy(false);
                  }}
                >
                  Not Viewed by
                </span>
              </div>
            </div>
          )}

          <div
            ref={bodyRef}
            className="modal-body cnvScrollContainer"
            style={{ overflowY: 'scroll', maxHeight: '420px' }}
          >
            {state === 'wait' ? (
              <div className="spinner-container" style={{ padding: '10px 0' }}>
                <i className="cnv-circle-spinner-small" /> Loading
              </div>
            ) : (
              <div style={{ paddingTop: '5px' }}>
                {visibleUsers.map((u) => (
                  <div
                    key={u.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px 6px',
                      borderBottom: '1px solid #f0f0f0',
                    }}
                  >
                    <UserProfileImage
                      userId={u.id}
                      user={{
                        user_id: u.id,
                        name: u.name || u.id,
                        profileImageType: (u as any).profile_image_type,
                        profileImageVersion: (u as any).profile_image_version,
                        first_name: (u as any).first_name,
                        last_name: (u as any).last_name,
                      } as any}
                      width={32}
                      height={32}
                    />
                    <div style={{ marginLeft: '10px', lineHeight: '16px' }}>
                      <div style={{ color: '#2b2b2b', fontSize: '14px' }}>{u.name || u.id}</div>
                      {u.email_or_phone && (
                        <div style={{ color: '#7b8386', fontSize: '12px' }}>{u.email_or_phone}</div>
                      )}
                    </div>
                  </div>
                ))}
                {visibleUsers.length === 0 && (
                  <div style={{ color: '#7b8386', fontSize: '13px', padding: '10px 0' }}>No data</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


