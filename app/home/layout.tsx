'use client';

/**
 * Home Layout
 * 
 * Layout wrapper for the home page including header and left sidebar
 */

import MainHeader from '@/components/layout/MainHeader';
import LeftSidebar from '@/components/layout/LeftSidebar';
import RightSidebar from '@/components/layout/RightSidebar';

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="home-container">
      {/* Main Header */}
      <MainHeader />

      {/* Home Body */}
      <div className="home-body" style={{
        position: 'relative',
        top: '60px',
        maxWidth: '1440px',
        margin: '0 auto !important',
        background: '#fff',
        height: 'calc(100vh - 60px)',
        whiteSpace: 'nowrap',
        display: 'flex',
      }}>
        {/* Left Panel Container */}
        <div className="left-panel-container" style={{
          padding: 0,
          minHeight: '2px',
          width: '235px',
          flexShrink: 0,
          position: 'relative',
          zIndex: 2,
        }}>
          <LeftSidebar />
        </div>

        {/* Feed Scroller Container - matches AngularJS #feedScroller */}
        <div id="feedScroller" style={{
          height: '100%',
          overflowX: 'hidden',
          overflowY: 'scroll',
          flex: '1',
          position: 'relative',
          minWidth: 0, // Prevents flex item from overflowing
          marginLeft: 0, // Ensure it starts right after left panel
        }}>
          {/* Center Panel - Feed Content */}
          <div id="feedContentBody" className="center-panel-container" style={{
            textAlign: 'center',
            paddingRight: '300px', // Make room for right panel
          }}>
            <div id="home-center-panel" style={{
              width: '572px',
              margin: '0 auto',
              textAlign: 'left',
        }}>
          {children}
            </div>
          </div>

          {/* Right Panel Container - matches AngularJS #home-right-panel */}
          <div id="home-right-panel" className="right-panel-container" style={{
            width: '300px',
            position: 'absolute',
            right: '0px',
            top: '0px',
            zIndex: 1,
            visibility: 'visible',
            height: '100%',
          }}>
            <RightSidebar />
          </div>
        </div>
      </div>

      <style jsx global>{`
        /* Header Styles - Exact match from AngularJS index.php */
        .header-bar-container {
          position: fixed;
          width: 100%;
          left: 0;
          -webkit-box-sizing: border-box;
          box-sizing: border-box;
          min-width: 690px;
          z-index: 102;
          height: 60px;
        }
        .header-bar-container > .header-content-wrapper {
          max-width: 1440px;
          margin: 0 auto;
          position: relative;
        }
        .header-bar-container > .header-content-wrapper > div {
          height: 60px;
          position: relative;
          background: #f5f7fc;
        }
        .home-view .header-bar-container > .header-content-wrapper > div {
          background: #f2f4f8;
        }
        .header-bar-container > .header-content-wrapper .network-logo-wrapper {
          max-width: 235px;
          background: #1b2634;
          height: 60px;
          border-bottom: 1px solid #1b2634;
          position: relative;
        }
        .header-bar-container > .header-content-wrapper .network-logo-container {
          display: table;
          height: 60px;
          padding-left: 15px;
        }
        .header-bar-container > .header-content-wrapper .network-logo-container .logo {
          max-width: 150px;
          max-height: 56px;
          display: inline-block;
          vertical-align: middle;
        }
        .header-bar-container > .header-content-wrapper .network-logo-container .name {
          display: inline-block;
          vertical-align: middle;
          margin-left: 10px;
        }
        .header-bar-container > .header-content-wrapper .top-search-wrapper {
          max-width: 576px;
          position: relative;
          width: 100%;
          margin: 0 auto;
          padding: 0 1px 0 3px;
        }
        .header-bar-container .right-column {
          position: absolute;
          top: 0;
          right: 0;
          height: 60px;
          padding: 0 15px 0 0;
          text-align: right;
          line-height: 60px;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: flex-end;
        }
        .header-bar-container .separator {
          width: 1px;
          border: 0;
          display: inline-block;
          background-color: #e0e0e0;
          height: 31px;
          margin: 0px 2px 0px 15px;
          vertical-align: middle;
          align-self: center;
        }

        /* Left Panel Styles - Exact match from AngularJS index.php */
        .home-container .left-panel-container .wrapper-parent {
          position: fixed;
          width: 235px;
          top: 60px;
          bottom: 0;
          z-index: 3;
          overflow: hidden;
        }
        .home-container .left-panel-container .left-panel-wrapper-full {
          background: #1e2e3d;
          height: 100%;
          overflow-y: auto;
          overflow-x: hidden;
          z-index: 1;
          margin-right: -30px;
          padding-right: 30px;
        }
        .home-container .left-panel-container .left-panel-wrapper-full::-webkit-scrollbar {
          display: none;
        }
        .home-container .left-panel-container .menu-items-container {
          margin-bottom: 14px !important;
          padding: 0 15px 0 30px;
          margin-left: -10px !important;
        }
        .home-container .left-panel-container .menu-items-container ul {
          list-style: none;
          margin: 0;
          padding: 0;
        }
        .home-container .left-panel-container .menu-items-container ul li {
          margin-top: 12px;
          position: relative;
        }
        .home-container .left-panel-container .menu-items-container ul li i {
          margin-right: 5px;
          float: left;
          display: block;
          margin-top: 0px;
          cursor: pointer;
        }
        .home-container .left-panel-container .menu-items-container ul li a {
          margin-left: 15px;
          color: #e0e0e0;
        }
        .home-container .left-panel-container .menu-items-container ul li a:hover {
          color: #fff;
          text-decoration: none;
        }
        .home-container .left-panel-container .menu-items-container ul .active {
          color: #ffffff;
          font-weight: bold;
        }
        .home-container .left-panel-container .groupsItemsContainer {
          margin-top: 20px !important;
          position: static;
        }
        .home-container .left-panel-container .groupsItemsContainer .heading {
          border-top: 1px solid #36404c;
          line-height: 28px;
          padding-top: 5px;
        }
        .home-container .left-panel-container .groupsItemsContainer .heading span {
          color: #e0e0e0;
          margin-left: 20px;
          text-transform: uppercase;
        }
        .home-container .left-panel-container .groupsItemsContainer .heading i {
          position: relative;
          top: 4px;
          float: right;
          right: 15px;
          cursor: pointer;
        }
        .home-container .left-panel-container .groupsItemsContainer > ul {
          list-style: none;
          margin: 0;
          padding: 0;
          position: static;
        }
        .home-container .left-panel-container .groupsItemsContainer > ul .section-heading {
          text-transform: uppercase;
          color: #4b738e;
          font-size: 12px;
          margin-top: 15px;
          cursor: pointer;
        }
        .home-container .left-panel-container .groupsItemsContainer > ul > li {
          margin-top: 5px;
          position: static;
          min-height: 28px;
          padding: 0px 15px 0px 30px;
        }
        .home-container .left-panel-container .groupsItemsContainer > ul > li .pull-left {
          position: relative;
          max-width: 165px;
        }
        .home-container .left-panel-container .groupsItemsContainer > ul > li .pull-left i {
          margin-right: 5px;
          float: left;
          display: block;
          margin-top: 0px;
          cursor: pointer;
        }
        .home-container .left-panel-container .groupsItemsContainer > ul > li .pull-left > a {
          margin-left: 10px;
          display: inline-block;
          width: 120px;
          color: #c0c6d5;
          text-decoration: none;
        }
        .home-container .left-panel-container .groupsItemsContainer > ul > li .pull-left > a:hover {
          color: #ffffff;
          text-decoration: none;
        }
        .home-container .left-panel-container .groupsItemsContainer > ul .active {
          color: #ffffff;
          font-weight: bold;
        }
        .home-container .left-panel-container .groupsItemsContainer > ul .group-intro-item {
          display: inline-block;
          width: 100%;
          text-align: left;
        }
        .home-container .left-panel-container .groupsItemsContainer > ul .group-intro-item > span {
          display: block;
          color: #e0e0e0;
          cursor: pointer;
          font-size: 12px;
        }
        .home-container .left-panel-container .groupsItemsContainer > ul .no-group-available {
          color: #e0e0e0;
        }
        .home-container .left-panel-container .groupsControlsContainer {
          margin: 20px 0px 35px 0px !important;
        }
        .home-container .left-panel-container .groupsControlsContainer span {
          display: block;
          margin-left: 20px;
        }
        .home-container .left-panel-container .groupsControlsContainer span a {
          text-transform: uppercase;
          font-size: 14px;
          color: #e0e0e0;
          text-decoration: none;
        }
        .home-container .left-panel-container .groupsControlsContainer .directory-icon {
          display: inline-block;
          text-align: center;
          width: 40px;
          margin-left: 20px;
          margin-top: 20px;
        }
        .home-container .left-panel-container .groupsControlsContainer .help-text {
          display: inline-block;
          color: #c0c6d5;
          width: 148px;
          position: relative;
          top: -7px;
          vertical-align: middle;
          text-decoration: none;
        }
        .home-container .left-panel-container .groupsControlsContainer .help-text:hover {
          color: #fff;
        }
        .home-container .left-panel-container .whatsnew {
          border-top: 1px solid #36404c;
          margin-bottom: -5px !important;
        }
        .home-container .left-panel-container .background-div {
          width: 235px;
          background: #1e2e3d;
          position: fixed;
          top: 60px;
          bottom: 0;
          z-index: -1;
        }

        /* Responsive - Slim left panel for mobile */
        @media (min-width: 0) and (max-width: 969px) {
          .home-container .left-panel-container .wrapper-parent {
            width: 70px;
            overflow: visible;
          }
        }

        /* Feed Styles - Exact match from AngularJS feed.less and feedMain.less */
        .feed-item-container {
          padding: 0px;
          position: relative;
          margin: 15px 0 15px 0;
        }
        .feed-item-container a {
          text-decoration: none;
        }
        .feed-item-container a:hover {
          text-decoration: underline;
        }
        .feed-item-container > .dp-container {
          float: left;
          width: 60px;
          height: 60px;
          position: relative;
          display: block;
          font-size: 15px;
        }
        .feed-item-container > .dp-container > .dp-wrapper {
          position: absolute;
          background-size: contain;
          border-radius: 50%;
        }
        .feed-item-container > .dp-container > .created-by {
          top: 0;
          left: 0;
          position: absolute;
          height: 60px !important;
          width: 60px !important;
        }
        .feed-item-container > .dp-container > .edited-by {
          bottom: -3px;
          right: -5px;
          position: absolute;
          height: 35px !important;
          width: 35px !important;
        }
        .feed-item-container > .dp-container.edited .dp-wrapper.edited-by {
          display: block;
        }
        .feed-divider {
          margin-top: 0px;
          margin-bottom: 0px;
          border-top: 1px solid #e2e5ea;
          border-bottom: none;
          border-left: none;
          border-right: none;
          width: 100%;
          display: block;
        }
        #feedScroller {
          height: 100%;
          overflow-x: hidden;
          overflow-y: scroll;
        }
        .center-panel-container {
          text-align: center;
        }
        #home-center-panel {
          width: 572px;
          margin: 0 auto;
          text-align: left;
        }
        #feedContentBody {
          text-align: center;
        }
        .feed {
          display: inline-block;
          width: 572px;
          text-align: left;
          margin-top: 0px;
        }
        .feed-item-content-right {
          width: 100%;
          float: left;
          margin-left: 12px;
        }
        .feed-item-container .feed-item-content-right {
          width: 495px;
        }
        .feed-item-content-right > .shared-with-container {
          margin-top: -3px;
          margin-bottom: 5px;
          margin-right: 18px;
          line-height: 15px;
          color: #339fb8;
          word-break: break-all;
        }
        .feed-item-content-right > .shared-with-container .grey-txt {
          color: #959595;
        }
        .feed-item-content-right > .shared-with-container ul {
          display: inline-flex;
          flex-flow: row nowrap;
          padding: 0px 2px 1px 2px;
          margin: 0px 0px 0px -2px;
          border-radius: 2px;
          list-style-type: none;
        }
        .feed-item-content-right > .shared-with-container ul li {
          margin-right: 2px;
        }
        .feed-item-content-right > .shared-with-container ul li.nobullet:after {
          content: none;
        }
        .feed-item-content-right > .shared-with-container .dot {
          margin-left: 0px;
          font-size: 20px;
          color: #7b8386;
        }
        .feed-item-content-right > .feed-info-container {
          clear: left;
          margin-top: 0px;
          font-size: 13px;
        }
        .feed-item-content-right > .feed-info-container ul {
          padding-left: 0px;
          margin: 0px;
          list-style: none;
        }
        .feed-item-content-right > .feed-info-container ul li {
          display: inline;
        }
        .feed-item-content-right > .feed-info-container ul .dot {
          color: #7b8386;
          font-size: 20px;
        }
        .feed-item-content-right > .feed-info-container a {
          cursor: pointer;
          color: #7b8386;
          text-decoration: none;
        }
        .feed-item-content-right > .feed-info-container a:hover,
        .feed-item-content-right > .feed-info-container a:active,
        .feed-item-content-right > .feed-info-container a:focus {
          color: #339fb8;
        }
        .note .note-details {
          word-wrap: break-word;
          position: relative;
          padding-right: 20px;
        }
        .note .note-details p {
          margin-top: 0;
          margin-bottom: 0 !important;
        }
        .note .title-text {
          display: block;
          padding-bottom: 3px;
          vertical-align: top;
          word-wrap: break-word;
        }
        .note .title-text a {
          color: #339fb8;
          font-weight: bold;
          text-decoration: none;
        }
        .note .title-text a:hover,
        .note .title-text a:active,
        .note .title-text a:focus {
          color: #4183d7;
        }
        .comments-panel-wrapper {
          margin-top: 5px;
          margin-bottom: 7px;
          position: relative;
          background: #f2f4f8;
          border-radius: 3px;
          padding: 0px;
        }
        .comments-panel-wrapper .likes-count-container {
          border-bottom: 1px solid #e2e5ea;
          border-top: 1px solid transparent;
          padding: 9px 10px;
          margin: 0px 10px;
        }
        .comments-panel-wrapper .likes-count-container a:first-of-type {
          margin-left: 10px;
        }
        .comments-panel-wrapper .likes-count-container span {
          color: #7b8386;
          position: relative;
          left: -2px;
        }
        .comments-panel-wrapper .likes-count-container > i {
          vertical-align: bottom;
          position: relative;
          top: -2px;
        }
        .comments-panel-wrapper .comments_info {
          padding: 9px 10px 0px 10px;
          margin: 0px 10px;
          position: relative;
        }
        .comments-panel-wrapper .comments_info > i {
          vertical-align: middle;
        }
        .comments-panel-wrapper .comments_info a {
          margin-left: 10px;
          color: #339fb8;
          text-decoration: none;
          cursor: pointer;
        }
        .comments-panel-wrapper .comments_info a:focus,
        .comments-panel-wrapper .comments_info a:hover,
        .comments-panel-wrapper .comments_info a:active {
          color: #339fb8;
        }
        .comments-panel-wrapper .comments_info span {
          color: #7b8386;
        }
        .comments-panel-wrapper .comments-collection {
          position: relative;
          max-height: 435px;
          overflow-y: hidden;
          overflow-x: hidden;
          padding: 0px 10px;
          margin-right: 2px;
        }
        .comments-panel-wrapper .comments-collection.expanded {
          overflow-y: auto;
          max-height: 435px;
        }
        .comments-panel-wrapper .comments-collection::-webkit-scrollbar-track {
          background: #f2f4f8 !important;
        }
        .comments-panel-wrapper .comments-collection::-webkit-scrollbar-thumb {
          background-color: #ccc !important;
        }
        .comments-panel-wrapper .feed-comment-editor {
          padding-bottom: 10px;
          padding-top: 10px;
          position: relative;
        }
        .comment-cont {
          background-color: #f2f4f8;
          position: relative;
        }
        .comment-cont .comment {
          position: relative;
          padding: 10px 0px;
          border-bottom: 1px solid #e0e0e0;
          width: 473px;
        }
        .comment-cont .comment:hover {
          /* Show dropdown on hover */
        }
        .comment-cont .comment .comment-drop-down {
          display: none;
          position: absolute;
          right: 4px;
          top: 4px;
          padding-left: 5px;
        }
        .comment-cont .comment:hover .comment-drop-down {
          display: block;
        }
        .comment-cont .comment:hover cnv-dropdowns,
        .comment-cont .comment:hover .comment-drop-down {
          display: block;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .fetch-more-spinner span {
          animation: spin 1s linear infinite;
        }
        /* Comment Editor Styles - Exact match from AngularJS */
        .feed-comment-editor-cont {
          border-radius: 4px;
          background: white;
          border: 1px solid #ced2dc;
          position: relative;
        }
        .feed-comment-editor-cont.highlight {
          border: 1px solid #4183d7;
        }
        .feed-comment-editor-cont .dummy-text-area {
          border-radius: 4px;
          padding: 10px;
          height: 40px;
          cursor: text;
          color: #BFC3C4;
          font-size: 14px;
          font-family: 'Source Sans Pro', sans-serif;
        }
        .feed-comment-editor-cont .feed-comment-editor-active-cont {
          border-radius: 4px;
          position: relative;
        }
        .feed-comment-editor-cont .comment-action-bar {
          position: relative;
          padding: 9px 8px;
          border-top: 1px solid #ced2dc;
          border-bottom: 1px solid transparent;
        }
        .feed-comment-editor-cont .comment-action-bar .comment-action {
          text-align: center;
          margin-right: 4px;
          cursor: pointer;
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
          vertical-align: middle;
          display: inline-block;
          opacity: 0.85;
        }
        .feed-comment-editor-cont .comment-action-bar .comment-action.anim {
          transition: transform 125ms cubic-bezier(0.4, 0, 1, 1);
        }
        .feed-comment-editor-cont .comment-action-bar .comment-action.anim:hover {
          transform: scale(1.25);
        }
        .feed-comment-editor-cont .comment-action-bar .comment-action.file-chooser {
          background-size: 16px;
          background-position: 2px 2px;
        }
        .comment-cont .comment .pic_container {
          display: block;
          float: left;
          margin-right: 10px;
          margin-left: 10px;
          width: 40px;
          height: 40px;
        }
        .comment-cont .comment .comment_body {
          margin-top: 6px;
          display: block;
          overflow: hidden;
          vertical-align: middle;
          padding: 0px;
          margin-right: 20px;
        }
        .comment-cont .comment .comment_txt {
          word-wrap: break-word;
          overflow: hidden;
          position: relative;
          display: block;
        }
        .comment-cont .comment .comment_txt .comment-inner {
          display: block;
        }
        .comment-cont .comment .action_line {
          color: #596d97;
          margin: 5px 0;
        }
        .comment-cont .comment .action_line .meta {
          color: #7b8386;
        }
        .comment-cont .comment .action_line .meta:hover,
        .comment-cont .comment .action_line .meta:active,
        .comment-cont .comment .action_line .meta:focus {
          color: #7b8386;
        }
        .comment-cont .comment .action_line .reply-btn {
          color: #339fb8;
          cursor: pointer;
          text-decoration: none;
        }
        .comment-cont .comment .action_line .reply-btn:hover,
        .comment-cont .comment .action_line .reply-btn:focus,
        .comment-cont .comment .action_line .reply-btn:active {
          color: #339fb8;
        }
        .comment-cont .comment .action_line .likes_count {
          color: #339fb8;
          cursor: pointer;
          white-space: nowrap;
        }
        .comment-cont .comment .action_line .likes_count .count {
          color: #339fb8 !important;
        }
        .comment-cont.replied-comment-pointer .pic_container:before {
          content: '';
          position: absolute;
          left: 29px;
          width: 3px;
          background: rgba(123, 131, 134, 0.50);
          top: 0;
          height: 10px;
        }
        .feed_load_status {
          text-align: center;
          padding: 40px;
          color: #7b8386;
          font-size: 14px;
        }
        .feed-end-placeholder {
          background: url(/assets/img/feed/infinitescrollend2x.png);
          background-repeat: no-repeat;
          background-size: 56px 28px;
          background-position: center;
          padding: 15px;
          margin-top: 15px;
          margin-bottom: 60px;
        }
        #feed-updates-available-notif {
          position: fixed;
          top: 75px;
          left: 50%;
          right: auto;
          display: inline-block;
          margin-left: -50px;
          text-align: center;
          z-index: 11;
          transform: translateY(-200px);
          transition: transform cubic-bezier(0.2, -0.15, 1, 0) 400ms;
        }
        #feed-updates-available-notif.in-view {
          transition: transform cubic-bezier(0, 1.02, 0, 1.06) 500ms 500ms;
          transform: translateY(0);
        }
        .feed-cont {
          position: relative;
        }
        .dim-feed-item {
          opacity: 0.5;
        }
        /* Feed Item Styles - Exact match from AngularJS feedMain.less */
        .feed-item-container > .dp-container > .created-by .img-circle {
          height: 60px !important;
          width: 60px !important;
          line-height: 60px !important;
          font-size: 18px;
        }
        .feed-item-container > .dp-container > .created-by img {
          height: 60px !important;
          width: 60px !important;
        }
        .feed-item-container > .dp-container > .edited-by .img-circle {
          height: 35px !important;
          width: 35px !important;
          line-height: 32px !important;
          border: 2px solid white;
          font-size: 10px !important;
        }
        .feed-item-container > .dp-container > .edited-by img {
          height: 35px !important;
          width: 35px !important;
          border: 2px solid white;
        }
        .feed-item-container > .dp-container.edited {
          font-size: 8px;
        }
        .feed-item-container .feed-item-content-right {
          width: calc(100% - 72px);
        }
        .feed-item-content-right .action-items-wrapper {
          position: relative;
          float: right;
        }
        .feed-item-content-right .action-items-wrapper > i {
          margin-right: 10px;
          margin-bottom: 2px;
          display: inline-block;
        }
        .feed-item-container .feed-item-content-right .shared-with-container ul li.nobullet {
          list-style: none;
        }
        .feed-item-container .feed-item-content-right .shared-with-container ul li a.meta {
          color: #7b8386;
          text-decoration: none;
        }
        .feed-item-container .feed-item-content-right .note .note-details {
          margin-top: 0px;
        }
        .feed-item-container .feed-item-content-right .note .note-details span {
          display: inline;
        }
        .feed-item-content-right .note .note-details.ackWrapper {
          color: white;
          position: relative;
          text-align: center;
          cursor: pointer;
        }
        .feed-item-content-right .note .note-details.ackWrapper .ackLabel {
          position: absolute;
          top: calc(50% - 19px);
          left: calc(50% - 145px);
          background-color: #929191;
          padding: 10px 30px;
          border-radius: 18px;
          opacity: 0.8;
        }
        .feed-item-content-right .note .note-details.ackWrapper .ackLabel span {
          opacity: 1;
          width: 230px;
          display: inline-block;
        }
        /* Comment Styles */
        .comment-cont .comment .comment_txt .comment-inner {
          color: #272b2c;
        }
        .reply-arrow {
          width: 13px;
          height: 5px;
          background: url(/assets/img/common/reply_arrow.png);
          background-size: 13px 5px;
          display: inline-block;
          vertical-align: middle;
          float: left;
          margin-top: 8px;
          margin-right: 4px;
        }
      `}</style>
    </div>
  );
}

