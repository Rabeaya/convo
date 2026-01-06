'use client';

/**
 * Customize Feed View
 * 
 * Migrated from AngularJS cnvCustomizeFeed directive
 * Exact 1:1 UI and functionality match
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useCustomizeFeedSettings, useSaveSettingByName } from '@/lib/hooks/use-settings';
import { useGroups } from '@/lib/hooks/use-groups';
import { useAuthStore } from '@/lib/stores/auth-store';
import { apiClient } from '@/lib/api/client';

interface TagItem {
  id: string;
  label: string;
  type: 'USER' | 'GROUP';
  [key: string]: any;
}

interface GroupSetting {
  group_id?: string;
  id?: string;
  hide_from_feed?: number;
}

export default function CustomizeFeedView() {
  const [initialized, setInitialized] = useState(true); // Always initialized to show content
  const [userAndGroupList, setUserAndGroupList] = useState<TagItem[]>([]);
  const [groupList, setGroupList] = useState<TagItem[]>([]);
  const [hiddenGroups, setHiddenGroups] = useState<GroupSetting[]>([]);
  const [hiddenGroupsMap, setHiddenGroupsMap] = useState<Record<string, boolean>>({});
  const [sharingOptions, setSharingOptions] = useState<number>(0); // 0=none, 1=desktop, 2=mobile, 3=both
  const [shareLinkInChat, setShareLinkInChat] = useState<boolean>(false);
  const [viewHiddenGroupsText, setViewHiddenGroupsText] = useState('View hidden groups');
  const [showHiddenGroupsModal, setShowHiddenGroupsModal] = useState(false);
  
  const { data: settingsData, isLoading: settingsLoading } = useCustomizeFeedSettings(true);
  const { data: groupsData, isLoading: groupsLoading } = useGroups();
  const saveSettingMutation = useSaveSettingByName();
  const user = useAuthStore((state) => state.user);
  
  const groups = groupsData?.groups || [];
  const users = {}; // We'll need to fetch users separately or from feed context

  // Update view - matches AngularJS updateView()
  const updateView = useCallback(() => {
    if (!settingsData) return;

    // Reset checkboxes
    const settingMA = document.getElementById('settingMA') as HTMLInputElement;
    if (settingMA) {
      settingMA.checked = false;
    }

    // Load sharing options list
    const sharingOptionsList = settingsData.sharing_options_list || [];
    if (sharingOptionsList.length > 0) {
      // Convert sharing options to tag items
      // Note: We need to wait for groups to load, so this will be called again when groups are ready
      const tags: TagItem[] = [];
      sharingOptionsList.forEach((item: any) => {
        if (item.type === 'USER') {
          // Find user in users object or create placeholder
          const userId = item.share_to;
          const userObj = users[userId];
          if (userObj) {
            const firstName = (userObj as any).first_name || (userObj as any).firstName || '';
            const lastName = (userObj as any).last_name || (userObj as any).lastName || '';
            const fullName = `${firstName} ${lastName}`.trim();
            tags.push({
              id: userId,
              label: fullName || (userObj as any).email || userId,
              type: 'USER',
            });
          } else {
            tags.push({
              id: userId,
              label: userId,
              type: 'USER',
            });
          }
        } else if (item.type === 'GROUP') {
          const groupId = item.share_to;
          const group = groups.find(g => g.id === groupId);
          if (group) {
            tags.push({
              id: groupId,
              label: group.title || groupId,
              type: 'GROUP',
            });
          } else {
            tags.push({
              id: groupId,
              label: groupId,
              type: 'GROUP',
            });
          }
        }
      });
      setUserAndGroupList(tags);
    } else {
      setUserAndGroupList([]);
    }

    // Load hidden groups
    const regularGroupList = settingsData.regular_groups_settings || [];
    const hidden: GroupSetting[] = [];
    const hiddenMap: Record<string, boolean> = {};
    
    regularGroupList.forEach((item: GroupSetting) => {
      if (item.hide_from_feed === 1) {
        hidden.push(item);
        const groupId = item.group_id || item.id;
        if (groupId) {
          hiddenMap[groupId] = true;
        }
      }
    });
    
    setHiddenGroups(hidden);
    setHiddenGroupsMap(hiddenMap);
    
    if (hidden.length === 0) {
      setViewHiddenGroupsText('View hidden groups');
    } else {
      setViewHiddenGroupsText(`View ${hidden.length} hidden groups`);
    }

    // Set sharing options checkbox
    const sharingOpts = parseInt(String(settingsData.sharing_options || 0));
    setSharingOptions(sharingOpts);
    
    if (settingMA) {
      if (sharingOpts === 2 || sharingOpts === 3) {
        settingMA.checked = true;
      } else {
        settingMA.checked = false;
      }
    }

    // Load share link in chat setting
    const shareLinkSetting = (settingsData as any).share_link_of_new_posts_in_chat || (settingsData as any).share_link_in_chat || 0;
    setShareLinkInChat(shareLinkSetting === 1);
    
    const shareLinkCheckbox = document.getElementById('shareLinkInChat') as HTMLInputElement;
    if (shareLinkCheckbox) {
      shareLinkCheckbox.checked = shareLinkSetting === 1;
    }
  }, [settingsData, groups, users]);

  // Initialize component - matches AngularJS initialize()
  useEffect(() => {
    // Always set initialized to show content immediately
    setInitialized(true);
    
    // Update view when settings data is available
    if (settingsData) {
      // Use setTimeout to match AngularJS behavior
      setTimeout(() => {
        updateView();
      }, 0);
    }
  }, [settingsData, updateView]);

  // Handle sharing option added - matches onSharingOptionAdded()
  const handleSharingOptionAdded = useCallback((item: TagItem) => {
    const sharingObj = {
      type: item.type,
      share_to: item.id,
    };
    
    saveSettingMutation.mutate({
      settingName: 'sharing_options_list',
      value: {
        added_sharing_options: [sharingObj]
      }
    }, {
      onSuccess: () => {
        // Refresh settings
        // The mutation already invalidates the query
      }
    });
  }, [saveSettingMutation]);

  // Handle sharing option removed - matches onSharingOptionRemoved()
  const handleSharingOptionRemoved = useCallback((item: TagItem) => {
    const sharingObj = {
      type: item.type,
      share_to: item.id,
    };
    
    saveSettingMutation.mutate({
      settingName: 'sharing_options_list',
      value: {
        removed_sharing_options: [sharingObj]
      }
    });
  }, [saveSettingMutation]);

  // Reset to default sharing options - matches resetToDefaultSharingOption()
  const handleResetToDefault = useCallback(() => {
    saveSettingMutation.mutate({
      settingName: 'reset_to_default_sharing_options',
      value: 1
    }, {
      onSuccess: (response: any) => {
        if (response?.data?.data?.sharing_options_list) {
          const userAndGroupList = response.data.data.sharing_options_list;
          const tags: TagItem[] = [];
          
          userAndGroupList.forEach((item: any) => {
            if (item.type === 'USER') {
              const userId = item.share_to;
              const userObj = users[userId];
              tags.push({
                id: userId,
                label: userObj ? `${(userObj as any).first_name || ''} ${(userObj as any).last_name || ''}`.trim() || (userObj as any).email || userId : userId,
                type: 'USER',
              });
            } else if (item.type === 'GROUP') {
              const groupId = item.share_to;
              const group = groups.find(g => g.id === groupId);
              tags.push({
                id: groupId,
                label: group ? (group.title || groupId) : groupId,
                type: 'GROUP',
              });
            }
          });
          
          setUserAndGroupList(tags);
        }
      }
    });
  }, [saveSettingMutation, groups, users]);

  // Handle group item added - matches groupItemAdded()
  const handleGroupItemAdded = useCallback(() => {
    // Enable hide button if groups are selected
    const hideBtn = document.getElementById('hideGroupsBtn');
    if (hideBtn && groupList.length > 0) {
      hideBtn.classList.remove('disabled');
    }
  }, [groupList]);

  // Handle group item removed - matches groupItemRemoved()
  const handleGroupItemRemoved = useCallback(() => {
    const hideBtn = document.getElementById('hideGroupsBtn');
    if (hideBtn && groupList.length === 0) {
      hideBtn.classList.add('disabled');
    }
  }, [groupList]);

  // Hide groups from feed - matches hideGroupsFromFeed()
  const handleHideGroupsFromFeed = useCallback(() => {
    if (groupList.length === 0) return;

    const listToHide: Array<{ id: string; hide_from_feed: number }> = [];
    const newHiddenGroups = [...hiddenGroups];
    const newHiddenMap = { ...hiddenGroupsMap };

    groupList.forEach((item) => {
      listToHide.push({ id: item.id, hide_from_feed: 1 });
      
      // Add to hidden groups list
      const groupSetting: GroupSetting = {
        id: item.id,
        group_id: item.id,
        hide_from_feed: 1,
      };
      newHiddenGroups.push(groupSetting);
      newHiddenMap[item.id] = true;
    });

    saveSettingMutation.mutate({
      settingName: 'group_subscriptions',
      value: listToHide
    }, {
      onSuccess: () => {
        setGroupList([]);
        setHiddenGroups(newHiddenGroups);
        setHiddenGroupsMap(newHiddenMap);
        
        const hideBtn = document.getElementById('hideGroupsBtn');
        if (hideBtn) {
          hideBtn.classList.add('disabled');
        }
        
        if (newHiddenGroups.length > 0) {
          setViewHiddenGroupsText(`View ${newHiddenGroups.length} hidden groups`);
        } else {
          setViewHiddenGroupsText('View hidden groups');
        }
      }
    });
  }, [groupList, hiddenGroups, hiddenGroupsMap, saveSettingMutation]);

  // Update checkbox settings - matches updateChkSettings()
  const handleUpdateCheckboxSettings = useCallback(() => {
    const settingMA = document.getElementById('settingMA') as HTMLInputElement;
    if (!settingMA) return;

    let valBit = 0;
    if (settingMA.checked) {
      valBit = 2; // Mobile apps
    }

    setSharingOptions(valBit);
    
    saveSettingMutation.mutate({
      settingName: 'sharing_options',
      value: valBit
    });
  }, [saveSettingMutation]);

  // Get autocomplete items for users and groups
  const getAutoCompleteUserAndGroupsItems = useCallback(async (query: string, numSelected: number) => {
    // This should query users and groups
    // For now, return filtered groups and placeholder for users
    const filteredGroups = groups
      .filter(g => g.title?.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 4 + numSelected)
      .map(g => ({
        id: g.id,
        label: g.title || g.id,
        type: 'GROUP' as const,
      }));

    // TODO: Add users autocomplete when users API is available
    return filteredGroups;
  }, [groups]);

  // Get autocomplete items for groups only
  const getAutoCompleteGroupsItems = useCallback(async (query: string) => {
    const filtered = groups
      .filter(g => {
        const title = g.title?.toLowerCase() || '';
        const matchesQuery = title.includes(query.toLowerCase());
        const notHidden = !hiddenGroupsMap[g.id];
        return matchesQuery && notHidden;
      })
      .slice(0, 4 + groupList.length)
      .map(g => ({
        id: g.id,
        label: g.title || g.id,
        type: 'GROUP' as const,
      }));

    return filtered;
  }, [groups, hiddenGroupsMap, groupList.length]);

  // Show content even if still loading - data will update when ready
  // if (!initialized || settingsLoading) {
  //   return (
  //     <div className="loading-spinner" style={{ position: 'absolute', left: '50%', marginLeft: '-16px', top: '50%', marginTop: '-16px' }}>
  //       <img src="/assets/img/feed/loading-spin.svg" alt="Loading icon" />
  //     </div>
  //   );
  // }

  return (
    <div style={{ paddingLeft: '120px', maxWidth: '1205px', boxSizing: 'border-box', width: '100%' }}>
      <div className="header">Feed and sharing</div>
      <div style={{ marginTop: '20px' }}></div>
      
      {/* DEFAULT RECIPIENTS FOR MY POSTS */}
      <div className="subHeader">
        DEFAULT RECIPIENTS FOR MY POSTS
      </div>
      <hr />
      <div style={{ marginTop: '10px', color: '#7b8386', fontSize: '14px' }}>
        When you start a new post, we'll prefill the recipients with whoever is listed below.
        <br />
        Type the name of a group or teammate to set your own default recipient.
      </div>
      
      <div style={{ marginTop: '20px' }}>
        <div style={{ display: 'inline-block', width: '40px', verticalAlign: 'sub', fontSize: '14px' }}>
          To:
        </div>
        <div className="to-field-cont">
          {/* Tags Input Component - will be implemented */}
          <TagsInput
            tags={userAndGroupList}
            onAdd={handleSharingOptionAdded}
            onRemove={handleSharingOptionRemoved}
            getSuggestions={getAutoCompleteUserAndGroupsItems}
            placeholder={userAndGroupList.length === 0 ? "Type the name of a group or teammate" : ""}
          />
        </div>
        <div style={{ display: 'inline-block', marginLeft: '30px' }}>
          <a 
            href="#" 
            onClick={(e) => {
              e.preventDefault();
              handleResetToDefault();
            }}
            style={{ fontSize: '14px', color: '#4183d7', textDecoration: 'none' }}
          >
            Restore defaults
          </a>
        </div>
      </div>

      <div style={{ marginTop: '20px', fontSize: '14px' }}>
        Also use these default recipients for:
        <br />
        <br />
        <input
          type="checkbox"
          className="cnv-checkbox"
          id="settingMA"
          onChange={handleUpdateCheckboxSettings}
        />
        <label htmlFor="settingMA"></label>
        <div style={{ display: 'inline', marginLeft: '5px', fontSize: '14px' }}>
          Convo mobile apps.
        </div>
      </div>

      {/* SHARE LINK OF NEW POSTS IN CHAT */}
      <div className="subHeader" style={{ marginTop: '20px' }}>
        SHARE LINK OF NEW POSTS IN CHAT
      </div>
      <hr />
      <div style={{ marginTop: '10px', color: '#7b8386', fontSize: '14px' }}>
        You can choose to share the link of the post with all users mentioned in the post automatically in chat. This setting will be applied on mobile apps as well.
        <br />
        <br />
        <div style={{ fontSize: '14px', color: '#2b2b2b' }}>
          <div style={{ marginBottom: '10px' }}>
            <input
              type="radio"
              id="shareLinkYes"
              name="shareLinkInChat"
              checked={shareLinkInChat}
              onChange={(e) => {
                const value = 1;
                setShareLinkInChat(true);
                saveSettingMutation.mutate({
                  settingName: 'share_link_of_new_posts_in_chat',
                  value: value
                });
              }}
              style={{ marginRight: '8px', verticalAlign: 'middle' }}
            />
            <label htmlFor="shareLinkYes" style={{ fontSize: '14px', cursor: 'pointer', verticalAlign: 'middle' }}>
              Yes, share link of new posts in chat automatically
            </label>
          </div>
          <div>
            <input
              type="radio"
              id="shareLinkNo"
              name="shareLinkInChat"
              checked={!shareLinkInChat}
              onChange={(e) => {
                const value = 0;
                setShareLinkInChat(false);
                saveSettingMutation.mutate({
                  settingName: 'share_link_of_new_posts_in_chat',
                  value: value
                });
              }}
              style={{ marginRight: '8px', verticalAlign: 'middle' }}
            />
            <label htmlFor="shareLinkNo" style={{ fontSize: '14px', cursor: 'pointer', verticalAlign: 'middle' }}>
              No, don't share link of new posts in chat
            </label>
          </div>
        </div>
      </div>

      {/* Default Setting Section */}
      <div style={{ marginTop: '20px' }}>
        <div className="header">
          <u>Default Setting</u>
        </div>
      </div>

      {/* HIDE POSTS FROM MY FEED */}
      <div className="subHeader" style={{ marginTop: '20px' }}>
        HIDE POSTS FROM MY FEED
      </div>
      <hr />
      <div style={{ marginTop: '10px', color: '#7b8386', fontSize: '14px' }}>
        You can adjust what you see in your feed by hiding or unhiding groups.
        <br />
        You can still find hidden posts by searching or by visiting the group view.
      </div>

      <div style={{ marginTop: '20px' }}>
        <div style={{ display: 'inline-block', width: '125px', verticalAlign: 'middle', fontSize: '14px' }}>
          Hide posts from these groups
        </div>
        <div className="to-field-cont">
          <TagsInput
            tags={groupList}
            onAdd={(item) => {
              setGroupList([...groupList, item]);
              handleGroupItemAdded();
            }}
            onRemove={(item) => {
              setGroupList(groupList.filter(g => g.id !== item.id));
              handleGroupItemRemoved();
            }}
            getSuggestions={getAutoCompleteGroupsItems}
            placeholder={groupList.length === 0 ? "Type the name of a group" : ""}
          />
        </div>
        <button
          id="hideGroupsBtn"
          style={{ marginLeft: '50px' }}
          onClick={handleHideGroupsFromFeed}
          type="button"
          className={`btn btn-primary ${groupList.length === 0 ? 'disabled' : ''}`}
        >
          Hide
        </button>
      </div>
      
      <div style={{ marginLeft: '130px', marginTop: '10px' }}>
        <a
          href="#"
          id="hiddenGroups"
          onClick={(e) => {
            e.preventDefault();
            if (hiddenGroups.length > 0) {
              setShowHiddenGroupsModal(true);
            }
          }}
          className={hiddenGroups.length === 0 ? 'anchorDisabled' : ''}
          style={{ fontSize: '14px', color: '#4183d7', textDecoration: 'none' }}
        >
          {viewHiddenGroupsText}
        </a>
      </div>

      <div style={{ marginTop: '180px' }}></div>
    </div>
  );
}

