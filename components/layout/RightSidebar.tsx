'use client';

/**
 * Right Sidebar Component
 * 
 * Displays invite teammates widget and explore convo checklist
 * Matches AngularJS homeRightPanel.tpl.html
 */

import { useState } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';

export default function RightSidebar() {
  const { user } = useAuthStore();
  const isGuest = (user as any)?.isGuestUser?.() || false;
  const canInviteUsers = true; // TODO: Get from user permissions

  const handleInviteContacts = () => {
    // TODO: Implement invite contacts modal
    console.log('Invite contacts clicked');
  };

  const handleShareableLinkClick = () => {
    // TODO: Implement shareable link functionality
    console.log('Shareable link clicked');
  };

  // Mock checklist data - TODO: Fetch from API
  const checklist = {
    learn_my_feed_done: 1,
    share_a_post_done: 1,
    connect_to_other_tools_done: 1,
    downloaded_apps: 0,
  };

  const checklistProgress = 
    ((checklist.learn_my_feed_done ? 1 : 0) +
     (checklist.share_a_post_done ? 1 : 0) +
     (checklist.connect_to_other_tools_done ? 1 : 0) +
     (checklist.downloaded_apps ? 1 : 0)) * 25;

  return (
    <div className="feed-right-panel-wrapper">
      {/* Invite Teammates Widget */}
      {!isGuest && canInviteUsers && (
        <div className="row no-margin feed-invite-widget" style={{
          padding: '20px',
        }}>
          <button 
            className="btn btn-primary" 
            onClick={handleInviteContacts}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#4183d7',
              color: '#fff',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              marginBottom: '10px',
            }}
          >
            Invite your teammates
          </button>

          <div className="separator" style={{
            textAlign: 'center',
            margin: '10px 0',
            color: '#959595',
            fontSize: '13px',
          }}>
            or
          </div>

          <div className="vanity-help-txt" style={{
            marginBottom: '10px',
            fontSize: '13px',
            color: '#7b8386',
            lineHeight: '1.5',
          }}>
            <span>Get your company's exclusive invite link. Your teammates can use this link to sign up to Convo.</span>
          </div>

          <button 
            className="btn btn-default" 
            onClick={handleShareableLinkClick}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#fff',
              color: '#4183d7',
              border: '1px solid #4183d7',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Invite via email or chat
          </button>
        </div>
      )}

      {/* Explore Convo Checklist */}
      <div className="cnv-onboarding-checklist-container" style={{
        padding: '20px',
      }}>
        <div className="checklist-wrapper">
          {/* Headings */}
          <span className="heading" style={{
            display: 'block',
            fontSize: '16px',
            fontWeight: '600',
            color: '#2b2b2b',
            marginBottom: '5px',
          }}>
            Explore Convo
          </span>
          <span className="heading-sub" style={{
            display: 'block',
            fontSize: '13px',
            color: '#7b8386',
            marginBottom: '15px',
          }}>
            Follow these tips to get started.
          </span>

          {/* Progress Bar */}
          <div className="cnv-progress-bar" style={{
            position: 'relative',
            height: '20px',
            backgroundColor: '#f5f5f5',
            borderRadius: '10px',
            marginBottom: '15px',
            border: '1px solid #f5f5f5',
          }}>
            <div 
              className="green" 
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: '100%',
                width: `${checklistProgress}%`,
                backgroundColor: '#5aba10',
                borderRadius: '10px',
              }}
            ></div>
            {checklistProgress !== 100 && (
              <span className="count" style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: '12px',
                color: '#2b2b2b',
                fontWeight: '600',
              }}>
                {checklistProgress}%
              </span>
            )}
          </div>

          <hr style={{
            border: 'none',
            borderTop: '1px solid #e0e0e0',
            margin: '15px 0',
          }} />

          {/* Onboarding Checklist */}
          <ul className="onboarding-checklist" style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
          }}>
            <li style={{
              marginBottom: '10px',
            }}>
              <a 
                href="javascript:void(0)" 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  color: checklist.learn_my_feed_done ? '#959595' : '#272b2c',
                  textDecoration: checklist.learn_my_feed_done ? 'line-through' : 'none',
                  fontSize: '14px',
                }}
              >
                {checklist.learn_my_feed_done && (
                  <i className="glyphicon glyphicon-ok" style={{
                    marginRight: '8px',
                    color: '#5aba10',
                  }}></i>
                )}
                1. Learn about feed
              </a>
            </li>
            <li style={{
              marginBottom: '10px',
            }}>
              <a 
                href="javascript:void(0)" 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  color: checklist.share_a_post_done ? '#959595' : '#272b2c',
                  textDecoration: checklist.share_a_post_done ? 'line-through' : 'none',
                  fontSize: '14px',
                }}
              >
                {checklist.share_a_post_done && (
                  <i className="glyphicon glyphicon-ok" style={{
                    marginRight: '8px',
                    color: '#5aba10',
                  }}></i>
                )}
                2. Share a post
              </a>
            </li>
            <li style={{
              marginBottom: '10px',
            }}>
              <a 
                href="javascript:void(0)" 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  color: checklist.connect_to_other_tools_done ? '#959595' : '#272b2c',
                  textDecoration: checklist.connect_to_other_tools_done ? 'line-through' : 'none',
                  fontSize: '14px',
                }}
              >
                {checklist.connect_to_other_tools_done && (
                  <i className="glyphicon glyphicon-ok" style={{
                    marginRight: '8px',
                    color: '#5aba10',
                  }}></i>
                )}
                3. Connect to other tools
              </a>
            </li>
            <li>
              <a 
                href="javascript:void(0)" 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  color: checklist.downloaded_apps ? '#959595' : '#272b2c',
                  textDecoration: checklist.downloaded_apps ? 'line-through' : 'none',
                  fontSize: '14px',
                }}
              >
                {checklist.downloaded_apps && (
                  <i className="glyphicon glyphicon-ok" style={{
                    marginRight: '8px',
                    color: '#5aba10',
                  }}></i>
                )}
                4. Download apps
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

