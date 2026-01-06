'use client';

/**
 * Main Header Panel
 * 
 * Migrated from AngularJS cnv-main-header-panel directive
 * Exact UI match with AngularJS version
 */

import { useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/auth-store';
import UserMenuDropdown from './UserMenuDropdown';

export default function MainHeader() {
  const account = useAuthStore((state) => state.account);
  const [searchText, setSearchText] = useState('');

  const accountName = (account as any)?.account_name || (account as any)?.account_key || 'Convo';
  const displayName = accountName.length > 20 ? accountName.substring(0, 20) : accountName;

  return (
    <div className="header-bar-container">
      <div className="header-content-wrapper">
        {/* Network logo + network menu options dropdown */}
        <div className="col-xs-2 col-sm-1 col-md-5 col-lg-5 no-padding">
          <div className="network-logo-wrapper">
            <div className="network-logo-container" style={{
              height: '60px',
              lineHeight: '55px',
              paddingLeft: '8px',
              display: 'inline-block',
              overflow: 'hidden',
            }}>
              <Link href="/feed" className="network-logo-link" style={{ textDecoration: 'none' }}>
                {/* Network logo image - will be loaded from account data */}
                <img 
                  className="logo" 
                  src={(account as any)?.network_logo_url || '/assets/img/common/convo-logo.png'} 
                  alt={accountName}
                  style={{
                    width: '40px',
                    maxHeight: '40px',
                    borderRadius: '3px',
                    verticalAlign: 'middle',
                  }}
                />
              </Link>
              <Link 
                href="/feed" 
                className="name"
                style={{
                  marginLeft: '10px',
                  marginRight: '20px',
                  color: '#fff',
                  fontSize: '18px',
                  verticalAlign: 'middle',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  maxWidth: '104px',
                  display: 'inline-block',
                  overflow: 'hidden',
                  textDecoration: 'none',
                }}
              >
                {displayName}
              </Link>
            </div>
            {/* Network dropdown - placeholder for now */}
            <div className="hidden-xs header-dropdown" style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
            }}>
              <span className="dropdown cnv-custom-dropdown">
                <a className="dropdown-toggle" style={{ cursor: 'pointer' }}>
                  <i className="cnv-icons-20 icons_Dropdown_incircle-cccecf"></i>
                </a>
              </span>
            </div>
          </div>
        </div>

        {/* Search bar */}
        <div className="col-xs-22 col-sm-23 col-md-19 col-lg-14 no-padding" style={{ position: 'static' }}>
          <div className="top-search-wrapper">
            <div id="feed_search_bar" style={{
              margin: '9px auto 0 auto',
              maxWidth: '576px',
              position: 'relative',
            }}>
              <form onSubmit={(e) => { e.preventDefault(); /* Handle search */ }}>
                <input
                  id="feed_search_input"
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search"
                  spellCheck={false}
                  autoComplete="off"
                  style={{
                    padding: '9px',
                    height: '38px',
                    width: 'calc(100% - 57px)',
                    display: 'inline-block',
                    borderRadius: '4px',
                    borderTopRightRadius: '0px',
                    borderBottomRightRadius: '0px',
                    border: '1px solid #cacedb',
                    outline: 'none',
                    fontSize: '14px',
                    fontFamily: "'Source Sans Pro', sans-serif",
                    position: 'static',
                  }}
                />
                <div className="dropdown-ico-wrapper" style={{
                  position: 'absolute',
                  right: '73px',
                  top: '12px',
                  width: '15px',
                  height: '15px',
                  cursor: 'pointer',
                }}>
                  <i className="cnv-icons-14 icons2_Dropdown-lightgray"></i>
                </div>
                <div className="search-icon" style={{
                  border: '1px solid #cacedb',
                  width: '57px',
                  display: 'inline-block',
                  position: 'absolute',
                  height: '38px',
                  borderLeft: 0,
                  textAlign: 'center',
                  borderTopRightRadius: '4px',
                  borderBottomRightRadius: '4px',
                  cursor: 'pointer',
                  paddingTop: '7px',
                  background: '#fff',
                  right: 0,
                  top: 0,
                }}>
                  <i className="cnv-icons-15 find-lightgray" style={{
                    verticalAlign: 'middle',
                    color: '#c8c7c7',
                    top: '7px',
                  }}></i>
                </div>
              </form>
            </div>
          </div>

          {/* Right User Panel */}
          <div className="right-column">
            {/* Premium Upgrade Button - placeholder */}
            {/* <cnv-premium-upgrade-btn></cnv-premium-upgrade-btn> */}
            
            {/* Notifications Dropdown */}
            <div className="cnv-notif-container dark-bell-icon" style={{
              display: 'inline-flex',
              alignItems: 'center',
              marginRight: '16px',
              cursor: 'pointer',
              verticalAlign: 'middle',
            }}>
              <div className="bell-wrapper">
                <span className="bell-hit-area">
                  <i className="cnv-icons-16 icons_Notifications-lightgray"></i>
                </span>
              </div>
            </div>

            <span className="separator" style={{ verticalAlign: 'middle' }}></span>

            {/* User Profile Menu Dropdown */}
            <UserMenuDropdown />
          </div>
        </div>

        {/* Spacer for large screens */}
        <div className="visible-lg col-lg-5"></div>
      </div>
    </div>
  );
}

