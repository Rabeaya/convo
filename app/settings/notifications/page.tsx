'use client';

/**
 * Notifications Settings Page
 *
 * Route: /settings/notifications
 * Migrated from AngularJS notificationsSettings view.
 */

import { useRouter } from 'next/navigation';
import SettingsLeftPanel from '@/components/settings/SettingsLeftPanel';
import NotificationsSettingsView from '@/components/settings/NotificationsSettingsView';

const NOTIFICATION_VIEW = 'notificationsSettings';

export default function NotificationsSettingsPage() {
  const router = useRouter();

  return (
    <div className="settings-container">
      <div className="left-panel-container">
        <SettingsLeftPanel
          selectedView={NOTIFICATION_VIEW}
          onViewChange={(view) => {
            if (view === 'myAccountSettings') router.push('/settings/account');
            else if (view === 'customizeFeedSettings') router.push('/settings/customize-feed');
            else if (view === NOTIFICATION_VIEW) router.push('/settings/notifications');
            else router.push('/settings');
          }}
        />
      </div>
      <div className="view-content">
        <NotificationsSettingsView />
      </div>
    </div>
  );
}


