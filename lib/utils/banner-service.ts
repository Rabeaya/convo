/**
 * Banner Service
 * 
 * Replicates AngularJS bannerService functionality
 * Shows yellow ticker banners at the top of the feed
 */

type BannerCallback = () => void;

export interface Banner {
  id: number;
  promise?: Promise<any>;
  text: string;
  resolveText?: string;
  errorText?: string;
  displayText: string;
  dontAutoDismiss?: boolean;
  showCloseBtn?: boolean;
  linkClickCallback?: BannerCallback;
  autoDismissTime?: number;
  bannerDismissCbk?: BannerCallback;
  autoDismissTimeoutId?: NodeJS.Timeout;
  dismissedInternally?: boolean;
}

interface BannerInput {
  promise?: Promise<any>;
  text: string;
  resolveText?: string;
  errorText?: string;
  dontAutoDismiss?: boolean;
  showCloseBtn?: boolean;
  linkClickCallback?: BannerCallback;
  autoDismissTime?: number;
  bannerDismissCbk?: BannerCallback;
}

class BannerService {
  private bannersStack: Banner[] = [];
  private incrementingId = 0;
  private listeners: Set<() => void> = new Set();

  private triggerUpdate() {
    this.listeners.forEach(listener => listener());
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getBannersStack(): Banner[] {
    return this.bannersStack;
  }

  private registerBanner(bannerInput: BannerInput): number {
    const banner: Banner = {
      ...bannerInput,
      id: 0, // Will be set below
      displayText: bannerInput.text,
    };
    banner.id = this.incrementingId++;
    banner.displayText = banner.text;

    if (!banner.dontAutoDismiss) {
      // Dismiss all currently displayed auto dismiss banners
      for (let i = this.bannersStack.length - 1; i >= 0; i--) {
        const b = this.bannersStack[i];
        if (!b.dontAutoDismiss) {
          if (b.autoDismissTimeoutId) {
            clearTimeout(b.autoDismissTimeoutId);
          }
          b.dismissedInternally = true;
          this.bannersStack.splice(i, 1);
        }
      }
    }

    if (banner.promise) {
      banner.promise
        .then(() => {
          if (banner.dismissedInternally) {
            return;
          }

          if (banner.resolveText) {
            banner.displayText = banner.resolveText;
            this.triggerUpdate();
          }

          if (!banner.dontAutoDismiss) {
            this.autoDismissBanner(banner);
          }
        })
        .catch(() => {
          if (banner.dismissedInternally) {
            return;
          }

          if (banner.errorText) {
            banner.displayText = banner.errorText;
            this.triggerUpdate();
          }

          if (!banner.dontAutoDismiss) {
            this.autoDismissBanner(banner);
          }
        });
    } else if (!banner.dontAutoDismiss) {
      this.autoDismissBanner(banner);
    }

    this.bannersStack.unshift(banner);
    this.triggerUpdate();

    return banner.id;
  }

  private autoDismissBanner(banner: Banner) {
    const timeoutId = setTimeout(() => {
      this.dismissBanner(banner.id);
    }, banner.autoDismissTime || 3000);

    banner.autoDismissTimeoutId = timeoutId;
  }

  showBanner(
    text: string,
    dontAutoDismiss?: boolean,
    showCloseBtn?: boolean,
    linkClickCallback?: BannerCallback,
    autoDismissTime?: number,
    bannerDismissCbk?: BannerCallback
  ): number {
    return this.registerBanner({
      promise: undefined,
      text,
      resolveText: undefined,
      errorText: undefined,
      dontAutoDismiss,
      showCloseBtn,
      linkClickCallback,
      autoDismissTime,
      bannerDismissCbk,
    });
  }

  showBanner_promise(
    promise: Promise<any>,
    text: string,
    resolveText?: string,
    errorText?: string,
    dontAutoDismiss?: boolean,
    showCloseBtn?: boolean,
    linkClickCallback?: BannerCallback,
    autoDismissTime?: number,
    bannerDismissCbk?: BannerCallback
  ): number {
    return this.registerBanner({
      promise,
      text,
      resolveText,
      errorText,
      dontAutoDismiss,
      showCloseBtn,
      linkClickCallback,
      autoDismissTime,
      bannerDismissCbk,
    });
  }

  dismissBanner(id: number) {
    const banner = this.bannersStack.find(b => b.id === id);
    if (!banner) return;

    if (banner.bannerDismissCbk) {
      banner.bannerDismissCbk();
    }

    const idx = this.bannersStack.findIndex(b => b.id === id);
    if (idx !== -1) {
      if (banner.autoDismissTimeoutId) {
        clearTimeout(banner.autoDismissTimeoutId);
      }
      this.bannersStack.splice(idx, 1);
      this.triggerUpdate();
    }
  }

  dismissAllBanners() {
    for (let i = 0; i < this.bannersStack.length; i++) {
      this.dismissBanner(this.bannersStack[i].id);
    }
  }

  onBannerTextClick(event: React.MouseEvent, bannerId: number) {
    const target = event.target as HTMLElement;
    if (target.nodeName !== 'A') {
      return;
    }

    const banner = this.bannersStack.find(b => b.id === bannerId);
    if (banner && banner.linkClickCallback) {
      banner.linkClickCallback();
    }

    this.dismissBanner(bannerId);
  }

  onBannerCloseBtnClick(bannerId: number) {
    this.dismissBanner(bannerId);
  }
}

export const bannerService = new BannerService();

