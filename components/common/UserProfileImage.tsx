'use client';

/**
 * User Profile Image Component
 * 
 * Migrated from AngularJS cnv-user-profile-image directive
 * Displays user profile image with initials fallback
 */

import { useEffect, useState, useRef } from 'react';

interface UserProfileImageProps {
  userId?: string;
  width?: number | string;
  height?: number | string;
  imgUrl?: string | (() => string);
  fullName?: string;
  profileType?: string;
  profileVersion?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function UserProfileImage({
  userId,
  width = 48,
  height = 48,
  imgUrl,
  fullName = '',
  profileType,
  profileVersion,
  className = '',
  style = {},
}: UserProfileImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showInitials, setShowInitials] = useState(false);
  const [initials, setInitials] = useState('');
  const [backgroundColor, setBackgroundColor] = useState('#4183d7');
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const size = typeof width === 'string' ? parseInt(width) : width;
    const imageSize = getUserProfileImageSize(size);
    
    // Get direct URL if provided
    let directUrl: string | null = null;
    if (imgUrl) {
      directUrl = typeof imgUrl === 'function' ? imgUrl() : imgUrl;
    }

    // Build image URL if not provided directly
    if (!directUrl && userId) {
      // Construct URL based on profile type and version
      // profileType and profileVersion can be numbers or strings
      const type = profileType !== undefined ? String(profileType) : undefined;
      const version = profileVersion !== undefined ? String(profileVersion) : undefined;
      
      if (type !== undefined && version !== undefined) {
        directUrl = getUserImageUrl(userId, type, version, imageSize);
      } else {
        // Try to get from user data if available
        directUrl = getDefaultUserImageUrl(userId, imageSize);
      }
    }

    // Always try to load image first, show initials only on error
    if (directUrl) {
      setImageUrl(directUrl);
      setShowInitials(false);
      // Setup initials as fallback
      setupInitials(fullName);
    } else {
      // No URL available, show initials immediately
      setupInitials(fullName);
      setShowInitials(true);
    }
  }, [userId, width, height, imgUrl, fullName, profileType, profileVersion]);

  const setupInitials = (name: string) => {
    if (!name) {
      setInitials('. .');
      return;
    }

    // Extract initials from name
    const parts = name.trim().split(/\s+/);
    let initialsText = '';
    
    if (parts.length >= 2) {
      initialsText = (parts[0][0] || '') + (parts[parts.length - 1][0] || '');
    } else if (parts.length === 1) {
      initialsText = parts[0].substring(0, 2).toUpperCase();
    } else {
      initialsText = '. .';
    }

    setInitials(initialsText.toUpperCase());
    
    // Generate background color from name
    const color = stringToColor(name);
    setBackgroundColor(color);
  };

  const handleImageError = () => {
    // If image fails to load, show initials
    setupInitials(fullName);
    setShowInitials(true);
    setImageUrl(null);
  };

  const handleImageLoad = () => {
    setShowInitials(false);
  };

  const w = typeof width === 'string' ? width : `${width}px`;
  const h = typeof height === 'string' ? height : `${height}px`;
  const hNum = typeof height === 'string' ? parseInt(height) : height;

  // Always render image first, fallback to initials on error
  if (imageUrl && !showInitials) {
    return (
      <img
        ref={imageRef}
        src={imageUrl}
        alt={fullName || 'User'}
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
          ...style,
        }}
        onError={handleImageError}
        onLoad={handleImageLoad}
      />
    );
  }

  // Show initials fallback
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
        backgroundColor: backgroundColor,
        color: '#fff',
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        verticalAlign: 'middle',
        ...style,
      }}
    >
      {initials}
    </span>
  );
}

// Helper functions
function getUserProfileImageSize(size: number): string {
  // Map size to image size variant (matching AngularJS UserProfileImage constants)
  // Sizes: 24, 48, 64, 84, 184
  if (size <= 24) return '24';
  if (size <= 48) return '48';
  if (size <= 64) return '64';
  if (size <= 84) return '84';
  return '184';
}

function getUserImageUrl(
  userId: string,
  profileType: string,
  profileVersion: string,
  imageSize: string
): string {
  // Construct user image URL matching AngularJS utilFilters.js pattern
  // For custom images: /user-images/{userId}/thumbnails/{userId}-thumbnail-{size}-{version}.jpg
  // profileType: 0 = default, 1 = custom, system = system
  
  const baseUrl = typeof window !== 'undefined' 
    ? (window as { servicesHost?: string }).servicesHost 
      ? `https://${(window as { servicesHost: string }).servicesHost}`
      : ''
    : '';
  
  const profileTypeNum = parseInt(profileType);
  
  // System user
  if (profileTypeNum === 2) { // PROFILE_IMAGE_TYPE_SYSTEM
    return `${baseUrl}/user-images/system-user/thumbnails/system-user-thumbnail-${imageSize}.png`;
  }
  
  // Default user (type 0 or no version)
  if (profileTypeNum === 0 || !profileVersion || profileVersion === '0') {
    return `${baseUrl}/user-images/default-user/thumbnails/default-user-thumbnail-${imageSize}.png`;
  }
  
  // Custom user image (type 1)
  // Pattern: /user-images/{userId}/thumbnails/{userId}-thumbnail-{size}-{version}.jpg
  return `${baseUrl}/user-images/${userId}/thumbnails/${userId}-thumbnail-${imageSize}-${profileVersion}.jpg`;
}

function getDefaultUserImageUrl(userId: string, imageSize: string): string {
  // Default user image path
  const baseUrl = typeof window !== 'undefined' 
    ? (window as { servicesHost?: string }).servicesHost 
      ? `https://${(window as { servicesHost: string }).servicesHost}`
      : ''
    : '';
  
  return `${baseUrl}/user-images/default-user/thumbnails/default-user-thumbnail-${imageSize}.png`;
}

function stringToColor(str: string): string {
  // Generate a color from a string (same algorithm as AngularJS)
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const hue = hash % 360;
  const saturation = 65 + (hash % 20); // 65-85%
  const lightness = 45 + (hash % 15); // 45-60%
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

