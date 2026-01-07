'use client';

/**
 * Create Group Modal
 * 
 * Exact replication of AngularJS createGroupModalCtrl functionality
 * Multi-step modal for creating groups (Public/Private)
 * Uses reusable Modal component
 */

import { useState, useEffect } from 'react';
import Modal from '@/components/common/Modal';

// Step constants
const CREATE_GROUP_STEP1 = 'cg1'; // Group Type Selection
const CREATE_GROUP_STEP2 = 'cg2'; // Group Details
const CREATE_GROUP_STEP3 = 'cg3'; // Invite Members
const CREATE_GROUP_STEP4 = 'cg4'; // Post Creators

const GROUP_TYPE_PUBLIC = 'groupTypePublic';
const GROUP_TYPE_PRIVATE = 'groupTypePrivate';

interface CreateGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  createPublic?: boolean;
  createPrivate?: boolean;
  onGroupCreated?: (groupId: string) => void;
}

export default function CreateGroupModal({
  open,
  onOpenChange,
  createPublic = false,
  createPrivate = false,
  onGroupCreated,
}: CreateGroupModalProps) {
  const [step, setStep] = useState(CREATE_GROUP_STEP1);
  const [groupType, setGroupType] = useState(GROUP_TYPE_PUBLIC);
  const [title, setTitle] = useState('What kind of a group are you creating?');
  
  // Group details
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupNameError, setGroupNameError] = useState('');
  const [showGroupExistsAlert, setShowGroupExistsAlert] = useState(false);
  const [existingGroupDetails, setExistingGroupDetails] = useState<any>(null);
  
  // Group extended properties
  const [autoFollowEnabled, setAutoFollowEnabled] = useState(false);
  const [listInGroupDirectory, setListInGroupDirectory] = useState(true);
  const [canInviteOthers, setCanInviteOthers] = useState(false);
  const [canLeaveGroup, setCanLeaveGroup] = useState(true);
  const [membersCanPost, setMembersCanPost] = useState(false);
  const [membersCanShareLocation, setMembersCanShareLocation] = useState(false);
  
  // Invite members (Step 3)
  const [invitedMembers, setInvitedMembers] = useState<any[]>([]);
  const [inviteMessage, setInviteMessage] = useState('');
  
  // Post creators (Step 4)
  const [postCreators, setPostCreators] = useState<any[]>([]);
  const [customMessagePostCreators, setCustomMessagePostCreators] = useState('');
  
  // Loading state
  const [isCreating, setIsCreating] = useState(false);
  const [isCheckingGroup, setIsCheckingGroup] = useState(false);

  // Initialize based on props
  useEffect(() => {
    if (open) {
      if (createPublic) {
        setStep(CREATE_GROUP_STEP2);
        setGroupType(GROUP_TYPE_PUBLIC);
        setTitle('Set up your public group');
      } else if (createPrivate) {
        setStep(CREATE_GROUP_STEP2);
        setGroupType(GROUP_TYPE_PRIVATE);
        setTitle('Set up your private group');
      } else {
        setStep(CREATE_GROUP_STEP1);
        setGroupType(GROUP_TYPE_PUBLIC);
        setTitle('What kind of a group are you creating?');
      }
      
      // Reset form
      setGroupName('');
      setGroupDesc('');
      setGroupNameError('');
      setShowGroupExistsAlert(false);
      setExistingGroupDetails(null);
      setAutoFollowEnabled(false);
      setListInGroupDirectory(true);
      setCanInviteOthers(false);
      setCanLeaveGroup(true);
      setMembersCanPost(false);
      setMembersCanShareLocation(false);
      setInvitedMembers([]);
      setInviteMessage('');
      setPostCreators([]);
      setCustomMessagePostCreators('');
    }
  }, [open, createPublic, createPrivate]);

  const toggleGroupType = (type: string) => {
    setGroupType(type);
  };

  const switchViewTo = (type: string) => {
    setGroupType(type);
    if (type === GROUP_TYPE_PUBLIC) {
      setAutoFollowEnabled(false);
      setCanInviteOthers(false);
      setCanLeaveGroup(true);
      setMembersCanPost(false);
      setListInGroupDirectory(true); // Not applicable for public
    } else {
      setAutoFollowEnabled(false);
      setListInGroupDirectory(true);
      setCanInviteOthers(false);
      setCanLeaveGroup(true);
      setMembersCanPost(false);
    }
    updateCreateGroupState(CREATE_GROUP_STEP2, true);
  };

  const updateCreateGroupState = (newStep: string, preserveState: boolean = false) => {
    if (!preserveState) {
      setGroupName('');
      setGroupDesc('');
      setShowGroupExistsAlert(false);
      
      if (groupType === GROUP_TYPE_PUBLIC) {
        setAutoFollowEnabled(false);
        setCanInviteOthers(false);
        setCanLeaveGroup(true);
        setMembersCanPost(false);
      } else {
        setListInGroupDirectory(true);
        setCanInviteOthers(false);
        setCanLeaveGroup(true);
        setMembersCanPost(false);
      }
    }

    if (newStep === CREATE_GROUP_STEP2) {
      setStep(CREATE_GROUP_STEP2);
      if (groupType === GROUP_TYPE_PUBLIC) {
        setTitle('Set up your public group');
      } else {
        setTitle('Set up your private group');
      }
    } else if (newStep === CREATE_GROUP_STEP3) {
      checkGroupExists(true);
    } else if (newStep === CREATE_GROUP_STEP4) {
      checkGroupExistsForPostCreators();
    }
  };

  const checkGroupExists = async (submitIfNotExists: boolean = false) => {
    if (!groupName.trim()) {
      setGroupNameError('Group name is required');
      return;
    }

    setIsCheckingGroup(true);
    setGroupNameError('');
    
    try {
      // TODO: Implement API call to check if group exists
      // For now, proceed to next step
      if (submitIfNotExists) {
        await handleSubmit();
      } else {
        setTitle(`Invite teammates to ${groupName}`);
        setStep(CREATE_GROUP_STEP3);
      }
    } catch (error: any) {
      console.error('Error checking group:', error);
      setGroupNameError(error.message || 'Error checking group name');
    } finally {
      setIsCheckingGroup(false);
    }
  };

  const checkGroupExistsForPostCreators = async () => {
    if (!groupName.trim()) {
      setGroupNameError('Group name is required');
      return;
    }

    setIsCheckingGroup(true);
    setGroupNameError('');
    
    try {
      // TODO: Implement API call to check if group exists
      setTitle('Add Post Creators');
      setStep(CREATE_GROUP_STEP4);
    } catch (error: any) {
      console.error('Error checking group:', error);
      setGroupNameError(error.message || 'Error checking group name');
    } finally {
      setIsCheckingGroup(false);
    }
  };

  const handleSubmit = async () => {
    if (!groupName.trim()) {
      setGroupNameError('Group name is required');
      return;
    }

    setIsCreating(true);
    
    try {
      // Determine group access
      let groupAccess: string;
      if (groupType === GROUP_TYPE_PUBLIC) {
        groupAccess = 'PUBLIC';
      } else {
        if (listInGroupDirectory) {
          groupAccess = 'PRIVATE';
        } else {
          groupAccess = 'SECRET';
        }
      }

      // Prepare users to invite
      const usersToInvite = invitedMembers.map((member) => {
        return member.email || member.phone_no || member.label;
      });

      // Prepare members allowed to post
      const membersAllowedToPost = membersCanPost
        ? postCreators.map((creator) => {
            return creator.email || creator.phone_no || creator.label;
          })
        : [];

      // Create group via API
      const response = await fetch('/api/v1/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          method: 'createGroup',
          name: groupName.trim(),
          description: groupDesc.trim(),
          access: groupAccess,
          auto_follow: autoFollowEnabled ? 1 : 0,
          members_can_invite_others: canInviteOthers ? 1 : 0,
          users_to_invite: usersToInvite,
          custom_message: inviteMessage,
          members_can_leave: canLeaveGroup ? 1 : 0,
          members_can_post: membersCanPost ? 0 : 1, // 0 = only specific members, 1 = all members
          members_allowed_to_post: membersAllowedToPost,
          custom_message_post_creators: customMessagePostCreators,
          show_mem_loc_and_movement: membersCanShareLocation ? 1 : 0,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create group');
      }

      const data = await response.json();
      const groupId = data.data?.group_info?.group_id || data.group_id;

      if (onGroupCreated && groupId) {
        onGroupCreated(groupId);
      }

      onOpenChange(false);
    } catch (error: any) {
      console.error('Error creating group:', error);
      setGroupNameError(error.message || 'Failed to create group. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const isGroupNameValid = () => {
    return groupName.trim().length > 0 && !showGroupExistsAlert;
  };

  const resetGroupName = () => {
    setShowGroupExistsAlert(false);
    setExistingGroupDetails(null);
  };

  const renderStep1 = () => (
    <>
      <div className="group-create-type" style={{ padding: '15px 30px' }}>
        <div>
          <div
            className={groupType === GROUP_TYPE_PUBLIC ? 'selected' : ''}
            onClick={() => toggleGroupType(GROUP_TYPE_PUBLIC)}
          >
            <div>
              <i className="cnv-icons-20 Icon1_PublicChannel-01-darkgray" style={{ marginRight: '14px' }}></i>
              Public
            </div>
            <span className="meta">Anyone in your network can access. You like transparency and open discussions.</span>
          </div>
        </div>

        <div>
          <div
            className={groupType === GROUP_TYPE_PRIVATE ? 'selected' : ''}
            onClick={() => toggleGroupType(GROUP_TYPE_PRIVATE)}
          >
            <div>
              <i className="cnv-icons-20 privateGroup_icon-darkgray" style={{ marginRight: '14px' }}></i>
              Private
            </div>
            <span className="meta">You control who has access. This stuff is need-to-know only.</span>
          </div>
        </div>
      </div>

      <section className="submit" style={{ padding: '0 30px' }}>
        <button
          className="btn btn-primary"
          onClick={() => updateCreateGroupState(CREATE_GROUP_STEP2)}
        >
          Next
        </button>
        <div className="clear-fix"></div>
      </section>
    </>
  );

  const renderStep2 = () => (
    <div className="group-create-details" style={{ padding: '0' }}>
      <div style={{ padding: '15px 30px' }}>
        <div className="form-group">
          <span>Name</span>
          <input
            className="group-name"
            type="text"
            maxLength={32}
            placeholder="e.g Marketing"
            value={groupName}
            onChange={(e) => {
              setGroupName(e.target.value);
              setGroupNameError('');
              setShowGroupExistsAlert(false);
            }}
            autoFocus
            style={{
              borderColor: groupNameError ? '#e45a2c' : undefined,
            }}
          />
          {groupNameError && (
            <div style={{ color: '#e45a2c', fontSize: '12px', marginTop: '5px', marginLeft: '22%' }}>{groupNameError}</div>
          )}
          {showGroupExistsAlert && existingGroupDetails && (
            <div className="group-alert-banner group-alert-slideDown">
              {existingGroupDetails.is_Member ? (
                <span>
                  You're already a member of that group.{' '}
                  <a href="javascript:void(0)" onClick={resetGroupName}>
                    Try another name
                  </a>{' '}
                  to continue.
                </span>
              ) : (
                <span>
                  A group with that name already exists.{' '}
                  <a href="javascript:void(0)" onClick={resetGroupName}>
                    Try another name
                  </a>{' '}
                  to continue.
                </span>
              )}
            </div>
          )}
          <div className="clear-fix"></div>
        </div>

        <div className="form-group">
          <span className="optional-placeholder">Description</span>
          <textarea
            className="group-desc"
            rows={3}
            maxLength={250}
            placeholder="Add some more information about your group. This description will help others when they search for the group or need more detail about what it contains."
            value={groupDesc}
            onChange={(e) => setGroupDesc(e.target.value)}
          />
          <div className="clear-fix"></div>
        </div>
      </div>

      <hr />
      
      <div style={{ padding: '0 30px' }}>

      {groupType === GROUP_TYPE_PRIVATE && (
        <div className="form-group">
          <span className="checkBoxLabel">List in group directory</span>
          <input
            id="CrtGrp1"
            className="group-vis cnv-checkbox"
            type="checkbox"
            checked={listInGroupDirectory}
            onChange={(e) => setListInGroupDirectory(e.target.checked)}
          />
          <label htmlFor="CrtGrp1"></label>
          <div>
            <span className="meta-info">This lets others in your company request access</span>
          </div>
          <div className="clear-fix"></div>
        </div>
      )}

      {groupType === GROUP_TYPE_PUBLIC && (
      <div className="form-group">
        <span className="checkBoxLabel">Add everyone in your company automatically</span>
        <input
          id="CrtGrp2"
          className="group-auto-follow cnv-checkbox"
          type="checkbox"
          checked={autoFollowEnabled}
          onChange={(e) => setAutoFollowEnabled(e.target.checked)}
        />
        <label htmlFor="CrtGrp2"></label>
          <div>
            <span className="meta-info">Good for company-wide news or discussions</span>
          </div>
          <div className="clear-fix"></div>
        </div>
      )}

      <div className="form-group">
        <span className="checkBoxLabel">Allow group members to add and remove users</span>
        <input
          id="CrtGrp3"
          className="group-edit-settings cnv-checkbox"
          type="checkbox"
          checked={canInviteOthers}
          onChange={(e) => setCanInviteOthers(e.target.checked)}
        />
        <label htmlFor="CrtGrp3"></label>
        <div className="clear-fix"></div>
      </div>

      <div className="form-group">
        <span className="checkBoxLabel">Allow members to leave this group</span>
        <input
          id="CrtGrp4"
          className="group-leave-member-settings cnv-checkbox"
          type="checkbox"
          checked={canLeaveGroup}
          onChange={(e) => setCanLeaveGroup(e.target.checked)}
        />
        <label htmlFor="CrtGrp4"></label>
        <div className="clear-fix"></div>
      </div>

      <div className="form-group">
        <span className="checkBoxLabel">Allow only specific members to create posts</span>
        <input
          id="CrtGrp5"
          className="group-post-member-settings cnv-checkbox"
          type="checkbox"
          checked={membersCanPost}
          onChange={(e) => setMembersCanPost(e.target.checked)}
        />
        <label htmlFor="CrtGrp5"></label>
        <div className="clear-fix"></div>
      </div>

      </div>

      <section className="submit" style={{ padding: '0 30px' }}>
        {groupType === GROUP_TYPE_PUBLIC && (
          <span className="info-label">
            To restrict access to group content,{' '}
            <a href="javascript:void(0);" onClick={() => switchViewTo(GROUP_TYPE_PRIVATE)}>
              create a private group
            </a>{' '}
            instead.
          </span>
        )}
        {groupType === GROUP_TYPE_PRIVATE && (
          <span className="info-label">
            If you want to share with a wider audience,{' '}
            <a href="javascript:void(0);" onClick={() => switchViewTo(GROUP_TYPE_PUBLIC)}>
              create a public group
            </a>{' '}
            instead.
          </span>
        )}

        {groupType === GROUP_TYPE_PUBLIC &&
        autoFollowEnabled &&
        groupName.trim().length > 0 &&
        !membersCanPost ? (
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!isGroupNameValid() || isCreating || isCheckingGroup}
          >
            {isCreating ? 'Creating...' : 'Create group'}
          </button>
        ) : (
          <button
            id="crtGrpNxtBtn"
            className="btn btn-primary"
            onClick={() => {
              if (membersCanPost) {
                updateCreateGroupState(CREATE_GROUP_STEP4, true);
              } else {
                updateCreateGroupState(CREATE_GROUP_STEP3, true);
              }
            }}
            disabled={!isGroupNameValid() || isCheckingGroup}
          >
            Next
          </button>
        )}
        <div className="clear-fix"></div>
      </section>
    </div>
  );

  const renderStep3 = () => (
    <div style={{ padding: '0px' }}>
      <h3 style={{ marginBottom: '15px', padding: '15px 30px 0', fontSize: '18px', fontWeight: '600' }}>
        Invite teammates to {groupName}
      </h3>
      <p style={{ color: '#666', marginBottom: '20px', padding: '0 30px', fontSize: '14px' }}>
        You can invite members now or add them later.
      </p>
      {/* TODO: Implement user search/selection component */}
      <div style={{ marginBottom: '20px', padding: '0 30px' }}>
        <textarea
          placeholder="Add a personal message (optional)"
          value={inviteMessage}
          onChange={(e) => setInviteMessage(e.target.value)}
          rows={3}
          style={{
            width: '100%',
            padding: '7px',
            border: '1px solid #e2e8ed',
            borderRadius: '3px',
            fontSize: '14px',
            fontFamily: 'inherit',
            resize: 'vertical',
          }}
        />
      </div>
      <section className="submit" style={{ padding: '0 30px 15px' }}>
        <button
          className="btn btn-primary"
          onClick={() => {
            if (membersCanPost) {
              updateCreateGroupState(CREATE_GROUP_STEP4, true);
            } else {
              handleSubmit();
            }
          }}
          disabled={isCreating}
        >
          {membersCanPost ? 'Next' : isCreating ? 'Creating...' : 'Create group'}
        </button>
        <div className="clear-fix"></div>
      </section>
    </div>
  );

  const renderStep4 = () => (
    <div style={{ padding: '0px' }}>
      <h3 style={{ marginBottom: '15px', padding: '15px 30px 0', fontSize: '18px', fontWeight: '600' }}>
        Add Post Creators
      </h3>
      <p style={{ color: '#666', marginBottom: '20px', padding: '0 30px', fontSize: '14px' }}>
        Select members who can create posts in this group.
      </p>
      {/* TODO: Implement user search/selection component for post creators */}
      <div style={{ marginBottom: '20px', padding: '0 30px' }}>
        <textarea
          placeholder="Add a personal message (optional)"
          value={customMessagePostCreators}
          onChange={(e) => setCustomMessagePostCreators(e.target.value)}
          rows={3}
          style={{
            width: '100%',
            padding: '7px',
            border: '1px solid #e2e8ed',
            borderRadius: '3px',
            fontSize: '14px',
            fontFamily: 'inherit',
            resize: 'vertical',
          }}
        />
      </div>
      <section className="submit" style={{ padding: '0 30px 15px' }}>
        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={isCreating}
        >
          {isCreating ? 'Creating...' : 'Create group'}
        </button>
        <div className="clear-fix"></div>
      </section>
    </div>
  );

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      className="cnv-modal"
    >
      {step === CREATE_GROUP_STEP1 && renderStep1()}
      {step === CREATE_GROUP_STEP2 && renderStep2()}
      {step === CREATE_GROUP_STEP3 && renderStep3()}
      {step === CREATE_GROUP_STEP4 && renderStep4()}
    </Modal>
  );
}
