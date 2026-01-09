'use client';

/**
 * Groups Directory Page
 * 
 * Main page for browsing and managing groups
 * Matches AngularJS cnvGroupsDirectory directive behavior exactly
 */

import { useState, useMemo, useEffect } from 'react';
import { useGroupsDirectory, processGroupsDirectory, sortGroupsByName } from '@/lib/hooks/use-groups-directory';
import AllGroupsView from '@/components/features/groups-directory/AllGroupsView';
import MyGroupsView from '@/components/features/groups-directory/MyGroupsView';
import CreateGroupModal from '@/components/features/CreateGroupModal';
import './groups-directory.css';

const ALL_GROUPS_VIEW = 'AllGroups';
const MY_GROUPS_VIEW = 'MyGroups';
const GROUPS_REQUESTS_VIEW = 'GroupsRequests';

export default function GroupsDirectoryPage() {
  const [selectedView, setSelectedView] = useState<string>(ALL_GROUPS_VIEW);
  const [createGroupModalOpen, setCreateGroupModalOpen] = useState(false);
  const [canCreateGroup, setCanCreateGroup] = useState(true); // TODO: Get from settings service

  const { data: directoryData, isLoading, error, refetch } = useGroupsDirectory();

  // Process groups data
  const { allGroups, manageGroups, memberGroups } = useMemo(() => {
    if (!directoryData?.data?.groups) {
      return { allGroups: [], manageGroups: [], memberGroups: [] };
    }
    return processGroupsDirectory(directoryData.data.groups);
  }, [directoryData]);

  // Sort groups by name (default)
  const sortedAllGroups = useMemo(() => sortGroupsByName(allGroups), [allGroups]);
  const sortedManageGroups = useMemo(() => sortGroupsByName(manageGroups), [manageGroups]);
  const sortedMemberGroups = useMemo(() => sortGroupsByName(memberGroups), [memberGroups]);

  const myGroupsCount = manageGroups.length + memberGroups.length;
  const groupsJoinReqs = directoryData?.data?.group_join_requests || [];

  // Handle view switching
  const handleViewChange = (view: string) => {
    if (selectedView === view) return;
    setSelectedView(view);
  };

  // Handle group actions
  const handleJoinGroup = async (group: any) => {
    // TODO: Implement join group API call
    console.log('Join group:', group);
  };

  const handleRequestToJoin = async (group: any) => {
    // TODO: Implement request to join API call
    console.log('Request to join group:', group);
  };

  const handleInviteMembers = async (group: any) => {
    // TODO: Implement invite members functionality
    console.log('Invite members to group:', group);
  };

  const handleCreateGroup = () => {
    setCreateGroupModalOpen(true);
  };

  const handleGroupCreated = () => {
    setCreateGroupModalOpen(false);
    refetch(); // Refresh groups list
  };

  if (isLoading) {
    return (
      <div className="groups-directory-container">
        <div className="loading-spinner">
          <img src="/assets/img/feed/loading-spin.svg" alt="Loading icon" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="groups-directory-container">
        <div className="error-message">
          Error loading groups directory: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      </div>
    );
  }

  return (
    <div className="groups-directory-container">
      <div className="app-header">
        <div className="app-header-left-content">
          <span className="heading-txt">Groups Directory</span>
        </div>
        <div className="app-header-right-content">
          {canCreateGroup && (
            <button className="btn btn-primary" onClick={handleCreateGroup}>
              Create Group
            </button>
          )}
        </div>
      </div>

      <div className="app-sub-header">
        <a
          className={selectedView === ALL_GROUPS_VIEW ? 'active' : ''}
          href="javascript:void(0)"
          onClick={() => handleViewChange(ALL_GROUPS_VIEW)}
        >
          All Groups{allGroups.length > 0 && ` (${allGroups.length})`}
        </a>
        <a
          className={selectedView === MY_GROUPS_VIEW ? 'active' : ''}
          href="javascript:void(0)"
          onClick={() => handleViewChange(MY_GROUPS_VIEW)}
        >
          My Groups{myGroupsCount > 0 && ` (${myGroupsCount})`}
        </a>
        {groupsJoinReqs.length > 0 && (
          <a
            className={selectedView === GROUPS_REQUESTS_VIEW ? 'active' : ''}
            href="javascript:void(0)"
            onClick={() => handleViewChange(GROUPS_REQUESTS_VIEW)}
          >
            Requests ({groupsJoinReqs.length})
          </a>
        )}
      </div>

      <div className="view-content">
        {selectedView === ALL_GROUPS_VIEW && (
          <AllGroupsView
            groups={allGroups}
            sortedGroups={sortedAllGroups}
            onJoin={handleJoinGroup}
            onRequestToJoin={handleRequestToJoin}
            onInviteMembers={handleInviteMembers}
            onCreateGroup={handleCreateGroup}
          />
        )}

        {selectedView === MY_GROUPS_VIEW && (
          <MyGroupsView
            manageGroups={manageGroups}
            memberGroups={memberGroups}
            sortedManageGroups={sortedManageGroups}
            sortedMemberGroups={sortedMemberGroups}
            onJoin={handleJoinGroup}
            onRequestToJoin={handleRequestToJoin}
            onInviteMembers={handleInviteMembers}
            onCreateGroup={handleCreateGroup}
          />
        )}

        {selectedView === GROUPS_REQUESTS_VIEW && (
          <div className="groups-requests">
            {/* TODO: Implement groups requests view */}
            <p>Groups Requests view - To be implemented</p>
          </div>
        )}
      </div>

      <CreateGroupModal
        open={createGroupModalOpen}
        onOpenChange={setCreateGroupModalOpen}
        onGroupCreated={handleGroupCreated}
      />
    </div>
  );
}



