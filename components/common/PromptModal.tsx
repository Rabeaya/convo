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
    <>
      {/* Modal backdrop - matches Angular Bootstrap modal */}
      <div
        className="modal-backdrop fade in"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1040,
        }}
        // Angular uses backdrop: 'static' - backdrop is present but clicking it doesn't close modal
      />
      {/* Angular uses bootstrap modal structure: modal fade prompt-modal in */}
      <div 
        className="modal fade prompt-modal in" 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1050,
          display: 'block',
          overflow: 'auto',
        }}
      >
        <div 
          className="modal-dialog" 
          style={{ 
            margin: '30px auto',
            width: '600px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            ref={modalRef}
            className="modal-content"
            onClick={(e) => e.stopPropagation()} // Prevent clicks inside modal from bubbling
            style={{
              backgroundColor: '#fff',
              borderRadius: '4px',
              boxShadow: '0 3px 9px rgba(0, 0, 0, 0.5)',
            }}
          >
        {/* Modal Header - matches AngularJS promptModal.tpl.html */}
        <div className="modal-header" style={{
          padding: '15px 20px',
          background: '#3371bd',
          color: '#ffffff',
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
            color: '#ffffff',
          }}>
            {showHeaderIcon && !customHeaderIcon && (
              <span className="cnv-icons-20 info-white"></span>
            )}
            {showHeaderIcon && customHeaderIcon && (
              <span className={customHeaderIcon}></span>
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
                color: '#ffffff',
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
        <div className="modal-body">
          <p dangerouslySetInnerHTML={{ __html: text }}></p>
        </div>

        {/* Modal Footer - matches AngularJS promptModal.tpl.html */}
        <div className="modal-footer">
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
              width: '140px',
              minWidth: '140px',
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
                width: '140px',
                minWidth: '140px',
              }}
            >
              {cancelBtnLabel}
            </button>
          )}
        </div>
          </div>
        </div>
      </div>
    </>
  );
}

