'use client';

import { useEffect } from 'react';
import { resolveServicesHostString } from '@/lib/config/services-host';

/**
 * Client component to set global configuration
 * Replicates AngularJS config.js settings in window.com_convo.config
 * 
 * These values MUST match the backend configuration for XMPP/BOSH to work
 */
export function ConfigScript() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const win = window as any;

    // Set servicesHost if not already set
    if (typeof window !== 'undefined' && !(window as any).servicesHost) {
      const servicesHost = resolveServicesHostString({ allowWindow: false });
      (window as any).servicesHost = servicesHost;
      console.log('Set servicesHost to:', servicesHost);
    }

    // Initialize com_convo namespace (matches AngularJS)
    win.com_convo = win.com_convo || {};
    win.com_convo.config = win.com_convo.config || {};

    // XMPP/BOSH Configuration (from Angular config.js)
    // These defaults match the development environment in Angular
    // For production, set environment variables to override
    const xmppServer = process.env.NEXT_PUBLIC_XMPP_SERVER || 'bosh.convodev.net';
    const xmppDomain = process.env.NEXT_PUBLIC_XMPP_DOMAIN || 'xmpp.convodev.net';
    const secureComm = process.env.NEXT_PUBLIC_XMPP_SECURE_COMM !== 'false'; // default: true

    win.com_convo.config.XMPP_SERVER = xmppServer;
    win.com_convo.config.XMPP_DOMAIN = xmppDomain;
    win.com_convo.config.SECURE_COMM = secureComm;

    // Additional config values from Angular config.js
    win.com_convo.config.IS_NATIVE = false;
    win.com_convo.config.CLIENT_TYPE = 'w2'; // web client

    console.log('[Config] XMPP Configuration:', {
      XMPP_SERVER: xmppServer,
      XMPP_DOMAIN: xmppDomain,
      SECURE_COMM: secureComm,
    });

    // Dispatch event to notify components that config is ready
    window.dispatchEvent(new CustomEvent('configReady'));
  }, []);

  return null;
}

