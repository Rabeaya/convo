'use client';

import { useEffect } from 'react';

/**
 * Client component to set global configuration
 * Sets servicesHost from environment variable or default
 */
export function ConfigScript() {
  useEffect(() => {
    // Set servicesHost if not already set
    if (typeof window !== 'undefined' && !(window as any).servicesHost) {
      const servicesHost = process.env.NEXT_PUBLIC_SERVICES_HOST || 'app14.convodev.net';
      (window as any).servicesHost = servicesHost;
      console.log('Set servicesHost to:', servicesHost);
    }
  }, []);

  return null;
}

