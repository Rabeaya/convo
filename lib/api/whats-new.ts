/**
 * What's New API Service
 * 
 * Migrated from AngularJS whatsNewService
 */

export interface WhatsNewData {
  isClientVersionLatest: boolean;
  showWhatsNewTooltip: boolean;
  showUnreadAnnouncementsIndicator: boolean;
  notifyAboutNewFeatures: boolean;
  announcementsLastPublishTimestamp: number;
}

export interface AnnouncementsRequest {
  method: string;
  data: {
    value?: boolean;
    till?: number;
  };
}

class WhatsNewService {
  /**
   * Update notification preference for new features
   */
  async setNotifyMeAboutUpdates(value: boolean): Promise<void> {
    const reqData: AnnouncementsRequest = {
      method: 'changeNotifyAboutNewFeaturesSetting',
      data: {
        value,
      },
    };

    const response = await fetch('/api/v1/announcements', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(reqData),
    });

    if (!response.ok) {
      throw new Error('Failed to update notification preference');
    }
  }

  /**
   * Mark announcements as read
   */
  async markAnnouncementsAsRead(timestamp: number): Promise<void> {
    const reqData: AnnouncementsRequest = {
      method: 'markAnnouncementsAsRead',
      data: {
        till: timestamp,
      },
    };

    const response = await fetch('/api/v1/announcements', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(reqData),
    });

    if (!response.ok) {
      throw new Error('Failed to mark announcements as read');
    }
  }

  /**
   * Mark what's new tooltip as shown
   */
  async markWhatsnewTooltipShown(timestamp: number): Promise<void> {
    const reqData: AnnouncementsRequest = {
      method: 'markWhatsnewTooltipShown',
      data: {
        till: timestamp,
      },
    };

    const response = await fetch('/api/v1/announcements', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(reqData),
    });

    if (!response.ok) {
      throw new Error('Failed to mark tooltip as shown');
    }
  }
}

export const whatsNewService = new WhatsNewService();

