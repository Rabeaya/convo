'use client';

/**
 * User Menu Dropdown Component
 * 
 * Migrated from AngularJS cnv-dropdowns directive with user-menu-dropdown-widget
 * Exact match with AngularJS dropdown structure and styling
 */

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useLogout } from '@/lib/hooks/use-auth';
import UserProfileImage from '@/components/common/UserProfileImage';

interface MenuOption {
  label?: string;
  subtext?: string;
  callback: () => void;
  isDivider?: boolean;
  escapeAngularBindings?: boolean;
}

export default function UserMenuDropdown() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const account = useAuthStore((state) => state.account);
  const { mutate: logout } = useLogout();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const firstName = (user as any)?.first_name || (user as any)?.firstName || '';
  const lastName = (user as any)?.last_name || (user as any)?.lastName || '';
  const email = (user as any)?.email || '';
  const phone = (user as any)?.phone || '';
  const fullName = `${firstName} ${lastName}`.trim();
  const displayName = fullName || email || 'User';
  const subtext = phone || email;
  
  const userId = (user as any)?.user_id || (user as any)?.userId || '';
  const profileImageUrl = (user as any)?.getUserImageUrl_64x64 || (user as any)?.profile_picture;
  const profileType = (user as any)?.profile_image_type;
  const profileVersion = (user as any)?.profile_image_version;

  // Check if user is admin
  const isAdmin = (user as any)?.isAdmin || (user as any)?.is_admin || false;
  const isAdminMode = (account as any)?.is_administration_mode || false;

  const openUserProfile = () => {
    router.push('/feed?filter=from:me');
    setIsOpen(false);
  };

  const editUserProfile = () => {
    router.push('/feed?filter=from:me&action=editProfile');
    setIsOpen(false);
  };

  const openCombinedSetProfilePictureModal = () => {
    // TODO: Open profile picture modal
    setIsOpen(false);
  };

  const navigateToNotificationPreferences = () => {
    router.push('/settings/notifications');
    setIsOpen(false);
  };

  const navigateToSettings = () => {
    router.push('/settings');
    setIsOpen(false);
  };

  const enterAdminMode = () => {
    // TODO: Implement admin mode switch
    setIsOpen(false);
  };

  const exitAdminMode = () => {
    // TODO: Implement exit admin mode
    setIsOpen(false);
  };

  const handleLogout = () => {
    logout();
    setIsOpen(false);
  };

  // Build menu options matching AngularJS structure
  const menuOptions: MenuOption[] = [
    {
      label: displayName,
      subtext: subtext,
      callback: openUserProfile,
      escapeAngularBindings: true,
    },
    {
      label: 'Edit profile',
      callback: editUserProfile,
    },
    {
      isDivider: true,
      callback: () => {},
    },
    {
      label: 'Change your photo',
      callback: openCombinedSetProfilePictureModal,
    },
    {
      label: 'Notification preferences',
      callback: navigateToNotificationPreferences,
    },
    {
      isDivider: true,
      callback: () => {},
    },
    {
      label: 'Settings',
      callback: navigateToSettings,
    },
  ];

  // Add admin mode options
  if (isAdmin && isAdminMode) {
    menuOptions.push({
      label: 'Exit admin mode',
      callback: exitAdminMode,
    });
  } else if (isAdmin) {
    menuOptions.push({
      label: 'Enter admin mode',
      callback: enterAdminMode,
    });
  }

  // Add logout
  menuOptions.push({
    label: 'Sign Out',
    callback: handleLogout,
  });

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Adjust menu position after DOM update
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        if (menuRef.current) {
          adjustMenuPosition();
        }
      });
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const adjustMenuPosition = () => {
    if (!menuRef.current || !dropdownRef.current) return;

    const menu = menuRef.current;
    
    // Reset position first (matching AngularJS resetMenuPosition)
    menu.style.position = 'absolute';
    menu.style.top = '20px';
    menu.style.left = 'auto';
    menu.style.right = '0';

    // Get current position after reset
    const rect = menu.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;

    // Adjust if menu goes below viewport (matching AngularJS adjustMenuBasedOnPosition)
    if (rect.top + rect.height > windowHeight) {
      menu.style.top = `${-1 * rect.height - 15}px`;
    }

    // Adjust if menu goes beyond right edge (matching AngularJS logic)
    if (rect.left + rect.width > windowWidth) {
      menu.style.left = `${-1 * rect.width + 15}px`;
      menu.style.right = 'auto';
    } else if (rect.left + rect.width * 2 < windowWidth) {
      // If there's space on the left and not right-aligned, align to left edge
      // Note: For user menu dropdown, we keep right alignment, so this might not apply
      // But keeping the logic to match AngularJS
      menu.style.left = '0';
      menu.style.right = 'auto';
    }
  };

  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  return (
    <div
      ref={dropdownRef}
      onClick={toggleDropdown}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        paddingRight: '10px',
        cursor: 'pointer',
        marginLeft: '16px',
        verticalAlign: 'middle',
      }}
    >
      <UserProfileImage
        width="24"
        height="24"
        userId={userId}
        imgUrl={profileImageUrl}
        fullName={fullName}
        profileType={profileType}
        profileVersion={profileVersion}
        className="profilePictureHeader"
        style={{ marginRight: '5px', verticalAlign: 'middle' }}
      />
      
      <span 
        className={`dropdown cnv-custom-dropdown user-menu-dropdown-widget ${isOpen ? 'open' : ''}`}
        style={{
          position: 'relative',
          display: 'inline-block',
          verticalAlign: 'middle',
          top: '3px',
        }}
      >
        <a 
          className="dropdown-toggle" 
          href="javascript:void(0)"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleDropdown(e);
          }}
          style={{ 
            cursor: 'pointer',
            textDecoration: 'none',
            display: 'inline-block',
            background: 'none',
            border: 'none',
            padding: 0,
            margin: 0,
          }}
        >
          {/* Match AngularJS icon: <i class="cnv-icons-16 icons_Dropdown_incircle-lightgray"></i> */}
          <i className="cnv-icons-16 icons_Dropdown_incircle-lightgray" style={{ verticalAlign: 'middle' }} />
        </a>
        <ul 
          ref={menuRef}
          className="dropdown-menu dropdown-main-menu"
          style={{
            position: 'absolute',
            top: '20px',
            right: '0',
            left: 'auto',
            display: isOpen ? 'block' : 'none',
            minWidth: '200px',
            maxWidth: '206px',
            backgroundColor: '#fff',
            border: '1px solid #d4d5d7',
            borderRadius: '4px',
            boxShadow: '0 6px 10px -4px rgba(0, 0, 0, 0.4)',
            zIndex: 1000,
            padding: '4px 0',
            margin: 0,
            listStyle: 'none',
            textAlign: 'left',
          }}
        >
          {menuOptions.map((option, index) => {
            if (option.isDivider) {
              return (
                <li key={`divider-${index}`} className="divider" style={{
                  height: '1px',
                  margin: '4px 0',
                  overflow: 'hidden',
                  backgroundColor: '#e0e0e0',
                }}></li>
              );
            }

            return (
              <li 
                key={`option-${index}`}
                style={{
                  margin: 0,
                  padding: 0,
                }}
              >
                <a
                  href="javascript:void(0)"
                  className="menu-item-wrapper"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    option.callback();
                  }}
                  style={{
                    display: 'block',
                    padding: '8px 16px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontFamily: "'Source Sans Pro', sans-serif",
                    color: '#2b2b2b',
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                    background: 'none',
                    lineHeight: '1.4',
                    textAlign: 'left',
                  }}
                >
                  {option.subtext ? (
                    <>
                      <span style={{ display: 'block' }}>{option.label}</span>
                      <span className="subtext" style={{
                        fontSize: '12px',
                        color: '#7b8386',
                        display: 'block',
                        marginTop: '2px',
                      }}>{option.subtext}</span>
                    </>
                  ) : (
                    <span>{option.label}</span>
                  )}
                </a>
              </li>
            );
          })}
        </ul>
      </span>
    </div>
  );
}

