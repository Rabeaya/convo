'use client';

/**
 * Alert Modal Component
 * 
 * Simple alert dialog with OK button
 * Migrated from AngularJS alertsService.alertModal
 * Exact 1:1 match with AngularJS alertModal.tpl.html
 */

import { useEffect, useRef } from 'react';

interface AlertModalProps {
  title: string;
  text: string;
  okBtnLabel?: string;
  dontShowCloseBtn?: boolean;
  onOk: () => void;
  onClose: () => void;
}

export default function AlertModal({
  title,
  text,
  okBtnLabel = 'Ok',
  dontShowCloseBtn = false,
  onOk,
  onClose,
}: AlertModalProps) {
  const okButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Auto-focus OK button (matches AngularJS autofocus)
    if (okButtonRef.current) {
      okButtonRef.current.focus();
    }

    // Handle ESC key
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOk();
      }
    };

    // Handle Enter key
    const handleEnter = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && document.activeElement === okButtonRef.current) {
        onOk();
      }
    };

    document.addEventListener('keydown', handleEsc);
    document.addEventListener('keydown', handleEnter);

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.removeEventListener('keydown', handleEnter);
    };
  }, [onOk]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 1050,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onOk();
        }
      }}
    >
      <div
        className="modal alert-modal"
        style={{
          backgroundColor: '#fff',
          borderRadius: '4px',
          minWidth: '400px',
          maxWidth: '600px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          zIndex: 1051,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header - matches AngularJS alertModal.tpl.html */}
        <div className="modal-header" style={{
          padding: '15px 20px',
          borderBottom: '1px solid #e5e5e5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h4 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span className="glyphicon glyphicon-check" style={{
              display: 'inline-block',
              width: '20px',
              height: '20px',
            }}></span>
            {title}
          </h4>
          {!dontShowCloseBtn && (
            <button
              type="button"
              className="close"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '28px',
                lineHeight: '1',
                color: '#000',
                opacity: 0.5,
                cursor: 'pointer',
                padding: 0,
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ×
            </button>
          )}
        </div>

        {/* Modal Body - matches AngularJS alertModal.tpl.html */}
        <div className="modal-body" style={{
          padding: '20px',
        }}>
          <p
            dangerouslySetInnerHTML={{ __html: text }}
            style={{
              margin: 0,
              fontSize: '14px',
              lineHeight: '1.5',
              color: '#272b2c',
            }}
          ></p>
        </div>

        {/* Modal Footer - matches AngularJS alertModal.tpl.html */}
        <div className="modal-footer" style={{
          padding: '15px 20px',
          borderTop: '1px solid #e5e5e5',
          display: 'flex',
          justifyContent: 'flex-end',
        }}>
          <button
            ref={okButtonRef}
            type="button"
            className="btn btn-primary"
            onClick={onOk}
            style={{
              padding: '8px 16px',
              backgroundColor: 'rgb(51, 113, 189)', // Theme color
              color: '#fff',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            {okBtnLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

