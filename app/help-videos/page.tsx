'use client';

/**
 * Help Videos Page
 * 
 * Migrated from AngularJS cnvHelpVideos
 * Displays help videos in an iframe
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HelpVideosPage() {
  const router = useRouter();
  const [isFrameLoaded, setIsFrameLoaded] = useState(false);

  useEffect(() => {
    // Hide spinner after 1.5 seconds (as per AngularJS implementation)
    const timer = setTimeout(() => {
      setIsFrameLoaded(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  const handleIframeLoad = () => {
    setIsFrameLoaded(true);
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
            Help Videos
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
          position: 'relative',
        }}>
          {/* Loading spinner */}
          {!isFrameLoaded && (
            <div style={{
              position: 'absolute',
              left: '50%',
              marginLeft: '-16px',
              top: '50%',
              marginTop: '-16px',
              zIndex: 1,
            }}>
              <div className="cnv-spinner spinner-bar"></div>
            </div>
          )}

          {/* Iframe */}
          <iframe
            src="/convo-help/index.php"
            onLoad={handleIframeLoad}
            style={{
              width: '100%',
              height: '100%',
              overflowY: 'auto',
              border: 'none',
              opacity: isFrameLoaded ? 1 : 0,
              transition: 'opacity 0.3s',
            }}
            title="Help Videos"
          />
        </div>
      </div>
    </div>
  );
}

