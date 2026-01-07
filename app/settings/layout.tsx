'use client';

import MainHeader from '@/components/layout/MainHeader';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="home-container" style={{
      height: '100%',
      maxWidth: '1440px',
      minWidth: '690px',
      margin: '0 auto',
    }}>
      {/* Main Header - Same structure as home layout */}
      <MainHeader />

      {/* Settings Container - matches AngularJS structure */}
      {/* The settings-container has padding-top: 60px to account for fixed header */}
      {children}

      <style jsx global>{`
        /* Settings Container Styles - Exact match from AngularJS styles.less */
        /* Settings Container - Exact match from AngularJS */
        .settings-container {
          padding-top: 60px;
          max-width: 1440px;
          background: white;
          margin: 0 auto;
          min-width: 1160px;
          height: auto;
          min-height: 100%;
        }
        .settings-container .left-panel-container {
          padding: 0;
        }
        .settings-container .left-panel-container .wrapper-parent {
          position: fixed;
          width: 235px;
          top: 60px;
          bottom: 0;
          z-index: 1;
        }
        .settings-container .left-panel-container .left-panel-wrapper {
          background: #1e2e3d;
          width: 235px;
          height: 100%;
          overflow-y: hidden;
          overflow-x: hidden;
          z-index: 1;
        }
        .settings-container .left-panel-container .menu-items-container {
          margin-bottom: 14px !important;
          padding: 0 15px 0 30px;
        }
        .settings-container .left-panel-container .menu-items-container ul {
          list-style: none;
          margin: 0;
          padding: 0;
        }
        .settings-container .left-panel-container .menu-items-container ul li {
          margin-top: 12px;
          position: relative;
        }
        .settings-container .left-panel-container .menu-items-container ul li a {
          margin-left: 15px;
          color: #e0e0e0;
          text-decoration: none;
        }
        .settings-container .left-panel-container .menu-items-container ul li a:hover {
          color: #fff;
        }
        .settings-container .left-panel-container .menu-items-container ul .active {
          color: #ffffff;
          font-weight: bold;
        }
        .settings-container .left-panel-container .groupsItemsContainer {
          background: #1e2e3d;
        }
        .settings-container .left-panel-container .groupsItemsContainer .heading {
          color: #e0e0e0;
          padding: 5px 0px 5px 30px;
        }
        .settings-container .left-panel-container .upgrade-banner {
          padding: 10px;
          background: rgba(64, 64, 64, 0.98);
          color: white;
          margin: 0 9px;
          text-align: center;
        }
        .settings-container .left-panel-container .upgrade-banner button {
          margin-top: 11px;
        }
        .settings-container .left-panel-container .background-div {
          width: 235px;
          background: #1e2e3d;
          position: fixed;
          top: 60px;
          bottom: 0;
          z-index: -1;
        }
        .settings-container .view-content {
          padding-left: 235px;
          min-width: 1200px;
          overflow-x: hidden;
          overflow-y: auto;
          height: 100%;
        }
        .settings-container .view-content > div:not(.cnv-advanced-search) {
          max-width: 1205px;
          box-sizing: border-box;
        }
        .settings-container .view-content .header {
          margin-top: 20px;
          font-weight: bold;
          margin-bottom: 20px;
          font-size: 18px;
          color: #2b2b2b;
        }
        .settings-container .view-content .subHeader {
          margin-top: 20px;
          font-weight: bold;
          color: #7b8386;
        }
        .settings-container .meta {
          font-size: 14px;
          color: #7b8386;
          line-height: 1.6;
        }
        .settings-container .settings-custom {
          margin-left: 20px;
          height: 40px;
          border-radius: 3px;
          outline: none;
          border: 1px solid #e2e8ed;
          width: 250px;
          display: inline-block;
          outline: none !important;
          resize: none !important;
          box-shadow: none;
          word-break: normal;
          padding: 8px;
          font-size: 14px;
          font-family: 'Source Sans Pro', sans-serif;
        }
        .settings-container .settings-custom:disabled {
          background-color: #f5f5f5;
          cursor: not-allowed;
        }
        .settings-container .btn-primary {
          padding: 8px 16px;
          background-color: #4183d7;
          color: #fff;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-family: 'Source Sans Pro', sans-serif;
        }
        .settings-container .btn-primary:disabled {
          background-color: #ccc;
          cursor: not-allowed;
        }
        .settings-container .btn-primary:hover:not(:disabled) {
          background-color: #357abd;
        }
        .settings-container .cnv-checkbox {
          margin-right: 8px;
        }
        .settings-container .cnv-list-style.fulfilled {
          color: #28a745;
        }
        .settings-container .cnv-list-style.not-fulfilled {
          color: #dc3545;
        }
        .settings-container a {
          color: #4183d7;
          text-decoration: none;
        }
        .settings-container a:hover {
          text-decoration: underline;
        }
        .settings-container hr {
          border: none;
          border-top: 1px solid #e0e0e0;
          margin: 10px 0;
        }
        .settings-container #password-policy-constraints ul {
          list-style: none;
          padding: 0;
          margin-top: 10px;
        }
        .settings-container #password-policy-constraints ul li {
          padding: 5px 0;
        }

        /* Tags Input Styles - Exact match from AngularJS */
        .to-field-cont {
          display: inline-block;
          width: 450px;
          max-width: 450px;
          vertical-align: middle;
          box-sizing: border-box;
        }
        .to-field-cont .tags {
          margin: 4px 0px;
          border: 1px solid #e2e8ed;
          border-radius: 6px;
          padding: 0px 0px 0px 5px;
        }
        .to-field-cont input[type="text"],
        .to-field-cont textarea {
          height: 19px;
          margin-left: 0px;
          width: 1px;
        }
        .to-field-cont .host > div {
          height: 40px;
        }

        /* Anchor Disabled Style */
        .anchorDisabled {
          pointer-events: none;
          color: #7b8386;
        }
      `}</style>
    </div>
  );
}

