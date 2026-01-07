'use client';

/**
 * All Groups View Component
 * 
 * Displays all groups in the directory
 * Matches AngularJS cnvAllGroups.tpl.html structure exactly
 */

import { useMemo, useState, useEffect } from 'react';
import { GroupDirectoryItem } from '@/lib/api/groups-directory';
import GroupItem from './GroupItem';
import GroupSearch from './GroupSearch';
import CreateGroupModal from '../CreateGroupModal';

interface AllGroupsViewProps {
  groups: GroupDirectoryItem[];
  sortedGroups: GroupDirectoryItem[];
  onJoin?: (group: GroupDirectoryItem) => void;
  onRequestToJoin?: (group: GroupDirectoryItem) => void;
  onInviteMembers?: (group: GroupDirectoryItem) => void;
  onCreateGroup?: () => void;
}

export default function AllGroupsView({
  groups,
  sortedGroups,
  onJoin,
  onRequestToJoin,
  onInviteMembers,
  onCreateGroup,
}: AllGroupsViewProps) {
  const [isInSearchMode, setIsInSearchMode] = useState(false);
  const [filteredGroups, setFilteredGroups] = useState<GroupDirectoryItem[]>(sortedGroups);
  const [createGroupModalOpen, setCreateGroupModalOpen] = useState(false);

  // Search function matching AngularJS behavior
  const handleSearch = (searchFragment: string) => {
    if (searchFragment && searchFragment.length > 0) {
      setIsInSearchMode(true);
      // Match AngularJS getUserGroupSearchRegex behavior (case-insensitive)
      const regex = new RegExp(searchFragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const filtered = sortedGroups.filter(group => {
        const title = group.title || '';
        return regex.test(title);
      });
      setFilteredGroups(filtered);
    } else {
      setIsInSearchMode(false);
      setFilteredGroups(sortedGroups);
    }
  };

  // Update filtered groups when sortedGroups changes
  useEffect(() => {
    if (!isInSearchMode) {
      setFilteredGroups(sortedGroups);
    }
  }, [sortedGroups, isInSearchMode]);

  const displayGroups = isInSearchMode ? filteredGroups : sortedGroups;

  return (
    <div className="all-groups">
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
          show={sortedGroups.length > 10}
        />
        <hr />
      </div>

      <div>
        {displayGroups.map((group) => (
          <GroupItem
            key={group.group_id || group.id}
            group={group}
            onJoin={onJoin}
            onRequestToJoin={onRequestToJoin}
            onInviteMembers={onInviteMembers}
          />
        ))}
      </div>

      {!isInSearchMode && sortedGroups.length < 3 && (
        <span className="alert-message few-groups">
          <span>Groups in your company will show up here.</span>
          <span>
            There aren&apos;t many groups to show right now. why<br />
            don&apos;t you{' '}
            <a href="javascript:void(0)" onClick={() => setCreateGroupModalOpen(true)}>
              create
            </a>{' '}
            one?
          </span>
        </span>
      )}

      {isInSearchMode && filteredGroups.length === 0 && (
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


