'use client';

/**
 * Settings Left Panel Component
 * 
 * Migrated from AngularJS cnvSettingLeftPanel directive
 * Exact 1:1 structural match
 */

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';

const ACCOUNT_SETTINGS_VIEW = 'myAccountSettings';
const NOTIFICATION_VIEW = 'notificationsSettings';
const CUSTOMIZE_FEED_VIEW = 'customizeFeedSettings';
const NETWORK_INFO_VIEW = 'networkInformation';
const SSO_SETTINGS_VIEW = 'ssoSettings';
const MANAGE_USERS_VIEW = 'manageUsers';
const MANAGE_GROUPS_VIEW = 'manageGroups';
const BILLING_VIEW = 'billing';
const MONITOR_CONTENT_VIEW = 'monitorContent';
const SECURITY_VIEW = 'security';
const MANAGE_GROUPS_SETTINGS = 'manageGroupsSettings';
const SMS_NOTIFICATIONS_VIEW = 'smsNotifications';
const USERS_ANALYTICS_VIEW = 'usersAnalytics';
const CONTENT_ANALYTICS_VIEW = 'contentAnalytics';

export default function SettingsLeftPanel({ 
  selectedView, 
  onViewChange 
}: { 
  selectedView: string;
  onViewChange: (view: string) => void;
}) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const account = useAuthStore((state) => state.account);
  
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);

  const isAdmin = (user as any)?.isAdmin || (user as any)?.is_admin || false;
  const isGuest = (user as any)?.is_guest_user || false;
  const accountLevel = (account as any)?.account_level || 'STARTER';

  const toggleView = (view: string) => {
    onViewChange(view);
    // Navigate to the view
    if (view === ACCOUNT_SETTINGS_VIEW) {
      router.push('/settings/account');
    } else if (view === NOTIFICATION_VIEW) {
      router.push('/settings/notifications');
    } else if (view === CUSTOMIZE_FEED_VIEW) {
      router.push('/settings/customize-feed');
    } else if (view === NETWORK_INFO_VIEW) {
      router.push('/settings/network-information');
    } else if (view === SSO_SETTINGS_VIEW) {
      router.push('/settings/sso');
    } else if (view === MANAGE_USERS_VIEW) {
      router.push('/settings/manage-users');
    } else if (view === MONITOR_CONTENT_VIEW) {
      router.push('/settings/monitor-content');
    } else if (view === SECURITY_VIEW) {
      router.push('/settings/security');
    } else if (view === BILLING_VIEW) {
      router.push('/settings/billing');
    } else if (view === MANAGE_GROUPS_VIEW) {
      router.push('/settings/manage-groups');
    } else if (view === MANAGE_GROUPS_SETTINGS) {
      router.push('/settings/manage-groups-settings');
    } else if (view === SMS_NOTIFICATIONS_VIEW) {
      router.push('/settings/sms-notifications');
    } else if (view === USERS_ANALYTICS_VIEW) {
      router.push('/settings/analytics/users');
    } else if (view === CONTENT_ANALYTICS_VIEW) {
      router.push('/settings/analytics/content');
    }
  };

  const openAnalytics = () => {
    setIsAnalyticsOpen(!isAnalyticsOpen);
  };

  const navigateToUpgradeView = () => {
    router.push('/settings/account?upgrade=true');
  };

  const showAdminSection = (!isGuest && (isAdmin || accountLevel === 'STARTER')) || 
                           (accountLevel !== 'STARTER' && isAdmin);

  return (
    <div className="wrapper-parent">
      <div className="left-panel-wrapper">
        {/* Menu Items */}
        <div className="row no-margin menu-items-container">
          <ul>
            <li>
              <i className="cnv-icons-16 icons2_Settings-dark"></i>
              <a 
                href="javascript:void(0)" 
                className={selectedView === ACCOUNT_SETTINGS_VIEW ? 'active' : ''}
                onClick={() => toggleView(ACCOUNT_SETTINGS_VIEW)}
              >
                My account
              </a>
            </li>
            <li>
              <i className="cnv-icons-16 Icon1_customize-01-dark"></i>
              <a 
                href="javascript:void(0)" 
                className={selectedView === CUSTOMIZE_FEED_VIEW ? 'active' : ''}
                onClick={() => toggleView(CUSTOMIZE_FEED_VIEW)}
              >
                Feed and sharing
              </a>
            </li>
            <li>
              <i className="cnv-icons-16 icons_Notifications-dark"></i>
              <a 
                href="javascript:void(0)" 
                onClick={() => toggleView(NOTIFICATION_VIEW)}
                className={selectedView === NOTIFICATION_VIEW ? 'active' : ''}
              >
                Notifications
              </a>
            </li>
          </ul>
        </div>

        {/* Administration Section */}
        {showAdminSection && (
          <div className="row no-margin groupsItemsContainer">
            <div className="heading">
              <span>ADMINISTRATION</span>
            </div>
          </div>
        )}

        {/* Admin Menu Items */}
        <div className="row no-margin menu-items-container">
          <ul>
            {!isGuest && (isAdmin || accountLevel === 'STARTER') && (
              <li>
                <i className="cnv-icons-16 Icon1_networkinformation-01-dark"></i>
                <a 
                  href="javascript:void(0)" 
                  onClick={() => toggleView(NETWORK_INFO_VIEW)}
                  className={selectedView === NETWORK_INFO_VIEW ? 'active' : ''}
                >
                  Network information
                </a>
              </li>
            )}
            
            {!isGuest && isAdmin && accountLevel !== 'STARTER' && (
              <li>
                <i className="cnv-icons-16 icon2__Following-dark"></i>
                <a 
                  href="javascript:void(0)" 
                  id="manageUsers" 
                  onClick={() => toggleView(MANAGE_USERS_VIEW)}
                  className={selectedView === MANAGE_USERS_VIEW ? 'active' : ''}
                >
                  Manage users
                </a>
              </li>
            )}

            {!isGuest && isAdmin && accountLevel !== 'STARTER' && (
              <li>
                <i className="cnv-icons-16 icon2__Group-Following-dark"></i>
                <a 
                  href="javascript:void(0)" 
                  onClick={() => toggleView(MANAGE_GROUPS_SETTINGS)}
                  className={selectedView === MANAGE_GROUPS_SETTINGS ? 'active' : ''}
                >
                  Manage Groups
                </a>
              </li>
            )}

            {!isGuest && isAdmin && accountLevel !== 'STARTER' && (
              <li>
                <i className="billing-ico"></i>
                <a 
                  href="javascript:void(0)" 
                  onClick={() => toggleView(BILLING_VIEW)}
                  className={selectedView === BILLING_VIEW ? 'active' : ''}
                >
                  Billing
                </a>
              </li>
            )}

            {!isGuest && isAdmin && accountLevel !== 'STARTER' && (
              <li>
                <i className="manage-content-ico"></i>
                <a 
                  href="javascript:void(0)" 
                  onClick={() => toggleView(MONITOR_CONTENT_VIEW)}
                  className={selectedView === MONITOR_CONTENT_VIEW ? 'active' : ''}
                >
                  Manage content
                </a>
              </li>
            )}

            {!isGuest && isAdmin && accountLevel !== 'STARTER' && (
              <li>
                <i className="cnv-icons-16 icons_Lock-dark"></i>
                <a 
                  href="javascript:void(0)" 
                  onClick={() => toggleView(SECURITY_VIEW)}
                  className={selectedView === SECURITY_VIEW ? 'active' : ''}
                >
                  Security
                </a>
              </li>
            )}

            {accountLevel !== 'STARTER' && isAdmin && (
              <li>
                <i className="cnv-icons-16 sso"></i>
                <a 
                  href="javascript:void(0)" 
                  onClick={() => toggleView(SSO_SETTINGS_VIEW)}
                  className={selectedView === SSO_SETTINGS_VIEW ? 'active' : ''}
                >
                  Single sign on
                </a>
              </li>
            )}

            {accountLevel !== 'STARTER' && isAdmin && (
              <li>
                <i className="cnv-icons-16 icons_Phone-dark"></i>
                <a 
                  href="javascript:void(0)" 
                  onClick={() => toggleView(SMS_NOTIFICATIONS_VIEW)}
                  className={selectedView === SMS_NOTIFICATIONS_VIEW ? 'active' : ''}
                >
                  SMS Notifications
                </a>
              </li>
            )}

            {accountLevel !== 'STARTER' && isAdmin && (
              <li>
                <div className="pull-left">
                  <i className="cnv-icons-16 analytics"></i>
                  <a 
                    href="javascript:void(0)" 
                    onClick={openAnalytics}
                    className={selectedView === USERS_ANALYTICS_VIEW || selectedView === CONTENT_ANALYTICS_VIEW ? 'active' : ''}
                  >
                    Analytics
                  </a>
                  {isAnalyticsOpen && (
                    <ul>
                      {accountLevel !== 'STARTER' && isAdmin && (
                        <li>
                          <i className="users-analytics-ico"></i>
                          <a 
                            href="javascript:void(0)" 
                            onClick={() => toggleView(USERS_ANALYTICS_VIEW)}
                            className={selectedView === USERS_ANALYTICS_VIEW ? 'active' : ''}
                          >
                            Users
                          </a>
                        </li>
                      )}

                      {accountLevel !== 'STARTER' && isAdmin && (
                        <li>
                          <i className="content-analytics-ico"></i>
                          <a 
                            href="javascript:void(0)" 
                            onClick={() => toggleView(CONTENT_ANALYTICS_VIEW)}
                            className={selectedView === CONTENT_ANALYTICS_VIEW ? 'active' : ''}
                          >
                            Content
                          </a>
                        </li>
                      )}
                    </ul>
                  )}
                </div>
                <div className="pull-right">
                  <div className="wrapper">
                    <i className="cnv-icons-12 icons2_Dropdown-darkgray" onClick={openAnalytics}></i>
                  </div>
                </div>
              </li>
            )}
          </ul>
        </div>

        {/* Upgrade Banner */}
        {!isGuest && accountLevel === 'STARTER' && (
          <div className="upgrade-banner">
            <span>Get more admin controls</span>
            <button className="btn btn-block btn-primary" onClick={navigateToUpgradeView}>
              Upgrade now
            </button>
          </div>
        )}

        <div className="background-div"></div>
      </div>
    </div>
  );
}
