'use client';

/**
 * Comment Dropdown Menu Component
 * 
 * Three-dot menu for comment actions (Edit, Delete)
 * Matches AngularJS cnv-dropdowns directive
 * Shows on hover of parent comment element
 */

import { useState, useRef, useEffect } from 'react';

interface DropdownOption {
  label: string;
  callback: () => void;
  disabled?: boolean;
}

interface CommentDropdownProps {
  options: DropdownOption[];
  align?: 'left' | 'right';
}

export default function CommentDropdown({ options, align = 'right' }: CommentDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleOptionClick = (option: DropdownOption) => {
    if (!option.disabled) {
      option.callback();
      setIsOpen(false);
    }
  };

  return (
    <div
      ref={dropdownRef}
      style={{
        position: 'relative',
        display: 'inline-block',
      }}
    >
      <div
        className="dropdown-toggle"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          cursor: 'pointer',
          display: 'inline-block',
        }}
      >
        <i className="cnv-icons-16 icon1_more-01-dark" style={{
          display: 'inline-block',
          width: '16px',
          height: '16px',
        }}></i>
      </div>

      {isOpen && (
        <ul
          className={`dropdown-menu dropdown-main-menu ${align === 'right' ? 'dropdown-menu-right' : ''}`}
          style={{
            position: 'absolute',
            right: align === 'right' ? '0' : 'auto',
            left: align === 'left' ? '0' : 'auto',
            top: '100%',
            marginTop: '5px',
            minWidth: '150px',
            backgroundColor: '#fff',
            border: '1px solid #ddd',
            borderRadius: '3px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            listStyle: 'none',
            padding: '5px 0',
            margin: '0',
            zIndex: 1000,
          }}
        >
          {options.map((option, index) => (
            <li
              key={index}
              onClick={() => handleOptionClick(option)}
              style={{
                padding: '8px 15px',
                cursor: option.disabled ? 'not-allowed' : 'pointer',
                color: option.disabled ? '#ccc' : '#272b2c',
                fontSize: '14px',
                backgroundColor: 'transparent',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!option.disabled) {
                  e.currentTarget.style.backgroundColor = '#f5f5f5';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
