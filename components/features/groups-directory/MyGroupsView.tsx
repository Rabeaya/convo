'use client';

/**
 * My Groups View Component
 * 
 * Displays groups the user manages and is a member of
 * Matches AngularJS cnvMyGroups.tpl.html structure exactly
 */

import { useMemo, useState, useEffect } from 'react';
import { GroupDirectoryItem } from '@/lib/api/groups-directory';
import GroupItem from './GroupItem';
import GroupSearch from './GroupSearch';
import CreateGroupModal from '../CreateGroupModal';

interface MyGroupsViewProps {
  manageGroups: GroupDirectoryItem[];
  memberGroups: GroupDirectoryItem[];
  sortedManageGroups: GroupDirectoryItem[];
  sortedMemberGroups: GroupDirectoryItem[];
  onJoin?: (group: GroupDirectoryItem) => void;
  onRequestToJoin?: (group: GroupDirectoryItem) => void;
  onInviteMembers?: (group: GroupDirectoryItem) => void;
  onCreateGroup?: () => void;
}

export default function MyGroupsView({
  manageGroups,
  memberGroups,
  sortedManageGroups,
  sortedMemberGroups,
  onJoin,
  onRequestToJoin,
  onInviteMembers,
  onCreateGroup,
}: MyGroupsViewProps) {
  const [isInSearchMode, setIsInSearchMode] = useState(false);
  const [filteredManageGroups, setFilteredManageGroups] = useState<GroupDirectoryItem[]>(sortedManageGroups);
  const [filteredMemberGroups, setFilteredMemberGroups] = useState<GroupDirectoryItem[]>(sortedMemberGroups);
  const [createGroupModalOpen, setCreateGroupModalOpen] = useState(false);

  // Search function matching AngularJS behavior
  const handleSearch = (searchFragment: string) => {
    if (searchFragment && searchFragment.length > 0) {
      setIsInSearchMode(true);
      // Match AngularJS getUserGroupSearchRegex behavior (case-insensitive)
      const regex = new RegExp(searchFragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      
      const filteredManage = sortedManageGroups.filter(group => {
        const title = group.title || '';
        return regex.test(title);
      });
      
      const filteredMember = sortedMemberGroups.filter(group => {
        const title = group.title || '';
        return regex.test(title);
      });
      
      setFilteredManageGroups(filteredManage);
      setFilteredMemberGroups(filteredMember);
    } else {
      setIsInSearchMode(false);
      setFilteredManageGroups(sortedManageGroups);
      setFilteredMemberGroups(sortedMemberGroups);
    }
  };

  // Update filtered groups when sorted groups change
  useEffect(() => {
    if (!isInSearchMode) {
      setFilteredManageGroups(sortedManageGroups);
      setFilteredMemberGroups(sortedMemberGroups);
    }
  }, [sortedManageGroups, sortedMemberGroups, isInSearchMode]);

  const displayManageGroups = isInSearchMode ? filteredManageGroups : sortedManageGroups;
  const displayMemberGroups = isInSearchMode ? filteredMemberGroups : sortedMemberGroups;

  const shouldShowSearch = (sortedManageGroups.length + sortedMemberGroups.length) > 10;

  return (
    <div className="all-groups my-groups" style={{ height: '100%' }}>
      <div className="header-section">
        <div className="first-header">
          <span className="header-text">GROUPS</span>
          {/* Dropdown placeholder - will be implemented later */}
        </div>
        <div className="second-header">
          <span>MEMBERS</span>
        </div>
        <GroupSearch
          placeholder="Search for groups"
          onSearch={handleSearch}
          show={shouldShowSearch}
        />
      </div>

      <div id="parent" style={{ display: 'flex', flexDirection: 'column' }}>
        {displayManageGroups.length > 0 && (
          <div id="first_child" style={{ flexGrow: 1, minHeight: 0 }}>
            <span className="group-separator">GROUPS YOU MANAGE</span>
            <div
              style={{
                overflow:
                  ((isInSearchMode && displayManageGroups.length > 7 && displayMemberGroups.length > 0) ||
                    (!isInSearchMode && displayManageGroups.length > 7))
                    ? 'auto'
                    : 'none',
                maxHeight:
                  ((isInSearchMode && displayMemberGroups.length === 0) ||
                    (!isInSearchMode && displayMemberGroups.length === 0))
                    ? 'auto'
                    : '50vh',
              }}
            >
              {displayManageGroups.map((group) => (
                <GroupItem
                  key={group.group_id || group.id}
                  group={group}
                  onJoin={onJoin}
                  onRequestToJoin={onRequestToJoin}
                  onInviteMembers={onInviteMembers}
                />
              ))}
            </div>
          </div>
        )}

        {displayMemberGroups.length > 0 && (
          <div id="second_child" style={{ flexGrow: 1, minHeight: 0 }}>
            <span className="group-separator">GROUPS YOU&apos;RE IN</span>
            <div
              style={{
                overflow:
                  ((isInSearchMode && displayMemberGroups.length > 7 && displayManageGroups.length > 0) ||
                    (!isInSearchMode && displayMemberGroups.length > 5))
                    ? 'auto'
                    : 'none',
                maxHeight:
                  ((isInSearchMode && displayManageGroups.length === 0) ||
                    (!isInSearchMode && displayManageGroups.length === 0))
                    ? 'auto'
                    : '50vh',
              }}
            >
              {displayMemberGroups.map((group, index) => (
                <GroupItem
                  key={group.group_id || group.id}
                  group={group}
                  onJoin={onJoin}
                  onRequestToJoin={onRequestToJoin}
                  onInviteMembers={onInviteMembers}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {isInSearchMode && filteredManageGroups.length === 0 && filteredMemberGroups.length === 0 && (
        <span className="alert-message">
          <span>There are no groups matching your search.</span>
          <span>
            You can{' '}
            <a href="javascript:void(0)" onClick={() => setCreateGroupModalOpen(true)}>
              create a new group
            </a>{' '}
            by that name.
          </span>
        </span>
      )}

      <CreateGroupModal
        open={createGroupModalOpen}
        onOpenChange={setCreateGroupModalOpen}
        onGroupCreated={() => {
          setCreateGroupModalOpen(false);
          onCreateGroup?.();
        }}
      />
    </div>
  );
}

