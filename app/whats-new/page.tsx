'use client';

/**
 * What's New Page
 * 
 * Migrated from AngularJS cnvWhatsNewDialog
 * Displays what's new content and notification settings
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { whatsNewService, type WhatsNewData } from '@/lib/api/whats-new';

export default function WhatsNewPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [notifyAboutUpdates, setNotifyAboutUpdates] = useState(false);
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [whatsNewData, setWhatsNewData] = useState<WhatsNewData | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Load What's New data and content
    const loadData = async () => {
      try {
        // Load HTML content
        const loadContent = async () => {
          try {
            const response = await fetch('/whats-new/web.html', {
              method: 'GET',
              headers: {
                'Accept': 'text/html',
              },
            });
            
            if (response.ok) {
              const html = await response.text();
              if (isMounted) {
                setHtmlContent(html);
              }
            } else {
              // Fallback content if file doesn't exist
              if (isMounted) {
                setHtmlContent(`
                  <div style="padding: 20px;">
                    <h3>What's New</h3>
                    <p>Welcome to the new Convo experience!</p>
                    <p>We've updated the interface with modern design and improved performance.</p>
                    <p>Check back here for the latest updates and features.</p>
                  </div>
                `);
              }
            }
          } catch (error) {
            console.error('Error loading what\'s new content:', error);
            if (isMounted) {
              setHtmlContent(`
                <div style="padding: 20px;">
                  <h3>What's New</h3>
                  <p>Welcome to the new Convo experience!</p>
                  <p>We've updated the interface with modern design and improved performance.</p>
                </div>
              `);
            }
          }
        };

        await loadContent();

        // Mark announcements as read when opening the dialog
        // The timestamp should come from the updates endpoint data
        // For now, we'll try to mark as read if we have data
        if (whatsNewData?.announcementsLastPublishTimestamp) {
          try {
            await whatsNewService.markAnnouncementsAsRead(whatsNewData.announcementsLastPublishTimestamp);
          } catch (error) {
            console.error('Error marking announcements as read:', error);
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [whatsNewData?.announcementsLastPublishTimestamp]);

  const handleToggleNotify = async (checked: boolean) => {
    setNotifyAboutUpdates(checked);
    try {
      await whatsNewService.setNotifyMeAboutUpdates(checked);
    } catch (error) {
      console.error('Error updating notification preference:', error);
      // Revert on error
      setNotifyAboutUpdates(!checked);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      zIndex: 1050,
      paddingTop: '72px',
    }} onClick={(e) => {
      // Close on backdrop click
      if (e.target === e.currentTarget) {
        router.back();
      }
    }}>
      <div style={{
        width: '480px',
        height: '500px',
        backgroundColor: '#fff',
        borderRadius: '4px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          height: '56px',
          padding: '15px',
          borderBottom: '1px solid #e6e6e6',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h4 style={{
            margin: 0,
            lineHeight: '30px',
            fontSize: '18px',
            fontWeight: 'normal',
          }}>
            What's new?
          </h4>
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '28px',
              lineHeight: '20px',
              color: '#000',
              cursor: 'pointer',
              padding: 0,
              width: '20px',
              height: '20px',
              marginTop: '4px',
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{
          height: '500px',
          padding: 0,
          paddingRight: '1px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Sub-header with checkbox */}
          <div style={{
            background: '#e0e0e0',
            padding: '10px',
            fontWeight: 400,
            borderBottom: '1px solid #e6e6e6',
            display: 'flex',
            alignItems: 'center',
          }}>
            <div style={{ display: 'inline-block' }}>
            <input
              type="checkbox"
              id="notifyUpdates"
              checked={notifyAboutUpdates || whatsNewData?.notifyAboutNewFeatures || false}
              onChange={(e) => handleToggleNotify(e.target.checked)}
              style={{
                marginRight: '5px',
                cursor: 'pointer',
              }}
            />
              <label
                htmlFor="notifyUpdates"
                style={{
                  marginLeft: '3px',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                Notify me about updates
              </label>
            </div>
          </div>

          {/* Content frame */}
          <div
            style={{
              width: '100%',
              height: 'calc(100% - 40px)',
              paddingBottom: '40px',
              border: 'none',
              boxSizing: 'border-box',
              overflowY: 'auto',
              padding: '15px',
            }}
          >
            {isLoading ? (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
              }}>
                <div className="cnv-spinner spinner-bar"></div>
                <span style={{ marginLeft: '10px' }}>Loading...</span>
              </div>
            ) : (
              <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

