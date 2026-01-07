'use client';

/**
 * User Profile Image Component
 * 
 * Displays user profile image or initials fallback
 * Migrated from AngularJS cnv-user-profile-image directive
 */

import { useState, useEffect } from 'react';
import { User } from '@/lib/api/auth';
import { getUserProfileImageUrl, getUserInitials, stringToColor } from '@/lib/api/users';

interface UserProfileImageProps {
  userId: string;
  user?: User | null;
  width?: number | string;
  height?: number | string;
  profileType?: number;
  profileVersion?: number;
  fullName?: string;
  source?: string; // 'Feed' or other
  className?: string;
  showBorder?: boolean; // For edited-by avatars
}

export default function UserProfileImage({
  userId,
  user,
  width = 48,
  height = 48,
  profileType,
  profileVersion,
  fullName,
  source,
  className = '',
  showBorder = false,
}: UserProfileImageProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Determine size for image URL - map to standard sizes
  const widthNum = typeof width === 'number' ? width : parseInt(width.toString().replace('px', ''), 10);
  const heightNum = typeof height === 'number' ? height : parseInt(height.toString().replace('px', ''), 10);
  
  // Map to standard profile image sizes
  let size = '48x48'; // default
  if (widthNum <= 22) size = '22x22';
  else if (widthNum <= 28) size = '28x28';
  else if (widthNum <= 32) size = '32x32';
  else if (widthNum <= 48) size = '48x48';
  else if (widthNum <= 64) size = '64x64';
  else if (widthNum <= 96) size = '96x96';
  else if (widthNum <= 144) size = '144x144';
  else size = '184x184';
  
  // Get user data
  const userData = user || null;
  const userProfileType = profileType ?? (userData as any)?.profile_image_type;
  const userProfileVersion = profileVersion ?? (userData as any)?.profile_image_version;
  const userName = fullName || (userData ? getUserInitials(userData) : null) || userId;

  // Get image URL
  // IMPORTANT: servicesHost can be undefined on the window; never pass undefined to URL builder.
  const servicesHost =
    typeof window !== 'undefined'
      ? (window as any).servicesHost || 'app14.convodev.net'
      : 'app14.convodev.net';
  const imageUrl = getUserProfileImageUrl(
    userId,
    userProfileType,
    userProfileVersion,
    size,
    servicesHost
  );
  
  // Debug logging (remove in production)
  if (typeof window !== 'undefined' && (window as any).__DEBUG_AVATARS) {
    console.log('[UserProfileImage]', {
      userId,
      userProfileType,
      userProfileVersion,
      size,
      imageUrl,
      hasUser: !!userData,
    });
  }

  // Get initials and color for fallback
  const initials = getUserInitials(userData || { user_id: userId, name: userName } as User);
  const backgroundColor = stringToColor(userName);

  // Angular parity: always attempt to load the computed thumbnail URL (default/system/custom),
  // and use initials only as a placeholder/fallback if the image can't load.
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: `${widthNum}px`, height: `${heightNum}px` }}>
      {/* Placeholder initials - shown while loading or on error */}
      {(!imageLoaded || imageError) && (
        <span
          className={`img-circle ${className}`}
          style={{
            height: `${heightNum}px`,
            width: `${widthNum}px`,
            fontStyle: 'normal',
            lineHeight: `${heightNum}px`,
            textAlign: 'center',
            fontWeight: 100,
            fontSize: 'inherit',
            letterSpacing: '-1px',
            backgroundColor: backgroundColor,
            borderRadius: '50%',
            display: 'inline-block',
            color: '#fff',
            border: showBorder ? '2px solid white' : 'none',
            position: imageLoaded && imageError ? 'relative' : 'absolute',
          }}
        >
          {initials}
        </span>
      )}
      {/* Actual image - hidden until loaded */}
      <img
        src={imageUrl}
        alt={userName}
        className={`img-circle ${className}`}
        style={{
          width: `${widthNum}px`,
          height: `${heightNum}px`,
          borderRadius: '50%',
          display: (imageLoaded && !imageError) ? 'inline-block' : 'none',
          border: showBorder ? '2px solid white' : 'none',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
        onLoad={() => {
          setImageLoaded(true);
        }}
        onError={() => {
          setImageError(true);
          setImageLoaded(false);
        }}
      />
    </span>
  );
}

