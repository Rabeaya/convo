'use client';

/**
 * Customize Feed Settings Page
 * 
 * Route: /settings/customize-feed
 * Migrated from AngularJS customizeFeedSettings view
 * 
 * This page uses the settings layout which provides the left panel
 * and renders the CustomizeFeedView in the view-content area
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SettingsLeftPanel from '@/components/settings/SettingsLeftPanel';
import CustomizeFeedView from '@/components/settings/CustomizeFeedView';

const CUSTOMIZE_FEED_VIEW = 'customizeFeedSettings';

export default function CustomizeFeedPage() {
  const router = useRouter();
  
  // This page is part of the settings structure
  // The layout will provide the header, but we need to render the settings structure
  return (
    <div className="settings-container">
      <div className="left-panel-container">
        <SettingsLeftPanel 
          selectedView={CUSTOMIZE_FEED_VIEW} 
          onViewChange={(view) => {
            // Handle navigation to other settings views
            if (view === 'myAccountSettings') {
              router.push('/settings/account');
            } else if (view === 'notificationsSettings') {
              router.push('/settings/notifications');
            } else if (view === CUSTOMIZE_FEED_VIEW) {
              router.push('/settings/customize-feed');
            }
            // Add other routes as needed
          }}
        />
      </div>

      <div className="view-content">
        <CustomizeFeedView />
      </div>
    </div>
  );
}


