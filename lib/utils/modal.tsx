'use client';

/**
 * Modal Service
 * 
 * Utility functions for showing modals
 * Matches AngularJS alertsService API
 */

import { createRoot, Root } from 'react-dom/client';
import PromptModal from '@/components/common/PromptModal';
import AlertModal from '@/components/common/AlertModal';
import LikeInfoModal, { type LikeInfoModalOpenProps } from '@/components/feed/LikeInfoModal';

let modalRoot: Root | null = null;

function getModalRoot(): Root {
  if (!modalRoot) {
    const container = document.createElement('div');
    container.id = 'modal-container';
    document.body.appendChild(container);
    modalRoot = createRoot(container);
  }
  return modalRoot;
}

function cleanupModal() {
  // IMPORTANT: never mutate container.innerHTML directly; it breaks React's root and leaks effects.
  // Render an empty tree so effects clean up (body overflow, keydown listeners) and future modals keep working.
  if (modalRoot) {
    modalRoot.render(<></>);
  }
}

/**
 * Show prompt modal (confirmation dialog)
 * Matches AngularJS alertsService.promptModal
 */
export function promptModal(
  title: string,
  text: string,
  okCallback?: (() => void) | null,
  cancelCallback?: (() => void) | null,
  okBtnLabel: string = 'OK',
  cancelBtnLabel: string = 'Cancel',
  defaultBtn?: 'ok' | 'cancel',
  dontShowCloseBtn: boolean = false,
  onlyDismissModalOnCloseBtn: boolean = false,
  showHeaderIcon: boolean = true,
  customHeaderIcon?: string
): void {
  const root = getModalRoot();
  
  const handleOk = () => {
    cleanupModal();
    if (okCallback) {
      okCallback();
    }
  };

  const handleCancel = () => {
    cleanupModal();
    if (cancelCallback) {
      cancelCallback();
    }
  };

  const handleClose = () => {
    if (onlyDismissModalOnCloseBtn) {
      cleanupModal();
    } else {
      handleCancel();
    }
  };

  root.render(
    <PromptModal
      title={title}
      text={text}
      okBtnLabel={okBtnLabel}
      cancelBtnLabel={cancelBtnLabel}
      showHeaderIcon={showHeaderIcon}
      customHeaderIcon={customHeaderIcon}
      dontShowCloseBtn={dontShowCloseBtn}
      onOk={handleOk}
      onCancel={handleCancel}
      onClose={handleClose}
    />
  );
}

/**
 * Show alert modal (simple alert)
 * Matches AngularJS alertsService.alertModal
 */
export function alertModal(
  title: string,
  text: string,
  okBtnLabel: string = 'Ok',
  okCallback?: (() => void) | null,
  dontShowCloseBtn: boolean = false,
  dontCloseOnEsc: boolean = false,
  customClass?: string
): void {
  const root = getModalRoot();
  
  const handleOk = () => {
    cleanupModal();
    if (okCallback) {
      okCallback();
    }
  };

  const handleClose = () => {
    cleanupModal();
  };

  root.render(
    <AlertModal
      title={title}
      text={text}
      okBtnLabel={okBtnLabel}
      dontShowCloseBtn={dontShowCloseBtn}
      onOk={handleOk}
      onClose={handleClose}
    />
  );
}

/**
 * Show Like Info modal (Angular parity: resourceLikeInfoModalService)
 */
export function likeInfoModal(props: LikeInfoModalOpenProps): void {
  const root = getModalRoot();

  const handleClose = () => {
    cleanupModal();
  };

  root.render(<LikeInfoModal {...(props as any)} onClose={handleClose} />);
}

