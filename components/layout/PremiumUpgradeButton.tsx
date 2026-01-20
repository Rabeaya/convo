'use client';

/**
 * Premium Upgrade Button Component
 * 
 * Migrated from AngularJS cnv-premium-upgrade-btn directive
 * Shows upgrade button for STARTER accounts
 */

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';

export default function PremiumUpgradeButton() {
  const router = useRouter();
  const account = useAuthStore((state) => state.account);
  const user = useAuthStore((state) => state.user);

  // Check if we should show the upgrade button
  // Show for STARTER accounts, non-guest users
  const accountLevel = (account as any)?.account_level || (account as any)?.accountLevel;
  const isGuest = (user as any)?.isGuest || false;
  const shouldShow = !isGuest && accountLevel === 'STARTER';

  if (!shouldShow) {
    return null;
  }

  const firstName = (user as any)?.first_name || (user as any)?.firstName || '';
  const accountName = (account as any)?.account_name || (account as any)?.account_key || '';

  const handleClick = () => {
    // Navigate to premium upgrade page
    // URL format: /settings/upgrade or similar based on AppLinks
    router.push('/settings/upgrade');
  };

  return (
    <div className="cnv-premium-upgrade-btn">
      <span 
        className="onboarding-upgrade-to-premium-tooltip" 
        onClick={handleClick}
        style={{
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <img 
          src="/assets/img/pricing/crown@2x.svg" 
          alt="Upgrade" 
          style={{
            width: '16px',
            height: '16px',
          }}
        />
        <span className="premium-upgrade-title" style={{
          fontSize: '14px',
          color: '#339fb8',
          fontWeight: 'normal',
        }}>
          Upgrade
        </span>
      </span>
    </div>
  );
}


