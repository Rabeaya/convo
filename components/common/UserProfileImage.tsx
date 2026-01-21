'use client';

/**
 * User Profile Image Component
 * 
 * Migrated from AngularJS cnv-user-profile-image directive
 */


import { useEffect, useRef, useState } from 'react';
import type { User } from '@/lib/api/auth';
import { getUserInitials, getUserProfileImageUrl, stringToColor } from '@/lib/api/users';

export interface UserProfileImageProps {
  userId: string;
  user?: User | any | null;
  width?: number | string;
  height?: number | string;
  imgUrl?: string | (() => string);
  fullName?: string;
  profileType?: number | string;
  profileVersion?: number | string;
  source?: string;
  className?: string;
  style?: React.CSSProperties;
  showBorder?: boolean;
}

export default function UserProfileImage({
  userId,
  user,
  width = 48,
  height = 48,
  imgUrl,
  fullName,
  profileType,
  profileVersion,
  source,
  className = '',
  style = {},
  showBorder = false,
}: UserProfileImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showInitials, setShowInitials] = useState(true); // CRITICAL: Start with true to show initials by default
  const imageRef = useRef<HTMLImageElement>(null);

  const w = normalizeCssSize(width);
  const h = normalizeCssSize(height);
  const wNum = toNumber(width);
  const hNum = toNumber(height);

  // CRITICAL: Calculate userName with priority: fullName > user.displayName > user.name > user.first_name+last_name > user.email > userId
  const userName =
    (fullName || '').trim() ||
    ((user as any)?.displayName || '').trim() ||
    (user ? getUserFullNameFromAnyUser(user) : '') ||
    userId;

  // CRITICAL: Calculate initials with fallback to userName if user object doesn't have name properties
  // This ensures initials are always calculated, even if user object is incomplete
  // If user object doesn't have name properties, use userName (which comes from fullName or displayName)
  const userForInitials = user ? {
    ...user,
    // Ensure name is set if it's missing but we have displayName or fullName
    name: (user as any).name || (user as any).displayName || fullName || userName,
    // Ensure first_name/last_name are set if missing but we have a name to extract from
    first_name: (user as any).first_name || (user as any).firstName || 
      (userName.includes(' ') ? userName.split(' ')[0] : userName),
    last_name: (user as any).last_name || (user as any).lastName || 
      (userName.includes(' ') ? userName.split(' ').slice(1).join(' ') : ''),
  } : ({ 
    user_id: userId, 
    name: userName,
    // Try to extract first/last name from userName if it contains spaces
    first_name: userName.includes(' ') ? userName.split(' ')[0] : userName,
    last_name: userName.includes(' ') ? userName.split(' ').slice(1).join(' ') : '',
    email: userName.includes('@') ? userName : undefined,
  } as any);
  const initials = getUserInitials(userForInitials);
  
  // CRITICAL: If initials are ". .", it means getUserInitials couldn't extract a name
  // This should not happen if displayName or fullName is provided
  if (initials === '. .' && (fullName || (user as any)?.displayName || userName !== userId)) {
    console.warn('[UserProfileImage] ⚠️ Initials are ". ." but name should be available:', {
      userId,
      fullName,
      userName,
      userDisplayName: (user as any)?.displayName,
      userHasName: !!(user as any)?.name,
      userHasFirstName: !!(user as any)?.first_name || !!(user as any)?.firstName,
      userHasLastName: !!(user as any)?.last_name || !!(user as any)?.lastName,
      userForInitialsName: (userForInitials as any)?.name,
      userForInitialsFirstName: (userForInitials as any)?.first_name,
      userForInitialsLastName: (userForInitials as any)?.last_name,
    });
  }
  
  // Debug: Log initials calculation if enabled
  if (typeof window !== 'undefined' && (window as any).__DEBUG_AVATAR__) {
    console.log('[UserProfileImage] Initials calculation:', {
      userId,
      userName,
      fullName,
      initials,
      userHasName: !!(user as any)?.name,
      userHasDisplayName: !!(user as any)?.displayName,
      userHasFirstName: !!(user as any)?.first_name || !!(user as any)?.firstName,
      userHasLastName: !!(user as any)?.last_name || !!(user as any)?.lastName,
      userHasEmail: !!(user as any)?.email,
      userForInitialsName: (userForInitials as any)?.name,
      userForInitialsFirstName: (userForInitials as any)?.first_name,
      userForInitialsLastName: (userForInitials as any)?.last_name,
    });
  }
  const backgroundColor = stringToColor(userName || userId);
  
  // Debug: Log initials calculation (remove in production)
  if (typeof window !== 'undefined' && (window as any).__DEBUG_AVATAR__) {
    console.log('[UserProfileImage] Initials calculation:', {
      userId,
      userName,
      initials,
      userHasName: !!(user as any)?.name,
      userHasFirstName: !!(user as any)?.first_name || !!(user as any)?.firstName,
      userHasLastName: !!(user as any)?.last_name || !!(user as any)?.lastName,
      userHasEmail: !!(user as any)?.email,
      fullName,
    });
  }

  // Keep URL generation stable and only set state when it changes.
  useEffect(() => {
    let directUrl: string | null = null;

    if (imgUrl) {
      directUrl = typeof imgUrl === 'function' ? imgUrl() : imgUrl;
    }

    if (!directUrl) {
      const t = profileType ?? (user as any)?.profile_image_type;
      const v = profileVersion ?? (user as any)?.profile_image_version;
      
      // CRITICAL: Only generate URL for custom or system images, NOT for default images
      // Matches AngularJS behavior - show initials instead of default image
      const PROFILE_IMAGE_TYPE_SYSTEM = 2;
      const PROFILE_IMAGE_TYPE_CUSTOM = 1;
      const PROFILE_IMAGE_TYPE_DEFAULT = 0;
      
      const typeNum = Number(t);
      const versionNum = Number(v);
      const hasValidVersion = versionNum > 0;
      
      // Only generate URL if:
      // 1. System user (type === 2), OR
      // 2. Custom image (type === 1) with valid version (> 0)
      // Otherwise, show initials (no URL = show initials)
      if (typeNum === PROFILE_IMAGE_TYPE_SYSTEM || 
          (typeNum === PROFILE_IMAGE_TYPE_CUSTOM && hasValidVersion)) {
        const size = toImageSize(Math.max(wNum, hNum));
        const serialNo =
          (user as any)?.serialNo ??
          (user as any)?.serial_no ??
          (user as any)?.serial_number ??
          (user as any)?.user_serial_no;
        directUrl = getUserProfileImageUrl(userId, t as any, v as any, size, undefined, false, Number(serialNo));
      }
      // If type is DEFAULT (0) or version is 0/missing, directUrl stays null = show initials
    }

    setImageUrl((prev) => (prev === directUrl ? prev : directUrl));
    setShowInitials(!directUrl);
  }, [hNum, imgUrl, profileType, profileVersion, source, user, userId, wNum]);

  const borderStyle = showBorder ? '2px solid white' : undefined;

  if (imageUrl && !showInitials) {
    return (
      <img
        ref={imageRef}
        src={imageUrl}
        alt={userName || 'User'}
        className={`img-circle ${className}`}
        style={{
          width: w,
          height: h,
          minWidth: w,
          minHeight: h,
          maxWidth: w,
          maxHeight: h,
          borderRadius: '50%',
          display: 'inline-block',
          objectFit: 'cover',
          verticalAlign: 'middle',
          border: borderStyle,
          ...style,
        }}
        onError={() => {
          setShowInitials(true);
          setImageUrl(null);
        }}
        onLoad={() => {
          setShowInitials(false);
        }}
      />
    );
  }

  return (
    <span
      className={`img-circle ${className}`}
      style={{
        height: h,
        width: w,
        minHeight: h,
        minWidth: w,
        maxHeight: h,
        maxWidth: w,
        fontStyle: 'normal',
        lineHeight: `${hNum}px`,
        textAlign: 'center',
        fontWeight: 100,
        fontSize: hNum <= 24 ? '10px' : hNum <= 48 ? '14px' : '18px',
        letterSpacing: '-1px',
        backgroundColor,
        color: '#fff',
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        verticalAlign: 'middle',
        border: borderStyle,
        ...style,
      }}
    >
      {initials}
    </span>
  );
}

