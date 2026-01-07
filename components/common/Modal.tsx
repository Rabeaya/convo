'use client';

/**
 * Reusable Modal Component
 * 
 * Matches AngularJS modal styling exactly
 * Can be used for any modal dialog in the application
 */

import { ReactNode, useEffect } from 'react';
import './Modal.css';

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  className?: string;
  showCloseButton?: boolean;
  width?: number | string;
}

export default function Modal({
  open,
  onOpenChange,
  title,
  children,
  className = '',
  showCloseButton = true,
  width = 650,
}: ModalProps) {
  // Handle body class for modal-open
  useEffect(() => {
    if (open) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [open]);

  // Handle ESC key
  useEffect(() => {
    if (!open) return;
    
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };
    
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <>
      <div
        className="modal-backdrop"
        onClick={() => onOpenChange(false)}
        style={{ opacity: 0.5 }}
      />
      <div className={`modal fade ${open ? 'in' : ''}`} style={{ display: 'block' }}>
        <div
          className={`modal-dialog cnv-modal-dialog ${className}`}
          style={{ width: typeof width === 'number' ? `${width}px` : width }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h4>{title}</h4>
              {showCloseButton && (
                <button
                  type="button"
                  className="close"
                  onClick={() => onOpenChange(false)}
                  aria-label="Close"
                >
                  ×
                </button>
              )}
            </div>
            <div className="modal-body">
              {children}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

