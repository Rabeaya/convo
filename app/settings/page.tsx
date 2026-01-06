'use client';

/**
 * Settings Page
 * 
 * Migrated from AngularJS cnvSettings directive
 * Exact 1:1 structural match
 * 
 * Structure matches:
 * <div class="settings-container">
 *   <div class="left-panel-container">
 *     <SettingsLeftPanel />
 *   </div>
 *   <div class="view-content">
 *     {selectedView content}
 *   </div>
 * </div>
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import SettingsLeftPanel from '@/components/settings/SettingsLeftPanel';
import AccountSettingsView from '@/components/settings/AccountSettingsView';
import CustomizeFeedView from '@/components/settings/CustomizeFeedView';

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

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const [selectedView, setSelectedView] = useState<string>(ACCOUNT_SETTINGS_VIEW);

  useEffect(() => {
    // Determine view from URL path
    const path = window.location.pathname;
    if (path.includes('/settings/account')) {
      setSelectedView(ACCOUNT_SETTINGS_VIEW);
    } else if (path.includes('/settings/notifications')) {
      setSelectedView(NOTIFICATION_VIEW);
    } else if (path.includes('/settings/customize-feed')) {
      setSelectedView(CUSTOMIZE_FEED_VIEW);
    } else if (path.includes('/settings/network-information')) {
      setSelectedView(NETWORK_INFO_VIEW);
    } else if (path.includes('/settings/sso')) {
      setSelectedView(SSO_SETTINGS_VIEW);
    } else if (path.includes('/settings/manage-users')) {
      setSelectedView(MANAGE_USERS_VIEW);
    } else if (path.includes('/settings/monitor-content')) {
      setSelectedView(MONITOR_CONTENT_VIEW);
    } else if (path.includes('/settings/security')) {
      setSelectedView(SECURITY_VIEW);
    } else if (path.includes('/settings/billing')) {
      setSelectedView(BILLING_VIEW);
    } else if (path.includes('/settings/manage-groups')) {
      setSelectedView(MANAGE_GROUPS_VIEW);
    } else if (path.includes('/settings/manage-groups-settings')) {
      setSelectedView(MANAGE_GROUPS_SETTINGS);
    } else if (path.includes('/settings/sms-notifications')) {
      setSelectedView(SMS_NOTIFICATIONS_VIEW);
    } else if (path.includes('/settings/analytics/users')) {
      setSelectedView(USERS_ANALYTICS_VIEW);
    } else if (path.includes('/settings/analytics/content')) {
      setSelectedView(CONTENT_ANALYTICS_VIEW);
    } else {
      // Default view
      setSelectedView(ACCOUNT_SETTINGS_VIEW);
    }
  }, [searchParams]);

  const toggleSelectedView = (view: string) => {
    setSelectedView(view);
  };

  return (
    <div className="settings-container">
      <div className="left-panel-container">
        <SettingsLeftPanel 
          selectedView={selectedView} 
          onViewChange={toggleSelectedView}
        />
      </div>

      <div className="view-content">
        {/* Advanced Search Panel - placeholder for now */}
        {/* <cnv-advanced-search type="feed"></cnv-advanced-search> */}

        {selectedView === ACCOUNT_SETTINGS_VIEW && (
          <AccountSettingsView />
        )}

        {selectedView === NOTIFICATION_VIEW && (
          <div>Notifications Settings - To be migrated</div>
        )}

        {selectedView === CUSTOMIZE_FEED_VIEW && (
          <CustomizeFeedView />
        )}

        {selectedView === NETWORK_INFO_VIEW && (
          <div>Network Information - To be migrated</div>
        )}

        {selectedView === SSO_SETTINGS_VIEW && (
          <div>SSO Settings - To be migrated</div>
        )}

        {selectedView === MANAGE_USERS_VIEW && (
          <div>Manage Users - To be migrated</div>
        )}

        {selectedView === MONITOR_CONTENT_VIEW && (
          <div>Monitor Content - To be migrated</div>
        )}

        {selectedView === SECURITY_VIEW && (
          <div>Security Settings - To be migrated</div>
        )}

        {selectedView === BILLING_VIEW && (
          <div>Billing - To be migrated</div>
        )}

        {selectedView === MANAGE_GROUPS_VIEW && (
          <div>Manage Groups - To be migrated</div>
        )}

        {selectedView === MANAGE_GROUPS_SETTINGS && (
          <div>Manage Groups Settings - To be migrated</div>
        )}

        {selectedView === SMS_NOTIFICATIONS_VIEW && (
          <div>SMS Notifications - To be migrated</div>
        )}

        {selectedView === USERS_ANALYTICS_VIEW && (
          <div>Users Analytics - To be migrated</div>
        )}

        {selectedView === CONTENT_ANALYTICS_VIEW && (
          <div>Content Analytics - To be migrated</div>
        )}
      </div>
    </div>
  );
}
