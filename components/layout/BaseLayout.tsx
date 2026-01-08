'use client';

/**
 * Base Layout Component
 * 
 * Configurable base layout for all pages with header and optional sidebar.
 * Supports different layout variants: with sidebar, without sidebar, full width.
 */

import { ReactNode } from 'react';
import MainHeader from './MainHeader';
import LeftSidebar from './LeftSidebar';
import RightSidebar from './RightSidebar';
import './shared-layout.css';
import './left-panel.css';

export interface BaseLayoutProps {
  children: ReactNode;
  variant?: 'with-sidebar' | 'without-sidebar' | 'full-width';
  containerClassName?: string;
  bodyClassName?: string;
  centerPanelClassName?: string;
}

export default function BaseLayout({
  children,
  variant = 'with-sidebar',
  containerClassName = '',
  bodyClassName = '',
  centerPanelClassName = '',
}: BaseLayoutProps) {
  const getContainerClasses = () => {
    const baseClasses = 'home-container';
    const variantClasses = variant === 'with-sidebar' ? 'home-container-feed' : '';
    return `${baseClasses} ${variantClasses} ${containerClassName}`.trim();
  };

  const getBodyClasses = () => {
    const baseClasses = 'home-body';
    const variantClasses = variant === 'with-sidebar' ? 'home-body-feed' : '';
    return `${baseClasses} ${variantClasses} ${bodyClassName}`.trim();
  };

  const getCenterPanelClasses = () => {
    const baseClasses = 'center-panel-container';
    const variantClasses = variant === 'with-sidebar' ? 'center-panel-feed' : '';
    return `${baseClasses} ${variantClasses} ${centerPanelClassName}`.trim();
  };

  return (
    <div className={getContainerClasses()}>
      <MainHeader />

      <div className={getBodyClasses()}>
        {variant === 'with-sidebar' && (
          <div className="left-panel-container">
            <LeftSidebar />
          </div>
        )}

        {variant === 'with-sidebar' ? (
          <div id="feedScroller" className="feed-scroller">
            <div id="feedContentBody" className={getCenterPanelClasses()}>
              <div id="home-center-panel" className="home-center-panel">
                {children}
              </div>
            </div>

            <div id="home-right-panel" className="right-panel-container">
              <RightSidebar />
            </div>
          </div>
        ) : (
          <div className={getCenterPanelClasses()}>{children}</div>
        )}
      </div>
    </div>
  );
}