function normalizeCssSize(value: number | string): string {
  if (typeof value === 'number') return `${value}px`;
  const trimmed = value.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return `${trimmed}px`;
  return trimmed;
}

function toNumber(value: number | string): number {
  if (typeof value === 'number') return value;
  const trimmed = value.trim();
  const num = parseFloat(trimmed.replace(/px$/i, ''));
  return Number.isFinite(num) ? num : 0;
}

function toImageSize(size: number): string {
  // Matches Angular: utils.getUserProfileImageForSize(size) in `web_app/src/app/common/utils.js`
  // Note: Angular doubles the size on retina.
  let s = Number(size) || 0;
  const isRetina = typeof window !== 'undefined' && window.devicePixelRatio > 1;
  if (isRetina) s *= 2;

  if (s <= 22) s = 22;
  else if (s <= 28) s = 28;
  else if (s <= 32) s = 32;
  else if (s <= 48) s = 48;
  else if (s <= 64) s = 64;
  else if (s <= 81) s = 81;
  else if (s <= 96) s = 96;
  else if (s <= 129) s = 129;
  else if (s <= 144) s = 144;
  else if (s <= 184) s = 184;
  else s = 750;

  return `${s}x${s}`;
}

function getUserFullNameFromAnyUser(u: any): string {
  if (!u) return '';
  if (u.name) return String(u.name);
  const first = u.first_name || u.firstName || '';
  const last = u.last_name || u.lastName || '';
  const full = `${first} ${last}`.trim();
  return full || String(u.email || u.user_id || u.userId || '');
}
