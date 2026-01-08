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
          /* Ensure the settings view uses its own stable scroll container.
             This prevents the window scrollbar from disappearing after UI overlays (e.g. autocomplete). */
          height: 100vh;
          box-sizing: border-box;
          overflow: hidden;
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
          height: calc(100vh - 60px);
          scrollbar-gutter: stable;
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
        /* Basic button system (legacy Convo / Bootstrap-like) */
        .settings-container .btn {
          display: inline-block;
          padding: 6px 12px;
          margin-bottom: 0;
          font-size: 14px;
          font-weight: normal;
          line-height: 1.42857143;
          text-align: center;
          white-space: nowrap;
          vertical-align: middle;
          touch-action: manipulation;
          cursor: pointer;
          user-select: none;
          background-image: none;
          border: 1px solid transparent;
          border-radius: 3px;
          font-family: 'Source Sans Pro', sans-serif;
        }
        .settings-container .btn:focus {
          outline: none;
        }
        .settings-container .btn-xs {
          padding: 2px 10px;
          font-size: 12px;
          line-height: 1.5;
          border-radius: 2px;
        }
        .settings-container .btn-default {
          color: var(--btn-default-color);
          background-color: var(--btn-default-bg);
          border-color: var(--btn-default-border);
        }
        .settings-container .btn-default:hover,
        .settings-container .btn-default:active,
        .settings-container .btn-default:focus {
          background: transparent;
          color: var(--cnv-blue-dark);
          border-color: var(--cnv-blue-dark);
        }
        .settings-container .btn-default-transparent-font {
          color: transparent;
          background-color: #ffffff;
          border-color: var(--cnv-blue-dark);
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
        /* Bootstrap-ish groups / dropdowns used by Notifications */
        .settings-container .btn-group {
          position: relative;
          display: inline-block;
          vertical-align: middle;
        }
        .settings-container .btn-group > .btn {
          position: relative;
          float: left;
        }
        .settings-container .btn-group > .btn:first-child {
          margin-left: 0;
        }
        .settings-container .btn-group > .btn:not(:first-child):not(:last-child) {
          border-radius: 0;
        }
        .settings-container .btn-group > .btn:first-child:not(:last-child) {
          border-top-right-radius: 0;
          border-bottom-right-radius: 0;
        }
        .settings-container .btn-group > .btn:last-child:not(:first-child) {
          border-top-left-radius: 0;
          border-bottom-left-radius: 0;
        }
        .settings-container .btn-group.btn-toggle .btn {
          border-color: var(--cnv-blue-dark);
          background: #fff;
          color: var(--cnv-blue-dark);
        }
        .settings-container .btn-group.btn-toggle {
          vertical-align: middle;
        }
        .settings-container .btn-group.btn-toggle .btn {
          float: none;
          padding: 2px 10px;
          font-size: 12px;
          line-height: 1.5;
          border-radius: 2px;
        }
        .settings-container .btn-group.btn-toggle .btn.btn-primary {
          background: var(--cnv-blue);
          color: #fff;
          border: 1px solid var(--cnv-blue-dark);
        }
        .settings-container .dropdown-menu {
          position: absolute;
          top: 100%;
          left: 0;
          z-index: 1000;
          float: left;
          min-width: 160px;
          padding: 5px 0;
          margin: 2px 0 0;
          font-size: 14px;
          text-align: left;
          list-style: none;
          background-color: #fff;
          border: 1px solid rgba(0, 0, 0, 0.15);
          border-radius: 4px;
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.175);
          background-clip: padding-box;
        }
        .settings-container .dropdown-menu > li > a {
          display: block;
          padding: 3px 20px;
          clear: both;
          font-weight: normal;
          line-height: 1.42857143;
          color: #333;
          white-space: nowrap;
          text-decoration: none;
        }
        .settings-container .dropdown-menu > li > a:hover {
          background-color: #f5f5f5;
          color: #262626;
        }
        .settings-container .caret {
          display: inline-block;
          width: 0;
          height: 0;
          margin-left: 2px;
          vertical-align: middle;
          border-top: 4px dashed;
          border-right: 4px solid transparent;
          border-left: 4px solid transparent;
        }

        /* Inline spacing helpers used by Notifications */
        .settings-container .dash {
          display: inline-block;
          color: #7b8386;
          width: 20px;
          text-align: center;
        }
        .settings-container .cbkCustomizeSettings {
          margin-left: 100px;
          display: inline;
        }
        .settings-container .rowDarkBckColor {
          background-color: #f5f7fc;
        }
        .settings-container .gray-row {
          background-color: #f0f0f0 !important;
        }
        .settings-container .smartNoti.disabled,
        .settings-container .radioBtnBar.disabled {
          opacity: 0.6;
          pointer-events: none;
        }

        /* Legacy Convo checkbox skinning (from app.less) */
        .settings-container .cnv-checkbox {
          display: none;
          outline: none !important;
        }
        .settings-container .cnv-checkbox:focus + label {
          border-color: var(--cnv-blue);
        }
        .settings-container .cnv-checkbox + label {
          border-radius: 3px;
          background: #ffffff;
          border: 1px solid #a0a0a0;
          color: #ffffff;
          padding: 9px;
          display: inline-block;
          position: relative;
          margin-bottom: -5px;
          font-weight: normal;
          box-sizing: border-box;
        }
        .settings-container .cnv-checkbox:checked + label:after {
          content: '✓';
          font-family: 'Source Sans Pro', sans-serif;
          font-size: 16px;
          position: absolute;
          background: var(--cnv-blue);
          top: 0px;
          text-align: center;
          left: 0px;
          color: #ffffff;
          line-height: 12px;
          width: 100%;
          padding: 3px 1px 3px 1px;
          border-radius: 2px;
        }
        .settings-container .cnv-checkbox:disabled + label:after {
          background: var(--cnv-light-blue-disabled-control);
        }

        /* Legacy Convo radio skinning (from settings/styles.less) */
        .settings-container .cnv-radioButton {
          display: none;
        }
        .settings-container .radioBtnBar label {
          position: relative;
          margin: 0;
          margin-left: 50px;
          font-weight: normal;
        }
        .settings-container .radioBtnBar label:before {
          content: '';
          display: inline-block;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          margin-right: 10px;
          position: absolute;
          left: -18px;
          bottom: 1px;
          background-color: #ffffff;
          border: solid 2px var(--cnv-blue);
        }
        .settings-container .cnv-radioButton:checked + label:before {
          content: '•';
          color: var(--cnv-blue-dark);
          font-size: 26px;
          text-align: center;
          line-height: 8px;
        }

        /* Hover-only remove button for Manage Subscriptions (legacy uses hover state) */
        .settings-container .unsubscribe-button {
          display: none;
          background: transparent;
          border: 0;
          color: var(--cnv-blue-dark);
          cursor: pointer;
          padding: 0;
          font-size: 14px;
        }
        .settings-container .unsubscribe-button:hover {
          text-decoration: underline;
        }
        .settings-container .subscription-row:hover .unsubscribe-button {
          display: inline;
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

