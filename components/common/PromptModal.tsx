'use client';

/**
 * Prompt Modal Component
 * 
 * Confirmation dialog with OK/Cancel buttons
 * Migrated from AngularJS alertsService.promptModal
 * Exact 1:1 match with AngularJS promptModal.tpl.html
 */

import { useEffect, useRef } from 'react';

interface PromptModalProps {
  title: string;
  text: string;
  okBtnLabel?: string;
  cancelBtnLabel?: string;
  showHeaderIcon?: boolean;
  customHeaderIcon?: string;
  dontShowCloseBtn?: boolean;
  onOk: () => void;
  onCancel: () => void;
  onClose: () => void;
}

export default function PromptModal({
  title,
  text,
  okBtnLabel = 'OK',
  cancelBtnLabel = 'Cancel',
  showHeaderIcon = true,
  customHeaderIcon,
  dontShowCloseBtn = false,
  onOk,
  onCancel,
  onClose,
}: PromptModalProps) {
  const okButtonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-focus OK button (matches AngularJS autofocus)
    if (okButtonRef.current) {
      okButtonRef.current.focus();
    }

    // Handle ESC key (matches AngularJS keyboard handling)
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    // Handle Enter key on OK button
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
  }, [onOk, onCancel]);

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
    >
      {/* Angular uses bootstrap modal structure + `windowClass: 'prompt-modal'` */}
      <div className="prompt-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-dialog" style={{ margin: 0 }}>
          <div
            ref={modalRef}
            className="modal-content"
            style={{
              backgroundColor: '#fff',
              borderRadius: '4px',
              minWidth: '400px',
              maxWidth: '600px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            }}
          >
        {/* Modal Header - matches AngularJS promptModal.tpl.html */}
        <div className="modal-header" style={{
          padding: '15px 20px',
          background: '#1e2e3d',
          color: '#fff',
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
            color: '#fff',
          }}>
            {showHeaderIcon && !customHeaderIcon && (
              <span className="cnv-icons-20 info-white" style={{
                display: 'inline-block',
                width: '20px',
                height: '20px',
              }}></span>
            )}
            {showHeaderIcon && customHeaderIcon && (
              <span className={customHeaderIcon} style={{
                display: 'inline-block',
                width: '20px',
                height: '20px',
              }}></span>
            )}
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
                color: '#fff',
                opacity: 0.7,
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

        {/* Modal Body - matches AngularJS promptModal.tpl.html */}
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

        {/* Modal Footer - matches AngularJS promptModal.tpl.html */}
        <div className="modal-footer" style={{
          padding: '15px 20px',
          borderTop: '1px solid #e5e5e5',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px',
        }}>
          <button
            ref={okButtonRef}
            type="button"
            className="btn btn-primary"
            id="promptOk"
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
          {cancelBtnLabel && (
            <button
              type="button"
              id="promptCancel"
              className="btn btn-default"
              onClick={onCancel}
              style={{
                padding: '8px 16px',
                backgroundColor: '#fff',
                color: '#272b2c',
                border: '1px solid #ddd',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              {cancelBtnLabel}
            </button>
          )}
        </div>
          </div>
        </div>
      </div>
    </div>
  );
}

