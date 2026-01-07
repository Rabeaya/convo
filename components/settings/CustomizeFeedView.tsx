'use client';

/**
 * Customize Feed View
 *
 * AngularJS sources:
 * - web_app/src/app/settings/templates/customizeFeed.tpl.html
 * - web_app/src/app/settings/cnvCustomizeFeed.js
 * - web_app/src/app/settings/hiddenGroupsAndTeammatesModal/cnvHiddenGroupsAndTeammatesModal.tpl.html
 * - web_app/src/app/settings/hiddenGroupsAndTeammatesModal/cnvHiddenGroupsAndTeammatesModalCtrl.js
 * - web_app/src/app/settings/hiddenGroupsAndTeammatesModal/cnvHiddenGroupsAndTeammatesModal.less
 * - web_app/src/app/common/listItemRenderers/imgLabelListItem.tpl.html
 * - web_app/src/app/common/listItemRenderers/styles.less
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import UserProfileImage from '@/components/common/UserProfileImage';
import { useGroups } from '@/lib/hooks/use-groups';
import { useCustomizeFeedSettings, useSaveSettingByName } from '@/lib/hooks/use-settings';
import { useUsers } from '@/lib/hooks/use-users';
import { useAuthStore } from '@/lib/stores/auth-store';

type FilterType = 'USER' | 'GROUP' | 'CONTACT' | 'SEPARATOR' | 'ERROR';

export interface TagItem {
  type: 'USER' | 'GROUP';
  id: string;
  label: string;
  desclabel?: string;
  classes?: string;
  imgurl?: string;
  invited?: boolean;
  status?: string;
  labelisemail?: boolean;
  labelisphone?: boolean;
}

interface SharingOption {
  type: 'USER' | 'GROUP';
  share_to: string;
}

interface RegularGroupSetting {
  group_id?: string;
  id?: string;
  hide_from_feed?: number | boolean;
}

interface CustomizeFeedSettingsData {
  sharing_options: number;
  sharing_options_list: SharingOption[];
  profile_groups_settings: unknown[];
  regular_groups_settings: RegularGroupSetting[];
  share_link_of_new_posts_in_chat?: unknown;
}

function escapeRegexChars(str: string): string {
  // Matches AngularJS utils.escapeRegexCharsRegex:
  // new RegExp("([{}\\(\\)\\^$&.\\*\\?\\/\\+\\|\\[\\\\\\]]|\\]|\\-)", "g")
  // eslint-disable-next-line no-useless-escape
  return str.replace(/([{}\(\)\^$&.\*\?\/\+\|\[\\\]|\-])/g, '\\$1');
}

function getUserGroupSearchRegex(str: string): RegExp {
  // Matches AngularJS utils.getUserGroupSearchRegex:
  // new RegExp("(([\\s,<>():._])|^)(" + escapeRegexChars(str) + ")", "gi")
  return new RegExp(`(([\\s,<>():._])|^)(${escapeRegexChars(str)})`, 'gi');
}

function normalizeBoolean(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val === 1;
  if (typeof val === 'string') return val === '1' || val.toLowerCase() === 'true';
  return false;
}

function uniqueByKey<T>(items: T[], keyFn: (t: T) => string): T[] {
  const seen = new Set<string>();
  const res: T[] = [];
  for (const item of items) {
    const k = keyFn(item);
    if (seen.has(k)) continue;
    seen.add(k);
    res.push(item);
  }
  return res;
}

function buildGroupIconClasses(groupAccess: unknown): string {
  const access = String(groupAccess || '').toLowerCase();
  if (access === 'public') return 'group Icon1_PublicChannel-01-lightgray';
  if (access === 'private' || access === 'profile') return 'group privateGroup_icon-lightgray';
  if (access === 'secret') return 'group privateGroup_icon-lightgray';
  return 'group Icon1_PublicChannel-01-lightgray';
}

function getGroupIdFromHiddenSetting(s: RegularGroupSetting): string | null {
  if (s.group_id) return String(s.group_id);
  if (s.id) return String(s.id);
  return null;
}

function highlightParts(text: string, query: string): Array<string | { bold: string }> {
  if (!query.trim()) return [text];
  const regx = getUserGroupSearchRegex(query);
  const parts: Array<string | { bold: string }> = [];

  let lastIdx = 0;
  let m: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((m = regx.exec(text)) !== null) {
    const prefix = m[1] || '';
    const matched = m[3] || '';
    const matchIdx = m.index;

    const prefixIdx = matchIdx;
    const boldIdx = prefixIdx + prefix.length;

    if (prefixIdx > lastIdx) parts.push(text.slice(lastIdx, prefixIdx));
    if (prefix.length) parts.push(prefix);
    if (matched.length) parts.push({ bold: matched });

    lastIdx = boldIdx + matched.length;
    if (regx.lastIndex === m.index) regx.lastIndex += 1;
  }

  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts.length ? parts : [text];
}

function renderHighlighted(text: string | undefined, query: string) {
  if (!text) return null;
  const parts = highlightParts(text, query);
  return parts.map((p, idx) => {
    if (typeof p === 'string') return <span key={idx}>{p}</span>;
    return (
      <b key={idx} style={{ fontWeight: 700 }}>
        {p.bold}
      </b>
    );
  });
}

function makeUserTagItem(user: any, isAdmin: boolean, loggedInUserId: string | undefined): TagItem {
  const userId = String(user.user_id || user.userId || user.id);

  const fullNameRaw =
    (user.fullName as string | undefined) ||
    (user.name as string | undefined) ||
    `${String(user.first_name || user.firstName || '').trim()} ${String(user.last_name || user.lastName || '').trim()}`.trim();

  const signUpIdentity = user.sign_up_identity ?? user.signUpIdentity;
  const isPhoneIdentity = Number(signUpIdentity) === 3;

  const showEmail = normalizeBoolean(user.show_email);
  const showPhone = normalizeBoolean(user.show_phone);

  let descLabel = '';
  let labelIsEmail = false;
  let labelIsPhone = false;

  // Angular: show admin the signup info (or self)
  if (isAdmin || (loggedInUserId && String(loggedInUserId) === userId)) {
    if (!isPhoneIdentity) {
      labelIsEmail = true;
      descLabel = String(user.email || '');
    } else {
      labelIsPhone = true;
      descLabel = String(user.phone_no || user.phone || '');
    }
  } else {
    // Angular: only visible info for non-admin
    if (showEmail && user.email) {
      labelIsEmail = true;
      descLabel = String(user.email);
    } else if (showPhone && (user.phone_no || user.phone)) {
      labelIsPhone = true;
      descLabel = String(user.phone_no || user.phone);
    } else {
      descLabel = '';
    }
  }

  const label = fullNameRaw && fullNameRaw.trim().length ? fullNameRaw.trim() : descLabel;

  return {
    type: 'USER',
    id: userId,
    label,
    desclabel: descLabel || undefined,
    labelisemail: labelIsEmail,
    labelisphone: labelIsPhone,
    email: user.email,
    phone_no: user.phone_no || user.phone,
    classes: 'user',
    imgurl: user.profile_picture ? String(user.profile_picture) : undefined,
    invited: user.status === 'INVITED',
    status: user.status,
  } as TagItem & Record<string, unknown>;
}

function makeGroupTagItem(group: any): TagItem {
  const id = String(group.id);
  const title = String(group.title || group.name || id);
  return {
    type: 'GROUP',
    id,
    label: title,
    desclabel: 'Group',
    classes: buildGroupIconClasses(group.access),
    imgurl: '',
  };
}

function isSameTag(a: TagItem, b: TagItem): boolean {
  return a.type === b.type && a.id === b.id;
}

const HISTORY_KEY_USERS_AND_GROUPS = 'cnv_customize_feed_users_groups_history_v1';
const HISTORY_KEY_GROUPS = 'cnv_customize_feed_groups_history_v1';

function loadHistory(key: string): TagItem[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return (parsed as any[])
      .filter((x) => x && typeof x === 'object')
      .map((x: any) => ({
        id: String(x.id),
        type: x.type === 'USER' ? 'USER' : 'GROUP',
        label: String(x.label || x.id),
        desclabel: x.desclabel ? String(x.desclabel) : undefined,
        classes: x.classes ? String(x.classes) : undefined,
        imgurl: x.imgurl ? String(x.imgurl) : undefined,
        invited: !!x.invited,
        status: x.status ? String(x.status) : undefined,
      }));
  } catch {
    return [];
  }
}

function saveHistory(key: string, item: TagItem) {
  try {
    const existing = loadHistory(key);
    const next = uniqueByKey([item, ...existing], (t) => `${t.type}:${t.id}`).slice(0, 10);
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export default function CustomizeFeedView() {
  const queryClient = useQueryClient();

  const user = useAuthStore((s) => s.user);
  const isAdmin = Boolean((user as any)?.isAdmin || (user as any)?.is_admin);
  const loggedInUserId = (user as any)?.user_id || (user as any)?.userId;

  const { data: settingsData, isLoading: settingsLoading } = useCustomizeFeedSettings(true);
  const { data: groupsData } = useGroups(true);
  const { data: usersData } = useUsers(true);

  const saveSettingMutation = useSaveSettingByName();

  const groups = groupsData?.groups || [];
  const publishableUsers = usersData?.publishableUsers || [];
  const usersMap = usersData?.usersMap || {};

  const groupsMap = useMemo(() => {
    const m: Record<string, any> = {};
    for (const g of groups) m[String(g.id)] = g;
    return m;
  }, [groups]);

  const [initialized, setInitialized] = useState(false);
  const [userAndGroupList, setUserAndGroupList] = useState<TagItem[]>([]);
  const [groupList, setGroupList] = useState<TagItem[]>([]);
  const [hiddenGroups, setHiddenGroups] = useState<RegularGroupSetting[]>([]);
  const [hiddenGroupsMap, setHiddenGroupsMap] = useState<Record<string, boolean>>({});
  const [sharingOptions, setSharingOptions] = useState<number>(0);
  const [viewHiddenGroupsText, setViewHiddenGroupsText] = useState('View hidden groups');
  const [isHiddenGroupsModalOpen, setIsHiddenGroupsModalOpen] = useState(false);
  // SHARE LINK OF NEW POSTS IN CHAT:
  // Implemented as a checkbox ("Always ask...") + a "Default setting" (Yes/No) radio group.
  // We store this as a single numeric setting for now:
  // 1 = Always ask
  // 2 = Yes, automatically
  // 3 = No
  const [alwaysAskShareLink, setAlwaysAskShareLink] = useState<boolean>(true);
  const [defaultShareLinkSetting, setDefaultShareLinkSetting] = useState<2 | 3>(2);

  const [showSavedBanner, setShowSavedBanner] = useState(false);
  const bannerTimeoutRef = useRef<number | null>(null);

  const updateSavedBanner = useCallback(() => {
    setShowSavedBanner(true);
    if (bannerTimeoutRef.current) window.clearTimeout(bannerTimeoutRef.current);
    bannerTimeoutRef.current = window.setTimeout(() => setShowSavedBanner(false), 2500);
  }, []);

  const saveSettingByName = useCallback(
    (settingName: string, value: unknown, showBanner: boolean) => {
      saveSettingMutation.mutate(
        { settingName, value },
        {
          onSuccess: () => {
            if (showBanner) updateSavedBanner();
            queryClient.invalidateQueries({ queryKey: ['feed'] });
          },
        }
      );
    },
    [queryClient, saveSettingMutation, updateSavedBanner]
  );

  // initialize() -> updateView() parity
  useEffect(() => {
    const s = settingsData as CustomizeFeedSettingsData | undefined;
    if (!s) return;

    setInitialized(true);

    // sharing options list -> tag items
    const list: TagItem[] = [];
    const sharingList = Array.isArray(s.sharing_options_list) ? s.sharing_options_list : [];
    for (const item of sharingList) {
      if (!item || !item.share_to) continue;
      if (item.type === 'USER') {
        const u = usersMap[String(item.share_to)];
        if (u) list.push(makeUserTagItem(u, isAdmin, loggedInUserId));
        else list.push({ type: 'USER', id: String(item.share_to), label: String(item.share_to), classes: 'user' });
      } else if (item.type === 'GROUP') {
        const g = groupsMap[String(item.share_to)];
        if (g) list.push(makeGroupTagItem(g));
        else list.push({ type: 'GROUP', id: String(item.share_to), label: String(item.share_to), desclabel: 'Group' });
      }
    }
    setUserAndGroupList(uniqueByKey(list, (t) => `${t.type}:${t.id}`));

    // hidden groups
    const regular = Array.isArray(s.regular_groups_settings) ? s.regular_groups_settings : [];
    const hidden: RegularGroupSetting[] = [];
    const hiddenMap: Record<string, boolean> = {};
    for (const r of regular) {
      const hide = normalizeBoolean(r.hide_from_feed) || Number(r.hide_from_feed) === 1;
      if (!hide) continue;
      hidden.push(r);
      const gid = getGroupIdFromHiddenSetting(r);
      if (gid) hiddenMap[gid] = true;
    }
    setHiddenGroups(hidden);
    setHiddenGroupsMap(hiddenMap);
    setViewHiddenGroupsText(hidden.length ? `View ${hidden.length} hidden groups` : 'View hidden groups');

    setSharingOptions(Number(s.sharing_options || 0));

    // SHARE LINK OF NEW POSTS IN CHAT:
    // Fix "radio not working": only hydrate from settings when the server actually provides a value.
    const raw = (s as any).share_link_of_new_posts_in_chat;
    if (raw !== undefined && raw !== null && raw !== '') {
      const n = Number(raw);
      if (n === 1) {
        setAlwaysAskShareLink(true);
      } else if (n === 2) {
        setAlwaysAskShareLink(false);
        setDefaultShareLinkSetting(2);
      } else if (n === 3) {
        setAlwaysAskShareLink(false);
        setDefaultShareLinkSetting(3);
      } else if (raw === true || raw === 'true') {
        setAlwaysAskShareLink(false);
        setDefaultShareLinkSetting(2);
      } else if (raw === false || raw === 'false') {
        setAlwaysAskShareLink(false);
        setDefaultShareLinkSetting(3);
      }
    }
  }, [groupsMap, isAdmin, loggedInUserId, settingsData, usersMap]);

  useEffect(() => {
    return () => {
      if (bannerTimeoutRef.current) window.clearTimeout(bannerTimeoutRef.current);
    };
  }, []);

  const handleSharingOptionAdded = useCallback(
    (item: TagItem) => {
      const sharingObj: SharingOption = { type: item.type, share_to: item.id };
      saveSettingByName('sharing_options_list', { added_sharing_options: [sharingObj] }, true);
      saveHistory(HISTORY_KEY_USERS_AND_GROUPS, item);
    },
    [saveSettingByName]
  );

  const handleSharingOptionRemoved = useCallback(
    (item: TagItem) => {
      const sharingObj: SharingOption = { type: item.type, share_to: item.id };
      saveSettingByName('sharing_options_list', { removed_sharing_options: [sharingObj] }, true);
    },
    [saveSettingByName]
  );

  const handleResetToDefault = useCallback(() => {
    saveSettingMutation.mutate(
      { settingName: 'reset_to_default_sharing_options', value: 1 },
      {
        onSuccess: (response: any) => {
          updateSavedBanner();
          queryClient.invalidateQueries({ queryKey: ['feed'] });

          const listFromResponse =
            response?.data?.sharing_options_list ||
            response?.data?.data?.sharing_options_list ||
            response?.sharing_options_list ||
            response?.data?.data?.data?.sharing_options_list;

          if (!Array.isArray(listFromResponse)) return;

          const tags: TagItem[] = [];
          for (const item of listFromResponse as SharingOption[]) {
            if (!item || !item.share_to) continue;
            if (item.type === 'USER') {
              const u = usersMap[String(item.share_to)];
              if (u) tags.push(makeUserTagItem(u, isAdmin, loggedInUserId));
              else tags.push({ type: 'USER', id: String(item.share_to), label: String(item.share_to), classes: 'user' });
            } else if (item.type === 'GROUP') {
              const g = groupsMap[String(item.share_to)];
              if (g) tags.push(makeGroupTagItem(g));
              else tags.push({ type: 'GROUP', id: String(item.share_to), label: String(item.share_to), desclabel: 'Group' });
            }
          }
          setUserAndGroupList(uniqueByKey(tags, (t) => `${t.type}:${t.id}`));
        },
      }
    );
  }, [groupsMap, isAdmin, loggedInUserId, queryClient, saveSettingMutation, updateSavedBanner, usersMap]);

  const handleUpdateCheckboxSettings = useCallback(
    (checked: boolean) => {
      // Angular template has settingQA commented out, so behavior is toggling 0 <-> 2.
      const valBit = checked ? 2 : 0;
      setSharingOptions(valBit);
      saveSettingByName('sharing_options', valBit, true);
    },
    [saveSettingByName]
  );

  const handleHideGroupsFromFeed = useCallback(() => {
    if (!groupList.length) return;

    const listToHide: Array<{ id: string; hide_from_feed: number }> = [];
    const newHiddenGroups = [...hiddenGroups];
    const newHiddenMap: Record<string, boolean> = { ...hiddenGroupsMap };

    for (const item of groupList) {
      listToHide.push({ id: item.id, hide_from_feed: 1 });
      newHiddenGroups.push({ id: item.id, group_id: item.id, hide_from_feed: 1 });
      newHiddenMap[item.id] = true;
      saveHistory(HISTORY_KEY_GROUPS, item);
    }

    // Angular does NOT show banner for group_subscriptions
    saveSettingMutation.mutate(
      { settingName: 'group_subscriptions', value: listToHide },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['feed'] });
          queryClient.invalidateQueries({ queryKey: ['groups'] });
          setGroupList([]);
          setHiddenGroups(newHiddenGroups);
          setHiddenGroupsMap(newHiddenMap);
          setViewHiddenGroupsText(
            newHiddenGroups.length ? `View ${newHiddenGroups.length} hidden groups` : 'View hidden groups'
          );
        },
      }
    );
  }, [groupList, hiddenGroups, hiddenGroupsMap, queryClient, saveSettingMutation]);

  const getAutoCompleteUserAndGroupsItems = useCallback(
    async (query: string, numSelected: number) => {
      const q = query || '';
      const maxResults = Math.max(0, (numSelected || 0) + 4);

      const history = loadHistory(HISTORY_KEY_USERS_AND_GROUPS).filter((h) => !userAndGroupList.some((t) => isSameTag(t, h)));

      // Exclude invited users (Angular passes PUBLISHABLE_INVITED_USERS_MAP to exclude)
      const usersFiltered = publishableUsers
        .filter((u) => u.status !== 'INVITED')
        .map((u) => makeUserTagItem(u, isAdmin, loggedInUserId))
        .filter((u) => !userAndGroupList.some((t) => isSameTag(t, u)));

      const groupsFiltered = groups.map((g) => makeGroupTagItem(g)).filter((g) => !userAndGroupList.some((t) => isSameTag(t, g)));

      const combined = [...history, ...usersFiltered, ...groupsFiltered];

      if (!q.trim()) return combined.slice(0, maxResults);

      const regx = getUserGroupSearchRegex(q);
      const matched = combined.filter((item) => regx.test(item.label || '') || regx.test(item.desclabel || ''));
      return matched.slice(0, maxResults);
    },
    [groups, isAdmin, loggedInUserId, publishableUsers, userAndGroupList]
  );

  const getAutoCompleteGroupsItems = useCallback(
    async (query: string) => {
      const q = query || '';
      const maxResults = 4 + groupList.length;

      const history = loadHistory(HISTORY_KEY_GROUPS)
        .filter((h) => h.type === 'GROUP')
        .filter((h) => !hiddenGroupsMap[h.id])
        .filter((h) => !groupList.some((t) => isSameTag(t, h)));

      const list = groups
        .map((g) => makeGroupTagItem(g))
        .filter((g) => !hiddenGroupsMap[g.id])
        .filter((g) => !groupList.some((t) => isSameTag(t, g)));

      const combined = [...history, ...list];

      if (!q.trim()) return combined.slice(0, maxResults);

      const regx = getUserGroupSearchRegex(q);
      const matched = combined.filter((item) => regx.test(item.label || ''));
      return matched.slice(0, maxResults);
    },
    [groupList, groups, hiddenGroupsMap]
  );

  if (!initialized || settingsLoading) {
    return (
      <div className="loading-spinner">
        <img src="/assets/img/feed/loading-spin.svg" alt="Loading icon" />
      </div>
    );
  }

  return (
    <div style={{ paddingLeft: '120px' }}>
      {showSavedBanner && (
        <div className="cnv-settings-saved-banner" role="status" aria-live="polite">
          Your settings have been saved.
        </div>
      )}

      <div className="header">Feed and sharing</div>
      <div style={{ marginTop: '20px' }}></div>

      <div className="subHeader">DEFAULT RECIPIENTS FOR MY POSTS</div>
      <hr />
      <div style={{ marginTop: '10px', color: '#7b8386' }}>
        When you start a new post, we'll prefill the recipients with whoever is listed below.
        <br />
        Type the name of a group or teammate to set your own default recipient.
      </div>

      <div style={{ marginTop: '20px' }}>
        <div style={{ display: 'inline-block', width: '40px', verticalAlign: 'sub' }}>To:</div>
        <div className="to-field-cont">
          <TagsInput
            tags={userAndGroupList}
            placeholder={userAndGroupList.length ? '' : 'Type the name of a group or teammate'}
            loadHistoryOnFocus={true}
            autoSelectFirstSuggestion={true}
            historyKey={HISTORY_KEY_USERS_AND_GROUPS}
            getSuggestions={(q) => getAutoCompleteUserAndGroupsItems(q, userAndGroupList.length)}
            onAdd={(item) => {
              if (!userAndGroupList.some((t) => isSameTag(t, item))) setUserAndGroupList([...userAndGroupList, item]);
              handleSharingOptionAdded(item);
            }}
            onRemove={(item) => {
              setUserAndGroupList(userAndGroupList.filter((t) => !isSameTag(t, item)));
              handleSharingOptionRemoved(item);
            }}
          />
        </div>
        <div style={{ display: 'inline-block', marginLeft: '30px' }}>
          <a
            href="javascript:void(0)"
            onClick={(e) => {
              e.preventDefault();
              handleResetToDefault();
            }}
          >
            Restore defaults
          </a>
        </div>
      </div>

      <div style={{ marginTop: '20px' }}>
        Also use these default recipients for:
        <br />
        <br />
        <input
          type="checkbox"
          className="cnv-checkbox"
          id="settingMA"
          checked={sharingOptions === 2 || sharingOptions === 3}
          onChange={(e) => handleUpdateCheckboxSettings(e.target.checked)}
        />
        <label htmlFor="settingMA"></label>
        <div style={{ display: 'inline', marginLeft: '5px' }}>Convo mobile apps.</div>
      </div>

      <div className="subHeader">SHARE LINK OF NEW POSTS IN CHAT</div>
      <hr />
      <div style={{ marginTop: '10px', color: '#7b8386' }}>
        You can choose to share the link of the post with all users mentioned in the post automatically in chat.
        <br />
        This setting will be applied on mobile apps as well.
      </div>

      <div style={{ marginTop: '20px' }}>
        <input
          type="checkbox"
          className="cnv-checkbox"
          id="shareLinkAskChk"
          checked={alwaysAskShareLink}
          onChange={(e) => {
            const checked = e.target.checked;
            setAlwaysAskShareLink(checked);

            if (checked) {
              // Ask every time
              saveSettingByName('share_link_of_new_posts_in_chat', 1, true);
            } else {
              // Revert to current default (Yes/No)
              saveSettingByName('share_link_of_new_posts_in_chat', defaultShareLinkSetting, true);
            }
          }}
        />
        <label htmlFor="shareLinkAskChk"></label>
        <div style={{ display: 'inline', marginLeft: '5px', fontSize: '14px', color: '#2b2b2b' }}>
          Always ask me if i want to share link in chat
        </div>
      </div>

      <div style={{ marginTop: '20px' }}>
        <div className="header">
          <u>Default setting</u>
        </div>
      </div>

      <div style={{ marginTop: '10px' }}>
        <div style={{ fontSize: '14px', color: '#2b2b2b' }}>
          <div style={{ marginBottom: '10px' }}>
            <input
              type="radio"
              id="shareLinkYes"
              name="shareLinkDefaultSetting"
              checked={!alwaysAskShareLink && defaultShareLinkSetting === 2}
              disabled={alwaysAskShareLink}
              onChange={() => {
                setDefaultShareLinkSetting(2);
                setAlwaysAskShareLink(false);
                saveSettingByName('share_link_of_new_posts_in_chat', 2, true);
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
              name="shareLinkDefaultSetting"
              checked={!alwaysAskShareLink && defaultShareLinkSetting === 3}
              disabled={alwaysAskShareLink}
              onChange={() => {
                setDefaultShareLinkSetting(3);
                setAlwaysAskShareLink(false);
                saveSettingByName('share_link_of_new_posts_in_chat', 3, true);
              }}
              style={{ marginRight: '8px', verticalAlign: 'middle' }}
            />
            <label htmlFor="shareLinkNo" style={{ fontSize: '14px', cursor: alwaysAskShareLink ? 'not-allowed' : 'pointer', verticalAlign: 'middle' }}>
              No, don&apos;t share link of new posts in chat
            </label>
          </div>
        </div>
      </div>

      <div className="subHeader">HIDE POSTS FROM MY FEED</div>
      <hr />
      <div style={{ marginTop: '10px', color: '#7b8386' }}>
        You can adjust what you see in your feed by hiding or unhiding groups.
        <br />
        You can still find hidden posts by searching or by visiting the group view.
      </div>

      <div style={{ marginTop: '20px' }}>
        <div style={{ display: 'inline-block', width: '125px', verticalAlign: 'middle' }}>
          Hide posts from these groups
        </div>
        <div className="to-field-cont">
          <TagsInput
            tags={groupList}
            placeholder={groupList.length ? '' : 'Type the name of a group'}
            loadHistoryOnFocus={true}
            autoSelectFirstSuggestion={true}
            historyKey={HISTORY_KEY_GROUPS}
            getSuggestions={(q) => getAutoCompleteGroupsItems(q)}
            onAdd={(item) => {
              if (!groupList.some((t) => isSameTag(t, item))) setGroupList([...groupList, item]);
            }}
            onRemove={(item) => setGroupList(groupList.filter((t) => !isSameTag(t, item)))}
          />
        </div>
        <button
          id="hideGroupsBtn"
          style={{ marginLeft: '50px' }}
          onClick={handleHideGroupsFromFeed}
          type="button"
          className={`btn btn-primary ${groupList.length ? '' : 'disabled'}`}
          disabled={!groupList.length}
        >
          Hide
        </button>
      </div>

      <div style={{ marginLeft: '130px', marginTop: '10px' }}>
        <a
          href="javascript:void(0)"
          id="hiddenGroups"
          className={hiddenGroups.length ? '' : 'anchorDisabled'}
          onClick={(e) => {
            e.preventDefault();
            if (!hiddenGroups.length) return;
            setIsHiddenGroupsModalOpen(true);
          }}
        >
          {viewHiddenGroupsText}
        </a>
      </div>

      {isHiddenGroupsModalOpen && (
        <HiddenGroupsModal
          hiddenGroups={hiddenGroups}
          groupsMap={groupsMap}
          onClose={() => setIsHiddenGroupsModalOpen(false)}
          onHiddenGroupsChange={(nextHiddenGroups) => {
            setHiddenGroups(nextHiddenGroups);
            const nextMap: Record<string, boolean> = {};
            for (const h of nextHiddenGroups) {
              const gid = getGroupIdFromHiddenSetting(h);
              if (gid) nextMap[gid] = true;
            }
            setHiddenGroupsMap(nextMap);
            setViewHiddenGroupsText(nextHiddenGroups.length ? `View ${nextHiddenGroups.length} hidden groups` : 'View hidden groups');
          }}
          onUnhide={(groupId) => {
            saveSettingMutation.mutate(
              { settingName: 'group_subscriptions', value: [{ id: groupId, hide_from_feed: 0 }] },
              {
                onSuccess: () => {
                  queryClient.invalidateQueries({ queryKey: ['feed'] });
                  queryClient.invalidateQueries({ queryKey: ['groups'] });
                },
              }
            );
          }}
        />
      )}

      <div style={{ marginTop: '180px' }}></div>

      <style jsx global>{`
        .loading-spinner {
          position: absolute;
          left: 50%;
          margin-left: -16px;
          top: 50%;
          margin-top: -16px;
        }

        .cnv-settings-saved-banner {
          width: 100%;
          background: #dbebff;
          color: #2b2b2b;
          border: 1px solid #a6c5ec;
          border-radius: 3px;
          padding: 10px 12px;
          margin: 10px 0 20px 0;
          font-size: 14px;
          font-family: 'Source Sans Pro', sans-serif;
        }

        /* Modal styles migrated from cnvHiddenGroupsAndTeammatesModal.less */
        .cnv-hidden-groups-teammates {
          position: fixed;
          inset: 0;
          z-index: 2000;
        }
        .cnv-hidden-groups-teammates .cnv-modal-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.45);
        }
        .cnv-hidden-groups-teammates .modal-dialog {
          width: 640px;
          margin-top: 70px;
          margin-left: auto;
          margin-right: auto;
          position: relative;
          z-index: 1;
        }
        .cnv-hidden-groups-teammates .modal-content {
          background: #fff;
          border-radius: 6px;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
          overflow: hidden;
        }
        .cnv-hidden-groups-teammates .modal-body {
          height: 460px;
          padding: 0px 20px 20px 20px;
        }
        .cnv-hidden-groups-teammates input[type='text'] {
          border: 1px solid #e2e8ed;
          width: 250px;
          border-radius: 6px;
          padding: 7px;
          margin: 5px 0px 10px 20px;
          outline: none !important;
        }
        .cnv-hidden-groups-teammates input[type='text']:focus,
        .cnv-hidden-groups-teammates input[type='text']:active {
          border-color: #d9e4ed;
        }

        .btn-default {
          padding: 8px 16px;
          background-color: #f2f4f8;
          color: #2b2b2b;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-family: 'Source Sans Pro', sans-serif;
        }
        .btn-default:hover {
          background-color: #e9edf4;
        }

        /* Autocomplete list (ported from common/listItemRenderers/styles.less) */
        .cnv-autocomplete-menu {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: #fff;
          border: 1px solid #e2e8ed;
          border-radius: 4px;
          margin-top: 4px;
          max-height: 240px;
          overflow-y: auto;
          z-index: 1500;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        .cnv-autocomplete-item {
          display: inline-block;
          width: 100%;
          position: relative;
          padding: 6px 2px 1px 41px;
          box-sizing: border-box;
          height: 48px;
          white-space: nowrap;
          cursor: pointer;
        }
        .cnv-autocomplete-item:hover {
          background: #f7f7f7;
        }
        .cnv-autocomplete-item .list-item-status {
          position: absolute;
          top: 50%;
          margin-top: -9px;
          padding: 2px 3px;
          right: 4px;
          line-height: 12px;
          border-radius: 2px;
          font-size: 12px;
          background: white;
          color: #969595;
          border: 1px solid #e0e0e0;
        }
        .cnv-autocomplete-item .sec-label {
          font-size: 12px;
          color: #aaa;
          padding-bottom: 3px;
          max-width: 420px;
          display: inline-block;
        }
        .cnv-autocomplete-item > i.group {
          font-size: 12px;
          position: absolute;
          left: 2px;
          top: 8px;
          border: 1px solid #e0e0e0;
          border-radius: 100%;
          width: 32px;
          height: 32px;
          background-size: 20px;
          background-position: center;
        }
        .cnv-autocomplete-item .single-user {
          position: absolute;
          left: 2px;
          top: 8px;
        }
      `}</style>
    </div>
  );
}

interface TagsInputProps {
  tags: TagItem[];
  placeholder: string;
  loadHistoryOnFocus: boolean;
  autoSelectFirstSuggestion: boolean;
  historyKey: string;
  getSuggestions: (query: string) => Promise<TagItem[]>;
  onAdd: (item: TagItem) => void;
  onRemove: (item: TagItem) => void;
}

function TagsInput({
  tags,
  placeholder,
  loadHistoryOnFocus,
  autoSelectFirstSuggestion,
  historyKey,
  getSuggestions,
  onAdd,
  onRemove,
}: TagsInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<TagItem[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(
    async (q: string) => {
      const items = await getSuggestions(q);
      setSuggestions(items);
      setActiveIndex(0);
      setOpen(true);
    },
    [getSuggestions]
  );

  useEffect(() => {
    const onDocMouseDown = (evt: MouseEvent) => {
      const t = evt.target as Node;
      if (menuRef.current?.contains(t)) return;
      if (inputRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const commit = useCallback(
    (item: TagItem) => {
      onAdd(item);
      saveHistory(historyKey, item);
      setInputValue('');
      setSuggestions([]);
      setOpen(false);
      setActiveIndex(0);
      inputRef.current?.focus();
    },
    [historyKey, onAdd]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!open) {
        if (e.key === 'Backspace' && !inputValue && tags.length) onRemove(tags[tags.length - 1]);
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((idx) => Math.min(idx + 1, Math.max(0, suggestions.length - 1)));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((idx) => Math.max(idx - 1, 0));
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        return;
      }

      const isCommit = e.key === 'Enter' || e.key === ',';
      if (isCommit) {
        if (autoSelectFirstSuggestion && suggestions.length) {
          e.preventDefault();
          commit(suggestions[Math.max(0, Math.min(activeIndex, suggestions.length - 1))]);
        } else {
          e.preventDefault();
        }
      } else if (e.key === 'Backspace' && !inputValue && tags.length) {
        onRemove(tags[tags.length - 1]);
      }
    },
    [activeIndex, autoSelectFirstSuggestion, commit, inputValue, onRemove, open, suggestions, tags]
  );

  return (
    <div style={{ position: 'relative' }}>
      <div className="tags" style={{ minHeight: '40px', display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
        {tags.map((tag) => (
          <span
            key={`${tag.type}:${tag.id}`}
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
                lineHeight: '14px',
              }}
              aria-label={`Remove ${tag.label}`}
            >
              ×
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={async (e) => {
            const v = e.target.value;
            setInputValue(v);
            await refresh(v);
          }}
          onKeyDown={onKeyDown}
          onFocus={async () => {
            if (!loadHistoryOnFocus) return;
            await refresh(inputValue);
          }}
          placeholder={placeholder}
          style={{
            height: '19px',
            marginLeft: '0px',
            width: inputValue ? `${Math.max(100, inputValue.length * 8)}px` : tags.length === 0 ? '100%' : '100px',
            border: 'none',
            outline: 'none',
            fontSize: '14px',
            color: '#2b2b2b',
            flex: 1,
            minWidth: tags.length === 0 ? '100px' : '50px',
          }}
          spellCheck={false}
        />
      </div>

      {open && suggestions.length > 0 && (
        <div ref={menuRef} className="cnv-autocomplete-menu" role="listbox" aria-label="Suggestions">
          {suggestions.map((item, idx) => (
            <div
              key={`${item.type}:${item.id}`}
              className="cnv-autocomplete-item"
              role="option"
              aria-selected={idx === activeIndex}
              onMouseEnter={() => setActiveIndex(idx)}
              onMouseDown={(e) => {
                e.preventDefault();
                commit(item);
              }}
              style={idx === activeIndex ? { background: '#f7f7f7' } : undefined}
            >
              {item.type === 'USER' ? (
                <UserProfileImage
                  className="single-user"
                  userId={item.id}
                  width={32}
                  height={32}
                  imgUrl={item.imgurl || undefined}
                  fullName={item.label}
                />
              ) : (
                <i className={item.classes || 'group'} />
              )}

              <span style={{ display: 'block', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {renderHighlighted(item.label, inputValue)}
              </span>

              {item.desclabel ? <span className="sec-label">{renderHighlighted(item.desclabel, inputValue)}</span> : null}
              {item.invited ? <span className="list-item-status">Invited</span> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface HiddenGroupsModalProps {
  hiddenGroups: RegularGroupSetting[];
  groupsMap: Record<string, any>;
  onClose: () => void;
  onHiddenGroupsChange: (next: RegularGroupSetting[]) => void;
  onUnhide: (groupId: string) => void;
}

function HiddenGroupsModal({ hiddenGroups, groupsMap, onClose, onHiddenGroupsChange, onUnhide }: HiddenGroupsModalProps) {
  const [search, setSearch] = useState('');
  const [isFilteredView, setIsFilteredView] = useState(false);

  const hiddenItems = useMemo(() => {
    const items: TagItem[] = [];
    for (const h of hiddenGroups) {
      const gid = getGroupIdFromHiddenSetting(h);
      if (!gid) continue;
      const g = groupsMap[gid];
      if (g) items.push(makeGroupTagItem(g));
      else items.push({ type: 'GROUP', id: gid, label: gid, desclabel: 'Group', classes: buildGroupIconClasses('public') });
    }
    return uniqueByKey(items, (t) => t.id);
  }, [groupsMap, hiddenGroups]);

  const listToShow = useMemo(() => {
    if (!search.trim()) return hiddenItems;
    const regx = getUserGroupSearchRegex(search);
    return hiddenItems.filter((g) => regx.test(g.label || ''));
  }, [hiddenItems, search]);

  useEffect(() => {
    setIsFilteredView(!!search.trim());
  }, [search]);

  return (
    <div className="cnv-hidden-groups-teammates" role="dialog" aria-modal="true" aria-label="Unhide groups">
      <div className="cnv-modal-backdrop" onMouseDown={onClose} />
      <div className="modal-dialog" role="document">
        <div className="modal-content">
          <div className="modal-header" style={{ padding: '15px 20px', borderBottom: '1px solid #e0e0e0' }}>
            <button type="button" className="close" onClick={onClose} aria-label="Close">
              ×
            </button>
            <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#2b2b2b' }}>Unhide groups</h4>
          </div>
          <div className="modal-body cnvScrollContainer" style={{ overflowY: 'scroll' }}>
            <div style={{ marginTop: '10px' }}>
              <input
                style={{ display: hiddenItems.length > 10 || isFilteredView ? 'block' : 'none' }}
                type="text"
                placeholder="Search for groups"
                className="searchGroupInput"
                spellCheck={false}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              {listToShow.map((group) => (
                <div key={group.id} style={{ padding: '15px 15px 0px 15px' }}>
                  <i style={{ verticalAlign: 'middle' }} className={`cnv-icons-30 ${group.classes || ''}`} />
                  <div style={{ display: 'inline-block', marginLeft: '10px' }}>{group.label}</div>
                  <button
                    style={{ float: 'right', marginRight: '15px' }}
                    type="button"
                    onClick={() => {
                      onUnhide(group.id);
                      const next = hiddenGroups.filter((h) => getGroupIdFromHiddenSetting(h) !== group.id);
                      onHiddenGroupsChange(next);
                    }}
                    className="btn btn-default"
                  >
                    Unhide
                  </button>
                  <hr style={{ border: 'none', borderTop: '1px solid #e0e0e0', margin: '20px 13px 10px 0px' }} />
                </div>
              ))}

              {!hiddenItems.length && (
                <div style={{ marginLeft: '20px' }}>
                  <div style={{ marginTop: '20px' }}>No hidden groups.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


