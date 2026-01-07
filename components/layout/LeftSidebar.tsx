'use client';

/**
 * Left Sidebar Panel
 * 
 * Migrated from AngularJS cnv-home-left-panel directive
 * Exact UI match with AngularJS version
 */

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useGroups, processGroups } from '@/lib/hooks/use-groups';
import { Group } from '@/lib/api/groups';
import CreateGroupModal from '@/components/features/CreateGroupModal';

const DEFAULT_NUMBER_OF_GROUPS_TO_DISPLAY = 5;

export default function LeftSidebar() {
  const [activeFilter, setActiveFilter] = useState('feed');
  const [privateGroupsCollapsed, setPrivateGroupsCollapsed] = useState(true);
  const [publicGroupsCollapsed, setPublicGroupsCollapsed] = useState(true);
  const [createGroupModalOpen, setCreateGroupModalOpen] = useState(false);
  const [createGroupType, setCreateGroupType] = useState<'public' | 'private' | null>(null);

  const { data: groupsData, isLoading, error } = useGroups();

  // Debug logging
  if (typeof window !== 'undefined') {
    if (groupsData) {
      console.log('Groups Data:', groupsData);
      console.log('Groups Array:', groupsData.groups);
      console.log('Groups Count:', groupsData.groups?.length);
    }
    if (error) {
      console.error('Groups Error:', error);
    }
  }

  // Process groups into private and public
  const { privateGroups, publicGroups } = useMemo(() => {
    if (!groupsData) {
      console.log('No groups data available - groupsData is:', groupsData);
      return { privateGroups: [], publicGroups: [] };
    }
    
    // Handle different response structures
    let groupsArray: Group[] = [];
    if (Array.isArray(groupsData)) {
      // If groupsData is directly an array
      groupsArray = groupsData;
    } else if (groupsData.groups && Array.isArray(groupsData.groups)) {
      // If groupsData has a groups property
      groupsArray = groupsData.groups;
    } else if (groupsData.data && Array.isArray(groupsData.data)) {
      // If groupsData has a data property that's an array
      groupsArray = groupsData.data;
    } else if (groupsData.data && groupsData.data.groups && Array.isArray(groupsData.data.groups)) {
      // If groupsData.data has a groups property
      groupsArray = groupsData.data.groups;
    }
    
    console.log('Groups Array from useMemo:', groupsArray);
    console.log('Groups Array Length:', groupsArray.length);
    
    if (groupsArray.length === 0) {
      console.log('No groups in array. groupsData structure:', JSON.stringify(groupsData, null, 2));
      return { privateGroups: [], publicGroups: [] };
    }
    
    const processed = processGroups(groupsArray);
    console.log('Processed Groups - Private:', processed.privateGroups.length, 'Public:', processed.publicGroups.length);
    return processed;
  }, [groupsData]);

  // Limit displayed groups
  const displayedPrivateGroups = privateGroupsCollapsed
    ? privateGroups.slice(0, DEFAULT_NUMBER_OF_GROUPS_TO_DISPLAY)
    : privateGroups;
  
  const displayedPublicGroups = publicGroupsCollapsed
    ? publicGroups.slice(0, DEFAULT_NUMBER_OF_GROUPS_TO_DISPLAY)
    : publicGroups;

  const getGroupIconClass = (group: Group) => {
    if (group.access === 'PRIVATE' || group.access === 'SECRET') {
      return 'privateGroup_icon-darkgray';
    } else if (group.access === 'PUBLIC') {
      return 'Icon1_PublicChannel-01-darkgray';
    }
    return '';
  };

  const getGroupFilterUrl = (groupId: string) => {
    return `#/feed?filter=group:${groupId}`;
  };

  return (
    <div className="wrapper-parent">
      <div className="hidden-xs hidden-sm left-panel-wrapper-full">
        {/* Left menu items */}
        <div className="row no-margin menu-items-container">
          <ul>
            <li style={{ marginTop: '12px', position: 'relative' }}>
              <i className="cnv-icons-16 icons_Home-dark"></i>
              <Link 
                href="/feed"
                className={activeFilter === 'feed' ? 'active' : ''}
                onClick={() => setActiveFilter('feed')}
                style={{
                  marginLeft: '15px',
                  color: activeFilter === 'feed' ? '#ffffff' : '#e0e0e0',
                  fontWeight: activeFilter === 'feed' ? 'bold' : 'normal',
                  textDecoration: 'none',
                }}
              >
                My feed
              </Link>
            </li>
            <li className="clearfix mentions" style={{ marginTop: '12px', position: 'relative' }}>
              <i className="cnv-icons-16 icons2_mention-dark pull-left"></i>
              <Link 
                href="/feed?filter=mentions"
                className={activeFilter === 'mentions' ? 'active' : ''}
                onClick={() => setActiveFilter('mentions')}
                style={{
                  marginLeft: '15px',
                  color: activeFilter === 'mentions' ? '#ffffff' : '#e0e0e0',
                  fontWeight: activeFilter === 'mentions' ? 'bold' : 'normal',
                  textDecoration: 'none',
                }}
              >
                Mentions
              </Link>
            </li>
            <li style={{ marginTop: '12px', position: 'relative' }}>
              <i className="cnv-icons-16 icons_Star-dark"></i>
              <Link 
                href="/feed?filter=starred"
                className={activeFilter === 'starred' ? 'active' : ''}
                onClick={() => setActiveFilter('starred')}
                style={{
                  marginLeft: '15px',
                  color: activeFilter === 'starred' ? '#ffffff' : '#e0e0e0',
                  fontWeight: activeFilter === 'starred' ? 'bold' : 'normal',
                  textDecoration: 'none',
                }}
              >
                Starred
              </Link>
            </li>
            {/* Workflows - placeholder */}
            {/* <li>
              <i className="cnv-icons-16 cnv-workflow"></i>
              <a>Workflows</a>
            </li> */}
            <li style={{ marginTop: '12px', position: 'relative' }}>
              <i className="cnv-icons-16 icons_Drafts-dark"></i>
              <Link 
                href="/feed?filter=drafts"
                className={activeFilter === 'drafts' ? 'active' : ''}
                onClick={() => setActiveFilter('drafts')}
                style={{
                  marginLeft: '15px',
                  color: activeFilter === 'drafts' ? '#ffffff' : '#e0e0e0',
                  fontWeight: activeFilter === 'drafts' ? 'bold' : 'normal',
                  textDecoration: 'none',
                }}
              >
                Drafts
              </Link>
            </li>
            <li style={{ marginTop: '12px', position: 'relative' }}>
              <i className="cnv-icons-16 icons_Integrations_Left"></i>
              <a 
                href="javascript:void(0)"
                style={{
                  marginLeft: '15px',
                  color: '#e0e0e0',
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
              >
                Integrations
              </a>
            </li>
            <li style={{ marginTop: '12px', position: 'relative' }}>
              <i className="cnv-icons-16 icons2_Trash-dark"></i>
              <Link 
                href="/feed?filter=trash"
                className={activeFilter === 'trash' ? 'active' : ''}
                onClick={() => setActiveFilter('trash')}
                style={{
                  marginLeft: '15px',
                  color: activeFilter === 'trash' ? '#ffffff' : '#e0e0e0',
                  fontWeight: activeFilter === 'trash' ? 'bold' : 'normal',
                  textDecoration: 'none',
                }}
              >
                Trash
              </Link>
            </li>
          </ul>
        </div>

        {/* What's New section */}
        <div className="row no-margin whatsnew menu-items-container">
          <ul>
            <li style={{ marginTop: '12px', position: 'relative' }}>
              <i className="cnv-icons-16 whatsNewIcon-gray"></i>
              <a 
                href="javascript:void(0)"
                style={{
                  marginLeft: '15px',
                  color: '#e0e0e0',
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
              >
                What's New
              </a>
            </li>
            <li style={{ marginTop: '12px', position: 'relative' }}>
              <i className="cnv-icons-16 help-videos-icn"></i>
              <a 
                href="javascript:void(0)"
                style={{
                  marginLeft: '15px',
                  color: '#e0e0e0',
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
              >
                Help Videos
              </a>
            </li>
          </ul>
        </div>

        {/* Groups/Channels section */}
        <div className="row no-margin groupsItemsContainer">
          <div className="heading">
            <span>Groups/Channels</span>
            <i
              className="cnv-icons-25 icons2_Add-blue"
              style={{ cursor: 'pointer' }}
              onClick={() => {
                setCreateGroupType(null);
                setCreateGroupModalOpen(true);
              }}
            ></i>
          </div>

          <ul>
            {isLoading && (
              <li style={{ position: 'relative', padding: '20px' }}>
                <div className="cnv-spinner spinner-bar" style={{ position: 'absolute', top: '8px', left: '50%' }}></div>
              </li>
            )}

            {error && (
              <li style={{ padding: '10px', color: '#e56564' }}>
                Error loading groups: {error.message}
              </li>
            )}

            {/* Debug info - remove after fixing */}
            {!isLoading && !error && groupsData && (
              <li style={{ padding: '5px', fontSize: '10px', color: '#aaa' }}>
                Debug: Groups={groupsData.groups?.length || 0}, 
                Private={privateGroups.length}, 
                Public={publicGroups.length},
                Displayed Private={displayedPrivateGroups.length},
                Displayed Public={displayedPublicGroups.length}
              </li>
            )}

            {!isLoading && !error && (
              <>
                {/* Private Groups Section */}
                <li className="section-heading" onClick={() => setPrivateGroupsCollapsed(!privateGroupsCollapsed)} style={{ cursor: 'pointer' }}>
                  <span>PRIVATE</span>
                </li>
                {privateGroups.length === 0 && displayedPrivateGroups.length === 0 && (
                  <li className="group-intro-item">
                    <span
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setCreateGroupType('private');
                        setCreateGroupModalOpen(true);
                      }}
                    >
                      + Create a private group
                    </span>
                  </li>
                )}
                {privateGroups.length === 0 && displayedPrivateGroups.length === 0 && (
                  <li>
                    <span className="no-group-available">No private groups available</span>
                  </li>
                )}
                {displayedPrivateGroups.map((group) => {
                  const groupTitle = group.title || `Group ${group.id.substring(0, 8)}`;
                  return (
                    <li key={group.id} className="clearfix parent" style={{ marginTop: '5px', position: 'static', minHeight: '28px', padding: '0px 15px 0px 30px' }}>
                      <div className="pull-left" style={{ position: 'relative', maxWidth: '165px' }}>
                        <i className={`cnv-icons-16 ${getGroupIconClass(group)}`} style={{ marginRight: '5px', float: 'none', display: 'block', marginTop: '2px', cursor: 'pointer', flexShrink: 0 }}></i>
                        {group.unreadCount && group.unreadCount > 0 && (
                          <span className="unread-bubble" style={{ position: 'absolute', left: '10px', top: '2px', color: '#4183d7', fontSize: '20px' }}>&middot;</span>
                        )}
                        <a
                          href={getGroupFilterUrl(group.id)}
                          onClick={() => setActiveFilter(`group:${group.id}`)}
                          style={{
                            marginLeft: '10px',
                            color: activeFilter === `group:${group.id}` ? '#ffffff' : '#c0c6d5',
                            fontWeight: activeFilter === `group:${group.id}` ? 'bold' : 'normal',
                            textDecoration: 'none',
                          }}
                          onMouseEnter={(e) => {
                            if (activeFilter !== `group:${group.id}`) {
                              e.currentTarget.style.color = '#ffffff';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (activeFilter !== `group:${group.id}`) {
                              e.currentTarget.style.color = '#c0c6d5';
                            }
                          }}
                        >
                          {groupTitle}
                        </a>
                      </div>
                      {/* Dropdown menu placeholder - will be implemented later */}
                    </li>
                  );
                })}
                {privateGroupsCollapsed && privateGroups.length > DEFAULT_NUMBER_OF_GROUPS_TO_DISPLAY && (
                  <li>
                    <a
                      href="javascript:void(0)"
                      className="moreButton"
                      onClick={() => setPrivateGroupsCollapsed(false)}
                      style={{ color: '#e0e0e0', textDecoration: 'none', cursor: 'pointer', marginLeft: '30px' }}
                    >
                      See more...
                    </a>
                  </li>
                )}
                {!privateGroupsCollapsed && privateGroups.length > DEFAULT_NUMBER_OF_GROUPS_TO_DISPLAY && (
                  <li>
                    <a
                      href="javascript:void(0)"
                      className="moreButton"
                      onClick={() => setPrivateGroupsCollapsed(true)}
                      style={{ color: '#e0e0e0', textDecoration: 'none', cursor: 'pointer', marginLeft: '30px' }}
                    >
                      Less
                    </a>
                  </li>
                )}

                {/* Public Groups Section */}
                <li className="section-heading" onClick={() => setPublicGroupsCollapsed(!publicGroupsCollapsed)} style={{ cursor: 'pointer' }}>
                  <span>PUBLIC</span>
                </li>
                {publicGroups.length === 0 && displayedPublicGroups.length === 0 && (
                  <li className="group-intro-item">
                    <span
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setCreateGroupType('public');
                        setCreateGroupModalOpen(true);
                      }}
                    >
                      + Create a public group
                    </span>
                  </li>
                )}
                {publicGroups.length === 0 && displayedPublicGroups.length === 0 && (
                  <li>
                    <span className="no-group-available">No public groups available</span>
                  </li>
                )}
                {displayedPublicGroups.map((group) => {
                  const groupTitle = group.title || `Group ${group.id.substring(0, 8)}`;
                  return (
                    <li key={group.id} className="clearfix parent" style={{ marginTop: '5px', position: 'static', minHeight: '28px', padding: '0px 15px 0px 30px' }}>
                      <div className="pull-left" style={{ position: 'relative', maxWidth: '165px' }}>
                        <i className={`cnv-icons-16 ${getGroupIconClass(group)}`} style={{ marginRight: '5px', float: 'none', display: 'block', marginTop: '2px', cursor: 'pointer', flexShrink: 0 }}></i>
                        {group.unreadCount && group.unreadCount > 0 && (
                          <span className="unread-bubble" style={{ position: 'absolute', left: '10px', top: '2px', color: '#4183d7', fontSize: '20px' }}>&middot;</span>
                        )}
                        <a
                          href={getGroupFilterUrl(group.id)}
                          onClick={() => setActiveFilter(`group:${group.id}`)}
                          style={{
                            marginLeft: '10px',
                            color: activeFilter === `group:${group.id}` ? '#ffffff' : '#c0c6d5',
                            fontWeight: activeFilter === `group:${group.id}` ? 'bold' : 'normal',
                            textDecoration: 'none',
                          }}
                          onMouseEnter={(e) => {
                            if (activeFilter !== `group:${group.id}`) {
                              e.currentTarget.style.color = '#ffffff';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (activeFilter !== `group:${group.id}`) {
                              e.currentTarget.style.color = '#c0c6d5';
                            }
                          }}
                        >
                          {groupTitle}
                        </a>
                      </div>
                      {/* Dropdown menu placeholder - will be implemented later */}
                    </li>
                  );
                })}
                {publicGroupsCollapsed && publicGroups.length > DEFAULT_NUMBER_OF_GROUPS_TO_DISPLAY && (
                  <li>
                    <a
                      href="javascript:void(0)"
                      className="moreButton"
                      onClick={() => setPublicGroupsCollapsed(false)}
                      style={{ color: '#e0e0e0', textDecoration: 'none', cursor: 'pointer', marginLeft: '30px' }}
                    >
                      See more...
                    </a>
                  </li>
                )}
                {!publicGroupsCollapsed && publicGroups.length > DEFAULT_NUMBER_OF_GROUPS_TO_DISPLAY && (
                  <li>
                    <a
                      href="javascript:void(0)"
                      className="moreButton"
                      onClick={() => setPublicGroupsCollapsed(true)}
                      style={{ color: '#e0e0e0', textDecoration: 'none', cursor: 'pointer', marginLeft: '30px' }}
                    >
                      Less
                    </a>
                  </li>
                )}
              </>
            )}
          </ul>
        </div>

        {/* Groups Directory */}
        <div className="row no-margin groupsControlsContainer">
          <span>
            <Link href="/groups">Groups Directory</Link>
          </span>
          <Link href="/groups" className="directory-icon">
            <i className="cnv-icons-25 icon1_directory"></i>
          </Link>
          <Link href="/groups" className="help-text">
            Find groups in your company to join
          </Link>
        </div>

        {/* Background div for overflow fix */}
        <div className="background-div"></div>
      </div>

      {/* Create Group Modal */}
      <CreateGroupModal
        open={createGroupModalOpen}
        onOpenChange={setCreateGroupModalOpen}
        createPublic={createGroupType === 'public'}
        createPrivate={createGroupType === 'private'}
        onGroupCreated={(groupId) => {
          console.log('Group created:', groupId);
          // TODO: Refresh groups list or navigate to the new group
          setCreateGroupModalOpen(false);
        }}
      />
    </div>
  );
}

