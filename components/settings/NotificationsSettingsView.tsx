'use client';

/**
 * Notifications Settings View
 *
 * Angular sources:
 * - web_app/src/app/settings/templates/notificationsView.tpl.html
 * - web_app/src/app/settings/cnvNotificationSettings.js
 * - web_app/src/app/settings/settingsService.js (bit ops + saveSettingByName + subscription settings)
 * - web_app/src/app/common/utilFilters.js (tagToUrlFilter)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useGeneralSettings, useSaveSettingByName } from '@/lib/hooks/use-settings';
import { useProcessSubscription, useSubscriptionSettings, useUpdateSubscriptionSettings } from '@/lib/hooks/use-notifications';
import type { SubscriptionTagSearchItem } from '@/lib/api/stdhashtags';

const EMAIL = 1;
const MOBILE = 2;
const DESKTOP = 4;
const NOTIFICATION_CENTER = 8;

const SETTINGS = {
  notify_only_when_away: 'notify_only_when_away',
  play_sound_on_notification: 'play_sound_on_notification',
  notify_updates_in_news_feed: 'notify_updates_in_news_feed',
  enable_desktop_notifications: 'enable_desktop_notifications',
  enable_email_notifications: 'enable_email_notifications',
  enable_device_notifications: 'enable_device_notifications',
  enable_in_app_notifications: 'enable_in_app_notifications',

  notify_directs_and_mentions: 'notify_directs_and_mentions',
  notify_comments_on_my_posts: 'notify_comments_on_my_posts',
  notify_comments_on_posts_i_comment_on: 'notify_comments_on_posts_i_comment_on',
  notify_comments_on_directs: 'notify_comments_on_directs',
  notify_new_group_share: 'notify_new_group_share',
  notify_invites_acceptances: 'notify_invites_acceptances',
  notify_new_follower: 'notify_new_follower',
  notify_incoming_chats: 'notify_incoming_chats',
  notify_user_status_updates: 'notify_user_status_updates',
  notify_group_join_requests: 'notify_group_join_requests',
  send_confirmation_for_email_posts: 'send_confirmation_for_email_posts',
  digest_send_frequency: 'digest_send_frequency',
  profile_groups_settings: 'profile_groups_settings',
  regular_groups_settings: 'regular_groups_settings',
  group_subscriptions: 'group_subscriptions',
  notify_sms_messages: 'notify_sms_messages',
} as const;

function toInt(val: unknown, fallback = 0): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (typeof val === 'string' && val.trim()) {
    const n = Number(val);
    if (!Number.isNaN(n)) return n;
  }
  return fallback;
}

function bitOn(setting: number, bit: number): number {
  return setting | bit;
}

function bitOff(setting: number, bit: number): number {
  return setting & ~bit;
}

function isBitOn(setting: number, bit: number): boolean {
  return (setting & bit) > 0;
}

function tagToUrl(accountId: string, tags: string[]): string {
  // Angular utilFilters.js: convo:/v1/{accountId}/feed?q= + encodeURIComponent('#'+tag) ... + '%20stag%3Dtrue'
  let url = `convo:/v1/${accountId}/feed?q=`;
  let tagUrl = '';
  for (const t of tags || []) {
    tagUrl += encodeURIComponent(`#${t}`);
  }
  if (tagUrl) url += `${tagUrl}%20stag%3Dtrue`;
  return url;
}

type GroupOrUserNotif = {
  group_id?: string;
  user_id?: string;
  name: string;
  desktop?: number | boolean;
  email?: number | boolean;
  mobile?: number | boolean;
  in_app?: number | boolean;
};

export default function NotificationsSettingsView() {
  const loginData = useAuthStore((s) => s.loginData);
  const user = useAuthStore((s) => s.user);
  const account = useAuthStore((s) => s.account);

  const isGuest = Boolean((user as any)?.is_guest_user);
  const accountLevel = String((account as any)?.account_level || 'STARTER');
  const isChatEnabled = toInt((loginData as any)?.network_settings?.is_chat_enabled, 1) === 1;
  const isSubscribedEnabled = toInt((loginData as any)?.network_settings?.is_tag_subscription_enable, 0) === 1;

  const isHMThemeEnabled = String((account as any)?.account_key || '') === 'hm' && toInt((loginData as any)?.network_settings?.is_custom_theme_enabled, 0) === 1;

  const { data: settingsData, isLoading } = useGeneralSettings(true);
  const saveSettingMutation = useSaveSettingByName();

  const [initialized, setInitialized] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const bannerTimeoutRef = useRef<number | null>(null);

  const [activityDropdownOpen, setActivityDropdownOpen] = useState(false);

  const [notificationArr, setNotificationArr] = useState<Record<string, any>>({});

  // Global toggles
  const [disableAllDesktopChk, setDisableAllDesktopChk] = useState(false);
  const [disableAllEmailChk, setDisableAllEmailChk] = useState(false);
  const [disableAllMobileChk, setDisableAllMobileChk] = useState(false);
  const [disableAllIPNChk, setDisableAllIPNChk] = useState(false);

  // Activity dropdown affects whether per-row desktop checkboxes are shown.
  const [showDesktopChk, setShowDesktopChk] = useState(false);
  const [activityNotificationVal, setActivityNotificationVal] = useState(0);

  // Expand sections
  const [showExpandGrpUsr, setShowExpandGrpUsr] = useState(false);
  const [grpLimit, setGrpLimit] = useState(5);
  const [userLimit, setUserLimit] = useState(5);
  const [grpMoreLessLabel, setGrpMoreLessLabel] = useState<'More' | 'Less'>('More');
  const [userMoreLessLabel, setUserMoreLessLabel] = useState<'More' | 'Less'>('More');

  // Manage subscriptions section
  const [showManageSubscription, setShowManageSubscription] = useState(false);
  const [subLimit, setSubLimit] = useState(5);
  const [subMoreLessLabel, setSubMoreLessLabel] = useState<'More' | 'Less'>('More');
  const [subscriptionNotificationList, setSubscriptionNotificationList] = useState<SubscriptionTagSearchItem[]>([]);
  const originalSubscriptionRef = useRef<SubscriptionTagSearchItem[]>([]);
  const [isSubscriptionLoaded, setIsSubscriptionLoaded] = useState(false);

  const subscriptionQuery = useSubscriptionSettings(showManageSubscription && isSubscribedEnabled);
  const updateSubscriptionMutation = useUpdateSubscriptionSettings();
  const processSubscriptionMutation = useProcessSubscription();

  const accountId = String((loginData as any)?.account_id || (account as any)?.account_id || '');

  const userEmail = String((user as any)?.email || '');
  const isSignedupByPhone = toInt((user as any)?.sign_up_identity, 0) === 3;
  const emailVerified = Boolean(userEmail && userEmail.trim());
  const disableEmailMasterByPhoneSignup = isSignedupByPhone && !emailVerified;
  const disableDigestByPhoneSignup = isSignedupByPhone;

  const showBanner = useCallback((text: string, autoHideMs = 4000) => {
    setBanner(text);
    if (bannerTimeoutRef.current) window.clearTimeout(bannerTimeoutRef.current);
    bannerTimeoutRef.current = window.setTimeout(() => setBanner(null), autoHideMs);
  }, []);

  useEffect(() => {
    return () => {
      if (bannerTimeoutRef.current) window.clearTimeout(bannerTimeoutRef.current);
    };
  }, []);

  // Initialize from settings (Angular initialize + updateView)
  useEffect(() => {
    if (!settingsData) return;

    const next: Record<string, any> = {};
    // copy only keys we use, like settingsService.getSettingsForNotificationPage
    Object.values(SETTINGS).forEach((k) => {
      next[k] = (settingsData as any)?.[k];
    });

    setNotificationArr(next);
    setInitialized(true);

    const desktopEnabled = isBitOn(toInt(next[SETTINGS.enable_desktop_notifications], 1), 1);
    const emailEnabled = isBitOn(toInt(next[SETTINGS.enable_email_notifications], 1), 1);
    const mobileEnabled = isBitOn(toInt(next[SETTINGS.enable_device_notifications], 1), 1);
    const ipnEnabled = isBitOn(toInt(next[SETTINGS.enable_in_app_notifications], 1), 1);

    setDisableAllDesktopChk(!desktopEnabled);
    setDisableAllEmailChk(!emailEnabled);
    setDisableAllMobileChk(!mobileEnabled);
    setDisableAllIPNChk(!ipnEnabled);

    // Activity type
    const notifyUpdates = toInt(next[SETTINGS.notify_updates_in_news_feed], 4);
    if (isBitOn(notifyUpdates, 4)) {
      setShowDesktopChk(false);
    } else {
      setShowDesktopChk(true);
      setActivityNotificationVal(notifyUpdates || 0);
    }
  }, [settingsData]);

  // Subscription list loading when manage section opens
  useEffect(() => {
    if (!showManageSubscription) return;
    if (!isSubscribedEnabled) return;
    if (subscriptionQuery.isLoading) return;
    if (subscriptionQuery.data) {
      const data: any = subscriptionQuery.data;
      const list = (data?.data?.tagsearch || []) as SubscriptionTagSearchItem[];
      setSubscriptionNotificationList(list);
      originalSubscriptionRef.current = JSON.parse(JSON.stringify(list));
      setIsSubscriptionLoaded(true);
    }
  }, [isSubscribedEnabled, showManageSubscription, subscriptionQuery.data, subscriptionQuery.isLoading]);

  const saveSettingByName = useCallback(
    (settingName: string, value: any) => {
      saveSettingMutation.mutate(
        { settingName, value },
        {
          onSuccess: () => {
            showBanner('Your settings have been saved.');
          },
        }
      );
    },
    [saveSettingMutation, showBanner]
  );

  const updateBitSetting = useCallback(
    (settingName: string, bit: number, checked: boolean) => {
      setNotificationArr((prev) => {
        const cur = toInt(prev[settingName], 0);
        const next = checked ? bitOn(cur, bit) : bitOff(cur, bit);
        const out = { ...prev, [settingName]: next };
        saveSettingByName(settingName, next);
        return out;
      });
    },
    [saveSettingByName]
  );

  const updateNoBitSetting = useCallback(
    (settingName: string, bit: number, checked: boolean) => {
      // Angular uses bit 1 (or 28 for sound) on a bitmask stored in this setting.
      setNotificationArr((prev) => {
        const cur = toInt(prev[settingName], 0);
        const next = checked ? bitOn(cur, bit) : bitOff(cur, bit);
        const out = { ...prev, [settingName]: next };
        saveSettingByName(settingName, next);
        return out;
      });
    },
    [saveSettingByName]
  );

  const toggleMaster = useCallback(
    (settingName: string, enabled: boolean, setDisabled: (v: boolean) => void) => {
      const nextVal = enabled ? 1 : 0;
      setDisabled(!enabled);
      setNotificationArr((prev) => ({ ...prev, [settingName]: nextVal }));
      saveSettingByName(settingName, nextVal);
    },
    [saveSettingByName]
  );

  const activityChanged = useCallback(
    (isAllActivity: boolean) => {
      setActivityDropdownOpen(false);
      if (isAllActivity) {
        setShowDesktopChk(false);
        setNotificationArr((prev) => ({ ...prev, [SETTINGS.notify_updates_in_news_feed]: 4 }));
        saveSettingByName(SETTINGS.notify_updates_in_news_feed, 4);
      } else {
        setShowDesktopChk(true);
        const val = activityNotificationVal || 0;
        setNotificationArr((prev) => ({ ...prev, [SETTINGS.notify_updates_in_news_feed]: val }));
        saveSettingByName(SETTINGS.notify_updates_in_news_feed, val);
      }
    },
    [activityNotificationVal, saveSettingByName]
  );

  const digest = String(notificationArr[SETTINGS.digest_send_frequency] || 'WEEKLY');
  const setDigest = useCallback(
    (val: 'NEVER' | 'DAILY' | 'WEEKLY') => {
      setNotificationArr((prev) => ({ ...prev, [SETTINGS.digest_send_frequency]: val }));
      saveSettingByName(SETTINGS.digest_send_frequency, val);
    },
    [saveSettingByName]
  );

  const groupsListNotifications: GroupOrUserNotif[] = useMemo(() => {
    const raw = notificationArr[SETTINGS.regular_groups_settings];
    return Array.isArray(raw) ? raw : [];
  }, [notificationArr]);

  const usersListNotifications: GroupOrUserNotif[] = useMemo(() => {
    const raw = notificationArr[SETTINGS.profile_groups_settings];
    return Array.isArray(raw) ? raw : [];
  }, [notificationArr]);

  const expandList = useCallback(
    (type: 'GROUP' | 'USER') => {
      if (type === 'GROUP') {
        if (grpMoreLessLabel === 'More') {
          setGrpLimit(groupsListNotifications.length);
          setGrpMoreLessLabel('Less');
        } else {
          setGrpLimit(5);
          setGrpMoreLessLabel('More');
        }
      } else {
        if (userMoreLessLabel === 'More') {
          setUserLimit(usersListNotifications.length);
          setUserMoreLessLabel('Less');
        } else {
          setUserLimit(5);
          setUserMoreLessLabel('More');
        }
      }
    },
    [grpMoreLessLabel, groupsListNotifications.length, userMoreLessLabel, usersListNotifications.length]
  );

  const updateGroupOrUser = useCallback(
    (id: string, field: 'desktop' | 'email' | 'mobile' | 'in_app', value: number, isGroup: boolean) => {
      // Update local list for immediate UI parity
      if (isGroup) {
        setNotificationArr((prev) => {
          const list = Array.isArray(prev[SETTINGS.regular_groups_settings]) ? [...prev[SETTINGS.regular_groups_settings]] : [];
          const idx = list.findIndex((g: any) => String(g.group_id) === id);
          if (idx >= 0) list[idx] = { ...list[idx], [field]: value };
          return { ...prev, [SETTINGS.regular_groups_settings]: list };
        });
      } else {
        setNotificationArr((prev) => {
          const list = Array.isArray(prev[SETTINGS.profile_groups_settings]) ? [...prev[SETTINGS.profile_groups_settings]] : [];
          const idx = list.findIndex((u: any) => String(u.user_id) === id);
          if (idx >= 0) list[idx] = { ...list[idx], [field]: value };
          return { ...prev, [SETTINGS.profile_groups_settings]: list };
        });
      }

      saveSettingByName(SETTINGS.group_subscriptions, [{ id, [field]: value }]);
    },
    [saveSettingByName]
  );

  const toggleManageSubscriptionLimit = useCallback(() => {
    if (subMoreLessLabel === 'More') {
      setSubLimit(subscriptionNotificationList.length);
      setSubMoreLessLabel('Less');
    } else {
      setSubLimit(5);
      setSubMoreLessLabel('More');
    }
  }, [subMoreLessLabel, subscriptionNotificationList.length]);

  const updateManageSubscriptionNotification = useCallback(
    (obj: SubscriptionTagSearchItem, idx: number) => {
      updateSubscriptionMutation.mutate(obj, {
        onSuccess: (resp: any) => {
          // Angular: if errorCode == 0 revert the row to original
          if (resp?.errorCode === 0) {
            setSubscriptionNotificationList((prev) => {
              const next = [...prev];
              next[idx] = originalSubscriptionRef.current[idx];
              return next;
            });
          } else {
            // commit to original baseline
            originalSubscriptionRef.current[idx] = JSON.parse(JSON.stringify(obj));
          }
          showBanner('Your settings have been saved.');
        },
        onError: () => {
          setSubscriptionNotificationList((prev) => {
            const next = [...prev];
            next[idx] = originalSubscriptionRef.current[idx];
            return next;
          });
          showBanner('Your settings have been saved.');
        },
      });
    },
    [showBanner, updateSubscriptionMutation]
  );

  const unsubscribeNotification = useCallback(
    (obj: SubscriptionTagSearchItem, idx: number) => {
      processSubscriptionMutation.mutate(
        { action: 'unsubscribe', value: obj.value },
        {
          onSuccess: (resp: any) => {
            if (resp?.errorCode === 200) {
              setSubscriptionNotificationList((prev) => prev.filter((_, i) => i !== idx));
            }
          },
        }
      );
    },
    [processSubscriptionMutation]
  );

  const selectedActivityType = useMemo(() => {
    const notifyUpdates = toInt(notificationArr[SETTINGS.notify_updates_in_news_feed], 4);
    if (isBitOn(notifyUpdates, 4)) return "All Activity";
    return 'Specific activity (Customize)';
  }, [notificationArr]);

  const mobileSmsRowVisible = accountLevel !== 'STARTER' && !isGuest;

  if (isLoading && !initialized) {
    return (
      <div className="loading-spinner">
        <img src="/assets/img/feed/loading-spin.svg" alt="Loading icon" />
      </div>
    );
  }

  return (
    <div>
      {banner && <div className="cnv-settings-saved-banner">{banner}</div>}

      <div style={{ paddingLeft: '120px' }}>
        <div className="header">Notifications</div>

        {/* Division 1 */}
        <div>
          <div className={`smartNoti ${disableAllEmailChk && disableAllMobileChk ? 'disabled' : ''}`}>
            <input
              type="checkbox"
              className="cnv-checkbox"
              id={SETTINGS.notify_only_when_away}
              checked={isBitOn(toInt(notificationArr[SETTINGS.notify_only_when_away], 0), 1)}
              disabled={disableAllEmailChk && disableAllMobileChk}
              onChange={(e) => updateNoBitSetting(SETTINGS.notify_only_when_away, 1, e.target.checked)}
            />
            <label htmlFor={SETTINGS.notify_only_when_away}></label>
            <div style={{ display: 'inline', marginLeft: '5px' }}>Turn on Smart Notifications</div>
            <div style={{ marginLeft: '28px', color: '#7b8386' }}>
              Only send email and mobile notifications when I am away or offline on Convo.
            </div>
          </div>

          <div style={{ marginTop: '10px' }}>
            <input
              type="checkbox"
              className="cnv-checkbox"
              id={SETTINGS.play_sound_on_notification}
              checked={isBitOn(toInt(notificationArr[SETTINGS.play_sound_on_notification], 0), 28)}
              onChange={(e) => updateNoBitSetting(SETTINGS.play_sound_on_notification, 28, e.target.checked)}
            />
            <label htmlFor={SETTINGS.play_sound_on_notification}></label>
            <div style={{ display: 'inline', marginLeft: '5px' }}>Enable sounds</div>
          </div>

          <div style={{ marginTop: '30px' }}>
            Send me desktop notifications for
            <div style={{ marginLeft: '10px' }} className="btn-group">
              <button
                type="button"
                className="btn btn-default dropdown-toggle"
                onClick={() => setActivityDropdownOpen((v) => !v)}
              >
                {selectedActivityType} <span className="caret"></span>
              </button>
              {activityDropdownOpen && (
                <ul className="dropdown-menu" role="menu" style={{ display: 'block' }}>
                  <li>
                    <a href="javascript:void(0)" onClick={(e) => { e.preventDefault(); activityChanged(true); }}>
                      All activity
                    </a>
                  </li>
                  <li>
                    <a href="javascript:void(0)" onClick={(e) => { e.preventDefault(); activityChanged(false); }}>
                      Specific activity (Customize)
                    </a>
                  </li>
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Division 2 */}
        <div>
          <div className="subHeader">CUSTOMIZE YOUR NOTIFICATION SETTINGS</div>
          <hr />

          <div style={{ display: 'inline-block' }}>
            <div style={{ marginBottom: '15px', textAlign: 'center', display: 'block', paddingLeft: '322px' }}>
              <div style={{ display: 'inline-block', marginLeft: '4px' }}>DESKTOP</div>
              <div style={{ display: 'inline-block', marginLeft: '70px' }}>EMAIL</div>
              <div style={{ display: 'inline-block', marginLeft: '76px' }}>MOBILE</div>
              <div style={{ display: 'inline-block', marginLeft: '20px', width: '145px' }}>NOTIFICATION CENTER</div>
            </div>
            <div style={{ color: '#7b8386', display: 'inline-block', paddingLeft: '5px' }}>ENABLE NOTIFICATIONS FOR...</div>
            <div style={{ display: 'inline', marginLeft: '139px' }}>
              <div style={{ display: 'inline' }}>
                <div
                  className={`chkDesktop btn-group btn-toggle ${disableAllDesktopChk ? '' : ''}`}
                  onClick={() => {
                    const enabled = disableAllDesktopChk; // if disabled -> enable
                    toggleMaster(SETTINGS.enable_desktop_notifications, enabled, setDisableAllDesktopChk);
                  }}
                >
                  <button className={`btn btn-xs ${disableAllDesktopChk ? 'btn-default-transparent-font' : 'btn-primary active'}`}>ON</button>
                  <button className={`btn btn-xs ${disableAllDesktopChk ? 'btn-primary active' : 'btn-default-transparent-font'}`}>OFF</button>
                </div>
              </div>

              <div style={{ marginLeft: '60px', display: 'inline' }}>
                <div
                  className={`chkEmail btn-group btn-toggle ${disableEmailMasterByPhoneSignup ? 'disabled' : ''}`}
                  onClick={() => {
                    if (disableEmailMasterByPhoneSignup) return;
                    const enabled = disableAllEmailChk;
                    toggleMaster(SETTINGS.enable_email_notifications, enabled, setDisableAllEmailChk);
                  }}
                >
                  <button className={`btn btn-xs ${disableAllEmailChk ? 'btn-default-transparent-font' : 'btn-primary active'}`}>ON</button>
                  <button className={`btn btn-xs ${disableAllEmailChk ? 'btn-primary active' : 'btn-default-transparent-font'}`}>OFF</button>
                </div>
              </div>

              <div style={{ marginLeft: '60px', display: 'inline' }}>
                <div
                  className="chkMobile btn-group btn-toggle"
                  onClick={() => {
                    const enabled = disableAllMobileChk;
                    toggleMaster(SETTINGS.enable_device_notifications, enabled, setDisableAllMobileChk);
                  }}
                >
                  <button className={`btn btn-xs ${disableAllMobileChk ? 'btn-default-transparent-font' : 'btn-primary active'}`}>ON</button>
                  <button className={`btn btn-xs ${disableAllMobileChk ? 'btn-primary active' : 'btn-default-transparent-font'}`}>OFF</button>
                </div>
              </div>

              <div style={{ marginLeft: '60px', display: 'inline' }}>
                <div
                  className="chkIPN btn-group btn-toggle"
                  onClick={() => {
                    const enabled = disableAllIPNChk;
                    toggleMaster(SETTINGS.enable_in_app_notifications, enabled, setDisableAllIPNChk);
                  }}
                >
                  <button className={`btn btn-xs ${disableAllIPNChk ? 'btn-default-transparent-font' : 'btn-primary active'}`}>ON</button>
                  <button className={`btn btn-xs ${disableAllIPNChk ? 'btn-primary active' : 'btn-default-transparent-font'}`}>OFF</button>
                </div>
              </div>
            </div>
          </div>

          <hr />

          {/* Rows */}
          <div>
            {([
              {
                key: SETTINGS.notify_directs_and_mentions,
                label: '@Mentions',
                channels: ['D', 'E', 'M', 'N'] as const,
                shaded: true,
              },
              {
                key: SETTINGS.notify_comments_on_my_posts,
                label: 'Comments on my posts',
                channels: ['D', 'E', 'M', 'N'] as const,
                shaded: false,
              },
              {
                key: SETTINGS.notify_comments_on_posts_i_comment_on,
                label: 'Comments on posts I have commented on',
                channels: ['D', 'E', 'M', 'N'] as const,
                shaded: true,
              },
              {
                key: SETTINGS.notify_comments_on_directs,
                label: 'Comments on posts shared with me',
                channels: ['D', 'E', 'M', 'N'] as const,
                shaded: false,
              },
              {
                key: SETTINGS.notify_new_group_share,
                label: 'New groups shared with me',
                channels: ['D', 'E', 'N'] as const,
                shaded: true,
              },
              {
                key: SETTINGS.notify_invites_acceptances,
                label: 'Someone accepting my invitation',
                channels: ['E'] as const,
                shaded: false,
              },
              ...(isChatEnabled
                ? [
                    {
                      key: SETTINGS.notify_incoming_chats,
                      label: 'Chat messages',
                      channels: ['D', 'M'] as const,
                      shaded: true,
                    },
                  ]
                : []),
              {
                key: SETTINGS.notify_user_status_updates,
                label: 'Someone coming online',
                channels: ['D'] as const,
                shaded: false,
              },
              {
                key: SETTINGS.notify_group_join_requests,
                label: 'Someone requesting to join group',
                channels: ['D', 'E', 'N'] as const,
                shaded: true,
              },
              {
                key: SETTINGS.send_confirmation_for_email_posts,
                label: 'I share a post via email',
                channels: ['E'] as const,
                shaded: false,
              },
              ...(mobileSmsRowVisible
                ? [
                    {
                      key: SETTINGS.notify_sms_messages,
                      label: 'Receive SMS Messages',
                      channels: ['M'] as const,
                      shaded: true,
                    },
                  ]
                : []),
            ] as const).map((row) => (
              <div
                key={row.key}
                style={{ padding: '5px', backgroundColor: row.shaded ? '#f5f7fc' : undefined }}
                className={isHMThemeEnabled ? 'gray-row' : undefined}
              >
                <div style={{ display: 'inline-block', width: '260px' }}>{row.label}</div>
                <div style={{ display: 'inline', marginLeft: '77px' }}>
                  {/* Desktop */}
                  <div style={{ display: 'inline' }}>
                    {row.channels.includes('D') ? (
                      showDesktopChk ? (
                        <>
                          <input
                            type="checkbox"
                            className="cnv-checkbox"
                            id={`${row.key}D`}
                            disabled={disableAllDesktopChk}
                            checked={isBitOn(toInt(notificationArr[row.key], 0), DESKTOP)}
                            onChange={(e) => updateBitSetting(row.key, DESKTOP, e.target.checked)}
                          />
                          <label htmlFor={`${row.key}D`} className={disableAllDesktopChk ? 'disableOverLay' : undefined}></label>
                        </>
                      ) : (
                        <div className="dash">__</div>
                      )
                    ) : (
                      <div className="dash">__</div>
                    )}
                  </div>

                  {/* Email */}
                  <div className="cbkCustomizeSettings">
                    {row.channels.includes('E') ? (
                      <>
                        <input
                          type="checkbox"
                          className="cnv-checkbox"
                          id={`${row.key}E`}
                          disabled={disableAllEmailChk}
                          checked={isBitOn(toInt(notificationArr[row.key], 0), EMAIL)}
                          onChange={(e) => updateBitSetting(row.key, EMAIL, e.target.checked)}
                        />
                        <label htmlFor={`${row.key}E`}></label>
                      </>
                    ) : (
                      <div className="dash" style={{ marginLeft: '100px' }}>
                        __
                      </div>
                    )}
                  </div>

                  {/* Mobile */}
                  <div className="cbkCustomizeSettings">
                    {row.channels.includes('M') ? (
                      <>
                        <input
                          type="checkbox"
                          className="cnv-checkbox"
                          id={`${row.key}M`}
                          disabled={disableAllMobileChk}
                          checked={isBitOn(toInt(notificationArr[row.key], 0), MOBILE)}
                          onChange={(e) => updateBitSetting(row.key, MOBILE, e.target.checked)}
                        />
                        <label htmlFor={`${row.key}M`}></label>
                      </>
                    ) : (
                      <div className="dash" style={{ marginLeft: '100px' }}>
                        __
                      </div>
                    )}
                  </div>

                  {/* Notification Center */}
                  <div className="cbkCustomizeSettings">
                    {row.channels.includes('N') ? (
                      <>
                        <input
                          type="checkbox"
                          className="cnv-checkbox"
                          id={`${row.key}N`}
                          disabled={disableAllIPNChk}
                          checked={isBitOn(toInt(notificationArr[row.key], 0), NOTIFICATION_CENTER)}
                          onChange={(e) => updateBitSetting(row.key, NOTIFICATION_CENTER, e.target.checked)}
                        />
                        <label htmlFor={`${row.key}N`}></label>
                      </>
                    ) : (
                      <div className="dash" style={{ marginLeft: '100px' }}>
                        __
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Subscribe to groups/people */}
          {!isGuest && (
            <div style={{ marginTop: '15px' }}>
              {!showExpandGrpUsr ? (
                <a
                  href="javascript:void(0)"
                  onClick={(e) => {
                    e.preventDefault();
                    setGrpLimit(5);
                    setUserLimit(5);
                    setGrpMoreLessLabel('More');
                    setUserMoreLessLabel('More');
                    setShowExpandGrpUsr(true);
                  }}
                >
                  Subscribe to groups and people...
                </a>
              ) : (
                <div>
                  <div>
                    <div className="subHeader">NOTIFY ME ABOUT RECENT ACTIVITY IN THESE GROUPS</div>
                    <hr />
                    {groupsListNotifications.slice(0, grpLimit).map((g, idx) => {
                      const gid = String((g as any).group_id || '');
                      return (
                        <div key={gid || idx} style={{ padding: '5px' }} className={idx % 2 === 1 ? 'rowDarkBckColor' : undefined}>
                          <div style={{ display: 'inline-block', width: '260px' }}>{(g as any).name}</div>
                          <div style={{ display: 'inline', marginLeft: '77px' }}>
                            {showDesktopChk ? (
                              <>
                                <input
                                  type="checkbox"
                                  className="cnv-checkbox"
                                  id={`${gid}D`}
                                  disabled={disableAllDesktopChk}
                                  checked={Boolean((g as any).desktop)}
                                  onChange={(e) => updateGroupOrUser(gid, 'desktop', e.target.checked ? 1 : 0, true)}
                                />
                                <label htmlFor={`${gid}D`}></label>
                              </>
                            ) : (
                              <div className="dash">__</div>
                            )}
                            <div className="cbkCustomizeSettings">
                              <input
                                type="checkbox"
                                className="cnv-checkbox"
                                id={`${gid}E`}
                                disabled={disableAllEmailChk}
                                checked={Boolean((g as any).email)}
                                onChange={(e) => updateGroupOrUser(gid, 'email', e.target.checked ? 1 : 0, true)}
                              />
                              <label htmlFor={`${gid}E`}></label>
                            </div>
                            <div className="cbkCustomizeSettings">
                              <input
                                type="checkbox"
                                className="cnv-checkbox"
                                id={`${gid}M`}
                                disabled={disableAllMobileChk}
                                checked={Boolean((g as any).mobile)}
                                onChange={(e) => updateGroupOrUser(gid, 'mobile', e.target.checked ? 1 : 0, true)}
                              />
                              <label htmlFor={`${gid}M`}></label>
                            </div>
                            <div className="cbkCustomizeSettings">
                              <input
                                type="checkbox"
                                className="cnv-checkbox"
                                id={`${gid}N`}
                                disabled={disableAllIPNChk}
                                checked={Boolean((g as any).in_app)}
                                onChange={(e) => updateGroupOrUser(gid, 'in_app', e.target.checked ? 1 : 0, true)}
                              />
                              <label htmlFor={`${gid}N`}></label>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ marginTop: '10px' }}></div>
                    {groupsListNotifications.length > 5 && (
                      <a href="javascript:void(0)" onClick={(e) => { e.preventDefault(); expandList('GROUP'); }}>
                        {grpMoreLessLabel}
                      </a>
                    )}
                  </div>

                  <div>
                    <div className="subHeader">NOTIFY ME ABOUT THESE TEAMMATES' ACTIVITY</div>
                    <hr />
                    {usersListNotifications.slice(0, userLimit).map((u, idx) => {
                      const uid = String((u as any).user_id || '');
                      return (
                        <div key={uid || idx} style={{ padding: '5px' }} className={idx % 2 === 1 ? 'rowDarkBckColor' : undefined}>
                          <div style={{ display: 'inline-block', width: '260px' }}>{(u as any).name}</div>
                          <div style={{ display: 'inline', marginLeft: '77px' }}>
                            {showDesktopChk ? (
                              <>
                                <input
                                  type="checkbox"
                                  className="cnv-checkbox"
                                  id={`${uid}D`}
                                  disabled={disableAllDesktopChk}
                                  checked={Boolean((u as any).desktop)}
                                  onChange={(e) => updateGroupOrUser(uid, 'desktop', e.target.checked ? 1 : 0, false)}
                                />
                                <label htmlFor={`${uid}D`}></label>
                              </>
                            ) : (
                              <div className="dash">__</div>
                            )}
                            <div className="cbkCustomizeSettings">
                              <input
                                type="checkbox"
                                className="cnv-checkbox"
                                id={`${uid}E`}
                                disabled={disableAllEmailChk}
                                checked={Boolean((u as any).email)}
                                onChange={(e) => updateGroupOrUser(uid, 'email', e.target.checked ? 1 : 0, false)}
                              />
                              <label htmlFor={`${uid}E`}></label>
                            </div>
                            <div className="cbkCustomizeSettings">
                              <input
                                type="checkbox"
                                className="cnv-checkbox"
                                id={`${uid}M`}
                                disabled={disableAllMobileChk}
                                checked={Boolean((u as any).mobile)}
                                onChange={(e) => updateGroupOrUser(uid, 'mobile', e.target.checked ? 1 : 0, false)}
                              />
                              <label htmlFor={`${uid}M`}></label>
                            </div>
                            <div className="cbkCustomizeSettings">
                              <input
                                type="checkbox"
                                className="cnv-checkbox"
                                id={`${uid}N`}
                                disabled={disableAllIPNChk}
                                checked={Boolean((u as any).in_app)}
                                onChange={(e) => updateGroupOrUser(uid, 'in_app', e.target.checked ? 1 : 0, false)}
                              />
                              <label htmlFor={`${uid}N`}></label>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ marginTop: '10px' }}></div>
                    {usersListNotifications.length > 5 && (
                      <a href="javascript:void(0)" onClick={(e) => { e.preventDefault(); expandList('USER'); }}>
                        {userMoreLessLabel}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Manage Subscriptions & Notifications */}
          {isSubscribedEnabled && (
            <div style={{ marginTop: '10px' }}>
              {!showManageSubscription ? (
                <a
                  href="javascript:void(0)"
                  onClick={(e) => {
                    e.preventDefault();
                    setSubLimit(5);
                    setSubMoreLessLabel('More');
                    setShowManageSubscription(true);
                    setIsSubscriptionLoaded(false);
                  }}
                >
                  Manage Subscriptions...
                </a>
              ) : (
                <div>
                  <div className="subHeader">MANAGE SUBSCRIPTIONS & NOTIFICATIONS</div>
                  <hr />
                  {!isSubscriptionLoaded && (
                    <div style={{ textAlign: 'center' }}>
                      <img src="/assets/img/feed/loading-spin.svg" alt="Loading icon" />
                    </div>
                  )}
                  {isSubscriptionLoaded && !subscriptionNotificationList.length && <div style={{ color: '#7b8386' }}>No subscriptions to show</div>}
                  {subscriptionNotificationList.slice(0, subLimit).map((sub, idx) => (
                    <div
                      key={idx}
                      style={{ padding: '7px' }}
                      className={`${idx % 2 === 1 ? 'rowDarkBckColor ' : ''}subscription-row`}
                      onMouseEnter={() => {}}
                      onMouseLeave={() => {}}
                    >
                      <div style={{ display: 'inline-block', width: '260px', verticalAlign: 'middle' }}>
                        <a href={tagToUrl(accountId, sub.value)}>
                          {sub.value.map((t) => (
                            <span key={t}>{`#${t} `}</span>
                          ))}
                        </a>
                      </div>

                      <div className="checkbox-notification-div" style={{ display: 'inline', marginLeft: '77px' }}>
                        {showDesktopChk ? (
                          <>
                            <input
                              type="checkbox"
                              className="cnv-checkbox"
                              id={`desktop_${idx}`}
                              disabled={disableAllDesktopChk}
                              checked={Boolean(sub.settings.desktop)}
                              onChange={(e) => {
                                const next = { ...sub, settings: { ...sub.settings, desktop: e.target.checked } };
                                setSubscriptionNotificationList((prev) => prev.map((p, i) => (i === idx ? next : p)));
                                updateManageSubscriptionNotification(next, idx);
                              }}
                            />
                            <label htmlFor={`desktop_${idx}`}></label>
                          </>
                        ) : (
                          <div className="dash">__</div>
                        )}

                        <div className="cbkCustomizeSettings">
                          <input
                            type="checkbox"
                            className="cnv-checkbox"
                            id={`email_${idx}`}
                            disabled={disableAllEmailChk}
                            checked={Boolean(sub.settings.email)}
                            onChange={(e) => {
                              const next = { ...sub, settings: { ...sub.settings, email: e.target.checked } };
                              setSubscriptionNotificationList((prev) => prev.map((p, i) => (i === idx ? next : p)));
                              updateManageSubscriptionNotification(next, idx);
                            }}
                          />
                          <label htmlFor={`email_${idx}`}></label>
                        </div>
                        <div className="cbkCustomizeSettings">
                          <input
                            type="checkbox"
                            className="cnv-checkbox"
                            id={`mobile_${idx}`}
                            disabled={disableAllMobileChk}
                            checked={Boolean(sub.settings.mobile)}
                            onChange={(e) => {
                              const next = { ...sub, settings: { ...sub.settings, mobile: e.target.checked } };
                              setSubscriptionNotificationList((prev) => prev.map((p, i) => (i === idx ? next : p)));
                              updateManageSubscriptionNotification(next, idx);
                            }}
                          />
                          <label htmlFor={`mobile_${idx}`}></label>
                        </div>
                        <div className="cbkCustomizeSettings">
                          <input
                            type="checkbox"
                            className="cnv-checkbox"
                            id={`inApp_${idx}`}
                            disabled={disableAllIPNChk}
                            checked={Boolean(sub.settings.in_app)}
                            onChange={(e) => {
                              const next = { ...sub, settings: { ...sub.settings, in_app: e.target.checked } };
                              setSubscriptionNotificationList((prev) => prev.map((p, i) => (i === idx ? next : p)));
                              updateManageSubscriptionNotification(next, idx);
                            }}
                          />
                          <label htmlFor={`inApp_${idx}`}></label>
                        </div>
                      </div>

                      <div className="cbkCustomizeSettings" style={{ display: 'inline', marginLeft: '10px' }}>
                        <button className="unsubscribe-button" onClick={() => unsubscribeNotification(sub, idx)} type="button">
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop: '10px' }} className="more-less-link">
                    {subscriptionNotificationList.length > 5 && (
                      <a href="javascript:void(0)" onClick={(e) => { e.preventDefault(); toggleManageSubscriptionLimit(); }}>
                        {subMoreLessLabel}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Division 3 */}
        <div className="subHeader">DIGEST</div>
        <hr />
        Email me a digest of the top content of my network.
        <div className={`radioBtnBar ${disableDigestByPhoneSignup || disableAllEmailChk ? 'disabled' : ''}`} style={{ marginTop: '10px', marginBottom: '10px' }}>
          <input
            id={`${SETTINGS.digest_send_frequency}N`}
            type="radio"
            className="cnv-radioButton"
            checked={digest === 'NEVER'}
            disabled={disableDigestByPhoneSignup || disableAllEmailChk}
            onChange={() => setDigest('NEVER')}
          />
          <label htmlFor={`${SETTINGS.digest_send_frequency}N`} style={{ marginLeft: '18px' }}>
            No digest
          </label>

          <input
            id={`${SETTINGS.digest_send_frequency}D`}
            type="radio"
            className="cnv-radioButton"
            checked={digest === 'DAILY'}
            disabled={disableDigestByPhoneSignup || disableAllEmailChk}
            onChange={() => setDigest('DAILY')}
          />
          <label htmlFor={`${SETTINGS.digest_send_frequency}D`}>Daily</label>

          <input
            id={`${SETTINGS.digest_send_frequency}W`}
            type="radio"
            className="cnv-radioButton"
            checked={digest === 'WEEKLY'}
            disabled={disableDigestByPhoneSignup || disableAllEmailChk}
            onChange={() => setDigest('WEEKLY')}
          />
          <label htmlFor={`${SETTINGS.digest_send_frequency}W`}>Weekly</label>
        </div>
        <hr />
        <div style={{ marginTop: '60px' }}></div>
      </div>
    </div>
  );
}


