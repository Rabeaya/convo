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
  const [showInitials, setShowInitials] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  const w = normalizeCssSize(width);
  const h = normalizeCssSize(height);
  const wNum = toNumber(width);
  const hNum = toNumber(height);

  const userName =
    (fullName || '').trim() ||
    (user ? getUserFullNameFromAnyUser(user) : '') ||
    userId;

  const initials = getUserInitials(user || ({ user_id: userId, name: userName } as any));
  const backgroundColor = stringToColor(userName || userId);

  // Keep URL generation stable and only set state when it changes.
  useEffect(() => {
    let directUrl: string | null = null;

    if (imgUrl) {
      directUrl = typeof imgUrl === 'function' ? imgUrl() : imgUrl;
    }

    if (!directUrl) {
      const t = profileType ?? (user as any)?.profile_image_type;
      const v = profileVersion ?? (user as any)?.profile_image_version;
      const size = toImageSize(Math.max(wNum, hNum));
      directUrl = getUserProfileImageUrl(userId, t as any, v as any, size);
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
  // Map to server thumbnail variants used by Convo
  if (size <= 24) return '24';
  if (size <= 32) return '32';
  if (size <= 48) return '48';
  if (size <= 64) return '64';
  if (size <= 84) return '84';
  return '184';
}

function getUserFullNameFromAnyUser(u: any): string {
  if (!u) return '';
  if (u.name) return String(u.name);
  const first = u.first_name || u.firstName || '';
  const last = u.last_name || u.lastName || '';
  const full = `${first} ${last}`.trim();
  return full || String(u.email || u.user_id || u.userId || '');
}