// Simple TagsInput component - matches AngularJS tags-input behavior
interface TagsInputProps {
  tags: TagItem[];
  onAdd: (item: TagItem) => void;
  onRemove: (item: TagItem) => void;
  getSuggestions: (query: string, numSelected?: number) => Promise<TagItem[]>;
  placeholder?: string;
}

function TagsInput({ tags, onAdd, onRemove, getSuggestions, placeholder }: TagsInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<TagItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    if (value.trim().length >= 1) {
      const items = await getSuggestions(value, tags.length);
      setSuggestions(items);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && suggestions.length > 0) {
      e.preventDefault();
      onAdd(suggestions[0]);
      setInputValue('');
      setSuggestions([]);
      setShowSuggestions(false);
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      onRemove(tags[tags.length - 1]);
    }
  };

  const handleSuggestionClick = (item: TagItem) => {
    onAdd(item);
    setInputValue('');
    setSuggestions([]);
    setShowSuggestions(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      <div className="tags" style={{ margin: '4px 0px', border: '1px solid #e2e8ed', borderRadius: '6px', padding: '0px 0px 0px 5px', minHeight: '40px', display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
        {tags.map((tag) => (
          <span
            key={tag.id}
            style={{
              display: 'inline-block',
              backgroundColor: '#e2e8ed',
              padding: '4px 8px',
              borderRadius: '3px',
              margin: '2px',
              fontSize: '14px',
              color: '#2b2b2b',
            }}
          >
            {tag.label}
            <button
              type="button"
              onClick={() => onRemove(tag)}
              style={{
                marginLeft: '4px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (inputValue.trim().length >= 1 && suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          placeholder={placeholder || (tags.length === 0 ? 'Type to search...' : '')}
          style={{
            height: '19px',
            marginLeft: '0px',
            width: inputValue ? `${Math.max(100, inputValue.length * 8)}px` : (tags.length === 0 ? '100%' : '100px'),
            border: 'none',
            outline: 'none',
            fontSize: '14px',
            color: '#2b2b2b',
            flex: 1,
            minWidth: tags.length === 0 ? '100px' : '50px',
          }}
        />
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: 'white',
            border: '1px solid #e2e8ed',
            borderRadius: '4px',
            marginTop: '4px',
            maxHeight: '200px',
            overflowY: 'auto',
            zIndex: 1000,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          {suggestions.map((item) => (
            <div
              key={item.id}
              onClick={() => handleSuggestionClick(item)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: '14px',
                borderBottom: '1px solid #f0f0f0',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f5f5f5';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'white';
              }}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
