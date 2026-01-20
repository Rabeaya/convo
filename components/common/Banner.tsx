'use client';

/**
 * Banner Component
 * 
 * Replicates AngularJS cnvBanners directive
 * Shows yellow ticker banners at the top of the feed
 */

import { useEffect, useState } from 'react';
import { bannerService, type Banner } from '@/lib/utils/banner-service';

export default function BannerComponent() {
  const [bannersStack, setBannersStack] = useState<Banner[]>([]);

  useEffect(() => {
    // Initial load
    setBannersStack(bannerService.getBannersStack());

    // Subscribe to updates
    const unsubscribe = bannerService.subscribe(() => {
      setBannersStack([...bannerService.getBannersStack()]);
    });

    return unsubscribe;
  }, []);

  if (bannersStack.length === 0) {
    return null;
  }

  return (
    <div className="banners-cont">
      {bannersStack.map((banner) => (
        <div key={banner.id} className="banner">
          {banner.showCloseBtn && (
            <span
              style={{
                float: 'right',
                cursor: 'pointer',
                marginTop: '-1px',
              }}
              onClick={() => bannerService.onBannerCloseBtnClick(banner.id)}
            >
              <i className="cnv-icons-8 icons2_Close-darkgray"></i>
            </span>
          )}
          <span
            dangerouslySetInnerHTML={{ __html: banner.displayText }}
            onClick={(e) => bannerService.onBannerTextClick(e, banner.id)}
          />
        </div>
      ))}
    </div>
  );
}

