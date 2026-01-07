'use client';

/**
 * Groups Directory Layout
 * 
 * Layout wrapper for groups directory page including header
 * Matches AngularJS layout structure
 */

import BaseLayout from '@/components/layout/BaseLayout';
import './layout.css';

interface GroupsLayoutProps {
  children: React.ReactNode;
}

export default function GroupsLayout({ children }: GroupsLayoutProps) {
  return (
    <BaseLayout 
      variant="without-sidebar"
      centerPanelClassName="groups-directory-wrapper"
    >
      {children}
    </BaseLayout>
  );
}

