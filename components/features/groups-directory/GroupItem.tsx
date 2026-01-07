'use client';

/**
 * Group Item Component
 * 
 * Displays a single group in the directory list
 * Matches AngularJS cnvAllGroupTemplate.tpl.html structure exactly
 */

import Link from 'next/link';
import { GroupDirectoryItem } from '@/lib/api/groups-directory';

interface GroupItemProps {
  group: GroupDirectoryItem;
  onJoin?: (group: GroupDirectoryItem) => void;
  onRequestToJoin?: (group: GroupDirectoryItem) => void;
  onInviteMembers?: (group: GroupDirectoryItem) => void;
}

export default function GroupItem({ group, onJoin, onRequestToJoin, onInviteMembers }: GroupItemProps) {
  const getGroupIconClass = () => {
    if (group.access === 'PUBLIC') {
      return 'cnv-icons-20 Icon1_PublicChannel-01-lightgray';
    } else {
      return 'cnv-icons-20 privateGroup_icon-lightgray';
    }
  };

  const getGroupUrl = (groupId: string) => {
    // Match AngularJS idToFilterUrlForApp behavior
    return `#/feed?filter=group:${groupId}`;
  };

  const getUserUrl = (userId: string) => {
    // Match AngularJS idToFilterUrlForApp behavior
    return `#/feed?filter=user:${userId}`;
  };

  const getMembersUrl = (groupId: string, groupTitle: string) => {
    // Match AngularJS getResourceLinkUrl behavior
    return `#/feed?filter=group:${groupId}:members`;
  };

  const getRequestsUrl = (groupId: string, groupTitle: string) => {
    // Match AngularJS getResourceLinkUrl behavior
    return `#/feed?filter=group:${groupId}:requests`;
  };

  const limitText = (text: string, limit: number) => {
    if (!text) return '';
    return text.length > limit ? text.substring(0, limit) + '...' : text;
  };

  const renderButton = () => {
    const hint = group._hint_this_user_action;
    
    if (hint === 'joined') {
      return (
        <button className="btn btn-block btn-disabled" disabled>
          <i className="cnv-icons-15 check-darkgray"></i>Joined
        </button>
      );
    }
    
    if (hint === 'join') {
      return (
        <button className="btn btn-block" onClick={() => onJoin?.(group)}>
          <i className="cnv-icons-15 icons2_Add-blue hover"></i>
          <i className="cnv-icons-15 icons2_Add-blue normal"></i>Join
        </button>
      );
    }
    
    if (hint === 'request_to_join') {
      if (group.access === 'SECRET') {
        return (
          <button className="btn btn-block btn-disabled" disabled>
            Private group
          </button>
        );
      }
      return (
        <button className="btn btn-block" onClick={() => onRequestToJoin?.(group)}>
          <i className="cnv-icons-15 icons2_Add-blue hover"></i>
          <i className="cnv-icons-15 icons2_Add-blue normal"></i>Request to join
        </button>
      );
    }
    
    if (hint === 'pending') {
      return (
        <button className="btn btn-block btn-disabled" disabled>
          <i className="cnv-icons-15 Icon1__Time-darkgray"></i>Pending
        </button>
      );
    }
    
    if (hint === 'invite_members') {
      return (
        <button 
          className="btn btn-block invite" 
          disabled={group.showSpinner}
          onClick={() => onInviteMembers?.(group)}
        >
          Invite members
        </button>
      );
    }
    
    return null;
  };

  return (
    <>
      <div className="group-detail-container">
        <div className="dp-wrapper">
          <i className={`group-dp ${getGroupIconClass()}`}></i>
        </div>
        <div className="group-details">
          <div>
            <Link href={getGroupUrl(group.group_id || group.id || '')}>
              {limitText(group.title || '', 30)}
            </Link>
            {group.created_by_name && (
              <span className="meta-txt">
                {' by '}
                <Link href={getUserUrl(group.created_by || '')} className="admin-name">
                  {limitText(group.created_by_name, 20)}
                </Link>
              </span>
            )}
          </div>
          {group.description && (
            <span className="desc">{group.description}</span>
          )}
        </div>
        <div className="group-members">
          <div className="members-req-count">
            {group.members_count !== undefined && (
              <span>
                {group.user_status === 'ACTIVE' ? (
                  <Link href={getMembersUrl(group.group_id || group.id || '', group.title || '')}>
                    {group.members_count}
                  </Link>
                ) : (
                  <span>{group.members_count}</span>
                )}
              </span>
            )}
            {group.join_requests_count && group.join_requests_count > 0 && (
              <div>
                <span>
                  ({' '}
                  <Link href={getRequestsUrl(group.group_id || group.id || '', group.title || '')}>
                    {group.join_requests_count === 1
                      ? `${group.join_requests_count} pending request`
                      : `${group.join_requests_count} pending requests`}
                  </Link>
                  {' '})
                </span>
              </div>
            )}
          </div>
        </div>
        {/* Dropdown placeholder - will be implemented later */}
        <div className="btn-container">
          {renderButton()}
        </div>
        {group.showSpinner && (
          <i className="cnv-circle-spinner-small spinner"></i>
        )}
      </div>
      <div className="clear-fix"></div>
      <hr />
    </>
  );
}


