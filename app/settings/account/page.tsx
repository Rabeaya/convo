'use client';

/**
 * Account Settings Page Route
 * 
 * This route redirects to the main settings page with account view
 * The actual content is in SettingsPage component
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AccountSettingsPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to main settings page - it will show account view by default
    router.replace('/settings');
  }, [router]);

  return null;
}

