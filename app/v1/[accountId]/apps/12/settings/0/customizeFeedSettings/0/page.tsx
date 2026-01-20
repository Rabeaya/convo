'use client';

/**
 * Route parity for AngularJS AppLinks:
 * #/v1/{accountId}/apps/12/settings/0/customizeFeedSettings/0
 *
 * This page renders the migrated React settings view to match the canonical Angular URL structure.
 */

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AngularParityCustomizeFeedRoute() {
  const router = useRouter();

  useEffect(() => {
    // Keep React's clean URL as primary; this route is an alias for parity/back-compat.
    router.replace('/settings/customize-feed');
  }, [router]);

  return null;
}



