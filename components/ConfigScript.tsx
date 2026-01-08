'use client';

import { useEffect } from 'react';
import { resolveServicesHostString } from '@/lib/config/services-host';

/**
 * Client component to set global configuration
 * Sets servicesHost from environment variable or default
 */
export function ConfigScript() {
  useEffect(() => {
    // Set servicesHost if not already set
    if (typeof window !== 'undefined' && !(window as any).servicesHost) {
      const servicesHost = resolveServicesHostString({ allowWindow: false });
      (window as any).servicesHost = servicesHost;
      console.log('Set servicesHost to:', servicesHost);
    }
  }, []);

  return null;
}

