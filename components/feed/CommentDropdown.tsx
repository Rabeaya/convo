'use client';

/**
 * Comment Dropdown Menu Component
 * 
 * Three-dot menu for comment actions (Edit, Delete)
 * Matches AngularJS cnv-dropdowns directive
 * Shows on hover of parent comment element
 */

import { useLayoutEffect, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

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
  const toggleRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [menuDir, setMenuDir] = useState<'down' | 'up'>('down');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const t = event.target as Node;
      if (
        (dropdownRef.current && dropdownRef.current.contains(t)) ||
        (menuRef.current && menuRef.current.contains(t))
      ) {
        return;
      }
      if (dropdownRef.current && !dropdownRef.current.contains(t)) {
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

  const recomputeMenuPosition = useRef<() => void>(() => {});
  recomputeMenuPosition.current = () => {
    const toggleEl = toggleRef.current;
    if (!toggleEl) return;
    const rect = toggleEl.getBoundingClientRect();

    // Anchor to the toggle; the menu itself is rendered into body to avoid clipping by scroll containers.
    const baseTop = rect.bottom + 5;
    const approxWidth = 150;
    const left =
      align === 'right'
        ? Math.max(8, rect.right - approxWidth)
        : Math.max(8, rect.left);

    setMenuPos({ top: baseTop, left });
  };

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuPos(null);
      setMenuDir('down');
      return;
    }
    recomputeMenuPosition.current();
  }, [isOpen, align]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    if (!menuPos) return;
    const menuEl = menuRef.current;
    if (!menuEl) return;
    const rect = menuEl.getBoundingClientRect();
    const wouldOverflowBottom = rect.bottom > window.innerHeight - 8;
    if (wouldOverflowBottom) {
      const toggleRect = toggleRef.current?.getBoundingClientRect();
      if (toggleRect) {
        setMenuDir('up');
        setMenuPos((p) =>
          p
            ? {
                ...p,
                top: Math.max(8, toggleRect.top - rect.height - 5),
              }
            : p
        );
      }
    } else {
      setMenuDir('down');
    }
  }, [isOpen, menuPos]);

  useEffect(() => {
    if (!isOpen) return;
    const onScrollOrResize = () => recomputeMenuPosition.current();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
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
        ref={toggleRef}
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

      {isOpen && menuPos && typeof document !== 'undefined' &&
        createPortal(
          <ul
            ref={menuRef}
            className={`dropdown-menu dropdown-main-menu ${align === 'right' ? 'dropdown-menu-right' : ''}`}
            style={{
              position: 'fixed',
              left: `${menuPos.left}px`,
              top: `${menuPos.top}px`,
              minWidth: '150px',
              backgroundColor: '#fff',
              border: '1px solid #ddd',
              borderRadius: '3px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              listStyle: 'none',
              padding: '5px 0',
              margin: '0',
              zIndex: 5000,
            }}
            data-direction={menuDir}
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
          </ul>,
          document.body
        )
      }
    </div>
  );
}
