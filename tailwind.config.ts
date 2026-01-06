import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // App-wide Colors (from variables.less)
        'cnv-bg-light': '#f7f7f7',
        'cnv-blue': '#4183d7',
        'cnv-blue-dark': '#3371bd',
        'cnv-orange': '#e56564',
        'cnv-gray-light': '#f2f4f8',
        'cnv-red': '#e56564',
        'cnv-gray-dark': '#2b2b2b',
        'cnv-dark-gray-bg': '#2b2b2b',
        'cnv-red-error': '#f73a2c',
        'cnv-light-blue-disabled-control': '#a6c5ec',
        'cnv-bg-dark': '#404040',
        'cnv-green': '#61ba14',
        'convo-gray': '#9FA9B3',
        'convo-white': '#fff',
        
        // Text colors
        'text-color': '#272b2c',
        'link-color': '#3371bd',
        'gray-base': '#7b8386',
        'dark-gray-base': '#2b2b2b',
        
        // Comments panel
        'cnv-comments-panel-bg': '#f2f4f8',
        'cnv-feed-comments-panel-bg': '#f2f4f8',
        'cnv-feed-geo-location-bg': '#e3f0fd',
        'cnv-comments-stroke-color': '#ced2dc',
        'cnv-comments-separator': '#e6e8ec',
        'cnv-in-app-center-unread-bg': '#f2f4f8',
        'cnv-in-app-docked-date-separator-bg': '#e1e4eb',
        'cnv-editor-status-text-color': '#88898e',
        
        // Chat
        'cnv-chat-list-item-hover-color': '#eaecf6',
        'cnv-chat-unfocused-color': '#f2f4f8',
        'cnv-chat-focused-color': '#1f2e3d',
        'cnv-chat-unread-color': '#3371bd',
        'cnv-chat-window-color': '#fff',
        'cnv-chat-focused-text-color': '#fff',
        'cnv-chat-unfocused-text-color': '#2b2b2b',
        'cnv-chat-msg-from-other': '#f2f4f8',
        'cnv-chat-msg-from-me': '#8dbefd',
        'cnv-chat-separator': '#d4d9e3',
        
        // Buttons
        'btn-primary-bg': '#4183d7',
        'btn-default-bg': '#fff',
        'btn-default-color': '#4183d7',
        'btn-default-border': '#4183d7',
        
        // Feed
        'feed-link-color': '#339fb8',
        'cnv-feed-add-box-bg': '#efefef',
        
        // App header
        'cnv-app-header-color-light': '#f2f4f8',
        'cnv-app-header-color-dark': '#1e2e3d',
        'cnv-app-secondary-header-color': '#eceff3',
        
        // App sidebar
        'cnv-app-sidebar-color-dark': '#1e2e3d',
        'cnv-app-logo-wrapper-color': '#1b2634',
        
        // App dropdowns
        'cnv-dropdown-bg': '#fff',
        'cnv-dropdown-item-hover': '#4183d7',
        'cnv-dropdown-text-color': '#272b2c',
        'cnv-dropdown-stroke': '#d7dbe6',
        
        // App body
        'cnv-body-color': '#e2e5ea',
        'cnv-home-body-bg': '#fff',
        'cnv-light-header-color': '#e8ebf0',
        
        // App hover
        'cnv-app-hover-color': '#f5f7fc',
        
        // App scroll
        'cnv-app-scroll-color': '#dadee6',
        
        // App gallery
        'cnv-gallery-bg-color': '#1b2634',
        'cnv-gallery-header-color': '#738498',
        
        // App smart-tabs
        'cnv-smart-tab-bg': '#738498',
        'cnv-smart-comment-select-tab-bg': '#dde2ea',
        
        // App invite-view
        'cnv-green-check-bg': '#26c281',
        'cnv-teammates-selected-bg': '#e3f0fd',
        
        // App popover
        'cnv-popover-bg': '#1e2e3d',
        
        // App border
        'cnv-app-border-color': '#dde2ea',
        
        // Banners
        'yellow-color-light': '#fff2ca',
        'yellow-color-dark': '#d1c066',
        
        // Annotation highlight
        'red-color-light': 'rgba(242, 109, 84, 0.20)',
        'red-color-dark': '#E86F55',
        
        // Selection
        'selection-bg': '#dbebff',
      },
      fontFamily: {
        sans: ['Source Sans Pro', 'sans-serif'],
        'sans-win8': ['Source Sans Pro', 'ConvoEmojiWin8', 'sans-serif'],
        'sans-win81': ['Source Sans Pro', 'ConvoEmojiWin81', 'sans-serif'],
      },
      fontSize: {
        'base': '14px',
        'xs': '12px',
        'xs-5': '12.5px',
        'sm': '13px',
        'md': '14px',
        'lg': '15px',
        'lg-1': '15.1px',
        'xl': '16px',
        'xl-1': '17px',
        'xl-2': '18px',
        'xl-3': '19px',
        'xl-4': '20px',
        'xl-5': '22px',
        'xl-6': '24px',
        'xl-7': '25px',
        'xl-8': '26px',
        'xl-9': '28px',
        'xl-10': '30px',
        'xl-11': '32px',
        'xl-12': '34px',
        'xl-13': '38px',
      },
      spacing: {
        'header-height': '60px',
        'network-alert-height': '30px',
        'left-panel-width': '235px',
        'left-panel-slim-width': '56px',
        'center-panel-width': '572px',
        'feed-item-width': '572px',
        'feed-item-left-panel-width': '75px',
        'feed-item-right-panel-width': '495px',
        'right-panel-width': '220px',
        'feed-panel-width': '540px',
        'app-header-height': '56px',
        'app-sub-header-height': '40px',
        'app-large-header-height': '140px',
        'app-large-header-height-2': '105px',
        'inline-insert-expanded-height': '238px',
        'inline-insert-collapsed-height': '80px',
        'inline-insert-collapsed-textbox-height': '40px',
        'inline-insert-collapsed-padding': '10px',
        'notes-app-gutter': '30px',
        'notes-app-content-gutter': '54px',
      },
      borderRadius: {
        'cnv': '3px',
        'user-profile': '5px',
      },
      screens: {
        'lg': '1141px',
        'md': '970px',
        'sm': '723px',
      },
      minWidth: {
        'app': '1024px',
        'feed': '690px',
        'notes-link-app': '690px',
        'gallery-controls-compact-view': '890px',
        'user-group-view': '1295px',
      },
      maxWidth: {
        'home-body': '1440px',
        'notes-app-content': '760px', // 700px + (30px * 2)
      },
      minHeight: {
        'notes-app-content': '590px', // 530px + (30px * 2)
      },
    },
  },
  plugins: [],
};

export default config;

