'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@/lib/api/auth';
import type { UserListItem } from '@/lib/hooks/use-users';
import { queryPublishableUsersAndGroups } from '@/lib/hooks/use-users';
import UserProfileImage from '@/components/common/UserProfileImage';

export type ShareWithOthersModalProps = {
  sharingInfo: Array<{ published_to: string; type: 'USER' | 'GROUP' }>;
  users: Record<string, User>;
  groups: Record<string, any>;
  currentUserId?: string | null;
  onSubmit: (nextSharingInfo: Array<{ published_to: string; type: 'USER' | 'GROUP' }>) => void;
  onClose: () => void;
};

function toListItems(users: Record<string, User>, groups: Record<string, any>) {
  const usersArray = Object.values(users || {});
  const groupsArray = Object.entries(groups || {}).map(([id, g]) => ({ ...(g as any), id }));
  return { usersArray, groupsArray };
}

function itemToSharingInfo(it: UserListItem): { published_to: string; type: 'USER' | 'GROUP' } {
  return { published_to: it.id, type: it.type };
}

export default function ShareWithOthersModal({
  sharingInfo,
  users,
  groups,
  currentUserId,
  onSubmit,
  onClose,
}: ShareWithOthersModalProps) {
  const [selected, setSelected] = useState<UserListItem[]>([]);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const { usersArray, groupsArray } = useMemo(() => toListItems(users, groups), [users, groups]);

  const suggestions = useMemo(() => {
    return queryPublishableUsersAndGroups(usersArray as any[], groupsArray as any[], query, 10, currentUserId || undefined);
  }, [usersArray, groupsArray, query, currentUserId]);

  const add = (it: UserListItem) => {
    setSelected((prev) => {
      if (prev.some((p) => p.id === it.id && p.type === it.type)) return prev;
      return [...prev, it];
    });
    setQuery('');
  };

  const remove = (it: UserListItem) => setSelected((prev) => prev.filter((p) => !(p.id === it.id && p.type === it.type)));

  const submit = () => {
    const existing = (sharingInfo || []).slice();
    const additions = selected.map(itemToSharingInfo);
    const merged = [...existing, ...additions];
    const seen = new Set<string>();
    const uniq = merged.filter((x) => {
      const k = `${x.type}:${x.published_to}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    onSubmit(uniq);
  };

  return (
    <div className="modal fade in" style={{ display: 'block' }}>
      <div className="modal-backdrop fade in" onClick={onClose} />
      <div className="modal-dialog" style={{ width: 520 }}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h4>Share with others</h4>
            <button type="button" className="close" onClick={onClose}>
              ×
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="modal-body sharepost">
              <p>Enter names of people or groups that you want to share this post with.</p>
              <br />
              <p>
                <b>People and Groups</b>
              </p>

              <div style={{ position: 'relative' }}>
                <div className="to-field" style={{ border: '1px solid #e0e0e0', borderRadius: 3, padding: 8 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {selected.map((it) => (
                      <span
                        key={`${it.type}:${it.id}`}
                        style={{
                          background: '#f2f4f8',
                          border: '1px solid #e2e5ea',
                          borderRadius: 3,
                          padding: '3px 6px',
                          fontSize: 13,
                          color: '#2b2b2b',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        {it.label}
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            remove(it);
                          }}
                          style={{ color: '#7b8386', textDecoration: 'none' }}
                        >
                          ×
                        </a>
                      </span>
                    ))}
                    <input
                      ref={inputRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="+Add more"
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') onClose();
                      }}
                      style={{
                        border: 'none',
                        outline: 'none',
                        fontSize: 14,
                        flex: 1,
                        minWidth: 120,
                      }}
                    />
                  </div>
                </div>

                {query.trim() && suggestions.length > 0 && (
                  <div
                    className="dropdown-cont"
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: '44px',
                      width: '100%',
                      zIndex: 2000,
                    }}
                  >
                    {suggestions.map((it) => {
                      const userObj = it.type === 'USER' ? (users as any)[it.id] : null;
                      return (
                        <div
                          key={`${it.type}:${it.id}`}
                          className="dropdown-item-cont"
                          onMouseDown={(e) => {
                            // prevent input blur
                            e.preventDefault();
                            add(it);
                          }}
                        >
                          <a href="#" onClick={(e) => e.preventDefault()}>
                            <span className="img-label-list-item">
                              {it.type === 'USER' ? (
                                <UserProfileImage
                                  userId={it.id}
                                  user={userObj}
                                  width={32}
                                  height={32}
                                  className="usr-img-32"
                                />
                              ) : (
                                <i className={`cnv-icons-32 ${it.classes || 'icons_Group-darkgray'}`} />
                              )}
                              <span>
                                <span dangerouslySetInnerHTML={{ __html: it.formattedlabel || it.label }} />
                                {it.desclabel && (
                                  <span className="sec-label" dangerouslySetInnerHTML={{ __html: it.formatteddesclabel || it.desclabel }} />
                                )}
                              </span>
                            </span>
                          </a>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="submit"
                className="btn btn-primary"
                style={{
                  backgroundColor: 'rgb(51, 113, 189)',
                  borderColor: 'rgb(51, 113, 189)',
                  color: '#fff',
                }}
              >
                Done
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}


