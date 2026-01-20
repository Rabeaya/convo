'use client';

/**
 * Feed Item Options Dropdown Component
 * 
 * Three-dot menu for feed item actions (Edit, Delete, Star, Mute, etc.)
 * Migrated from AngularJS cnv-dropdowns directive
 * Exact 1:1 match with AngularJS implementation
 */

import { useState, useRef, useEffect } from 'react';

export interface DropdownOption {
  label?: string; // Optional for dividers
  icon?: string;
  iconStyle?: string;
  class?: string;
  callback?: () => void;
  disabled?: boolean;
  isDivider?: boolean;
  submenu?: DropdownOption[];
  conditionalLabelIcon?: boolean;
  condition?: string;
}

interface FeedItemDropdownProps {
  options: DropdownOption[];
  align?: 'left' | 'right';
  ddType?: string;
  containerClass?: string;
  onMenuOpen?: () => void;
  conditions?: Record<string, boolean>;
}

export default function FeedItemDropdown({ 
  options, 
  align = 'right',
  ddType = 'more-options',
  containerClass,
  onMenuOpen,
  conditions = {}
}: FeedItemDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [submenuOpen, setSubmenuOpen] = useState<number | null>(null);
  const submenuRefs = useRef<Record<number, HTMLUListElement | null>>({});
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSubmenuOpen(null);
      }
    };

    const handleMouseWheel = () => {
      setIsOpen(false);
      setSubmenuOpen(null);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('mousewheel', handleMouseWheel);
      
      // Call onMenuOpen callback if provided
      if (onMenuOpen) {
        onMenuOpen();
      }

      // Adjust menu position based on viewport
      adjustMenuPosition();
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('mousewheel', handleMouseWheel);
      // Cleanup timeout on unmount
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
    };
  }, [isOpen, onMenuOpen]);

  const adjustMenuPosition = () => {
    if (!menuRef.current) return;

    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;

    // Adjust vertical position if menu goes below viewport
    if (rect.bottom > windowHeight) {
      const height = menu.offsetHeight;
      menu.style.top = `${-height - 15}px`;
    }

    // Adjust horizontal position if menu goes beyond viewport
    if (rect.right > windowWidth) {
      const width = menu.offsetWidth;
      menu.style.left = `${-width + 15}px`;
    }
  };

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setSubmenuOpen(null);
    }
  };

  const handleOptionClick = (option: DropdownOption) => {
    if (option.isDivider || option.disabled) {
      return;
    }

    if (option.submenu && option.submenu.length > 0) {
      // Toggle submenu
      const optionIndex = options.indexOf(option);
      setSubmenuOpen(submenuOpen === optionIndex ? null : optionIndex);
    } else if (option.callback) {
      option.callback();
      setIsOpen(false);
      setSubmenuOpen(null);
    }
  };

  const getIconClass = (option: DropdownOption): string => {
    if (!option.icon) return '';
    
    const iconStyle = option.iconStyle || 'cnv-icons-16';
    return `${iconStyle} ${option.icon}`;
  };

  // Filter out dividers at the start/end
  const filteredOptions = options.filter((option, index) => {
    if (option.isDivider) {
      // Don't show divider if it's the first or last item, or if previous/next is also a divider
      if (index === 0 || index === options.length - 1) return false;
      if (options[index - 1]?.isDivider || options[index + 1]?.isDivider) return false;
    }
    return true;
  });

  return (
    <div
      ref={dropdownRef}
      className={`dropdown cnv-custom-dropdown ${containerClass || ''}`}
      style={{
        position: 'relative',
        display: 'inline-block',
      }}
    >
      <a
        href="#"
        className="dropdown-toggle"
        onClick={(e) => {
          e.preventDefault();
          handleToggle();
        }}
        style={{
          display: 'inline-block',
          cursor: 'pointer',
          textDecoration: 'none',
        }}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <i
          className={ddType === 'more-options' 
            // Our sprite bundle includes `icon1_more-01-darkgray` (three dots), but not `icons2-more-options-gray`.
            // Use the available icon to match Angular’s three-dot menu.
            ? 'cnv-icons-16 icon1_more-01-darkgray'
            : ddType === 'circleLessChevron'
            ? 'cnv-icons-16 icon1_more-01-dark'
            : 'cnv-icons-20 icons_Dropdown_incircle-lightgray'
          }
          style={{
            display: 'inline-block',
            width: ddType === 'more-options' ? '16px' : '20px',
            height: ddType === 'more-options' ? '16px' : '20px',
          }}
        ></i>
      </a>

      {isOpen && (
        <ul
          ref={menuRef}
          className={`dropdown-menu dropdown-main-menu ${align === 'right' ? 'dropdown-menu-right' : ''}`}
          style={{
            position: 'absolute',
            right: align === 'right' ? '0' : 'auto',
            left: align === 'left' ? '0' : 'auto',
            top: '20px',
            minWidth: '180px',
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
          {filteredOptions.map((option, index) => {
            if (option.isDivider) {
              return (
                <li
                  key={`divider-${index}`}
                  style={{
                    height: '1px',
                    margin: '5px 0',
                    overflow: 'hidden',
                    backgroundColor: '#e5e5e5',
                    border: 'none',
                    padding: 0,
                  }}
                ></li>
              );
            }

            const hasSubmenu = option.submenu && option.submenu.length > 0;
            const isSubmenuItemOpen = submenuOpen === index;

            return (
              <li
                key={index}
                className={option.class || ''}
                style={{
                  position: 'relative',
                }}
              >
                <a
                  href="#"
                  className={`menu-item-wrapper ${option.class || ''} ${hasSubmenu ? 'pseudo-submenu-arrow' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleOptionClick(option);
                  }}
                  onMouseEnter={(e) => {
                    if (hasSubmenu) {
                      // Clear any pending timeout
                      if (hoverTimeoutRef.current) {
                        clearTimeout(hoverTimeoutRef.current);
                        hoverTimeoutRef.current = null;
                      }
                      setSubmenuOpen(index);
                    }
                  }}
                  onMouseLeave={(e) => {
                    // Angular: hide submenu on mouseleave of parent item
                    // Small delay to allow mouse to move to submenu
                    if (hasSubmenu) {
                      if (hoverTimeoutRef.current) {
                        clearTimeout(hoverTimeoutRef.current);
                      }
                      hoverTimeoutRef.current = setTimeout(() => {
                        const submenuEl = submenuRefs.current[index];
                        // Check if mouse is still over submenu
                        if (!submenuEl || !submenuEl.contains(document.elementFromPoint(e.clientX, e.clientY) as Node)) {
                          setSubmenuOpen(null);
                        }
                        hoverTimeoutRef.current = null;
                      }, 150);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 15px',
                    cursor: option.disabled ? 'not-allowed' : 'pointer',
                    color: option.disabled ? '#ccc' : '#272b2c',
                    fontSize: '14px',
                    textDecoration: 'none',
                    backgroundColor: 'transparent',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseOver={(e) => {
                    if (!option.disabled) {
                      e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {option.icon && (
                    <i
                      className={getIconClass(option)}
                      style={{
                        display: 'inline-block',
                        marginRight: '8px',
                        width: option.iconStyle?.includes('16') ? '16px' : '20px',
                        height: option.iconStyle?.includes('16') ? '16px' : '20px',
                      }}
                    ></i>
                  )}
                  <span style={{ flex: 1 }}>{option.label}</span>
                  {hasSubmenu && (
                    <i
                      className="cnv-icons-12 icons2_Dropdown-darkgray"
                      style={{
                        marginLeft: '8px',
                        display: 'inline-block',
                        width: '12px',
                        height: '12px',
                      }}
                    ></i>
                  )}
                  {option.conditionalLabelIcon && option.condition && conditions[option.condition] && (
                    <i
                      className={`${option.iconStyle || 'cnv-icons-12'} icon-cnv-tick`}
                      style={{
                        marginLeft: '8px',
                        display: 'inline-block',
                        width: '12px',
                        height: '12px',
                      }}
                    ></i>
                  )}
                </a>

                {/* Submenu */}
                {hasSubmenu && isSubmenuItemOpen && (
                  <ul
                    ref={(el) => {
                      if (el) {
                        submenuRefs.current[index] = el;
                        // Angular: left: 196px, margin-top: -26px
                        el.style.position = 'absolute';
                        el.style.left = '196px';
                        el.style.marginTop = '-26px';
                        // Check if submenu would overflow viewport and flip if needed
                        requestAnimationFrame(() => {
                          const rect = el.getBoundingClientRect();
                          const winWidth = window.innerWidth;
                          const selWidth = el.offsetWidth;
                          if (rect.left + selWidth + 4 > winWidth) {
                            const currentLeft = parseInt(el.style.left.replace('px', '')) || 196;
                            el.style.left = `${currentLeft - (rect.left + selWidth - winWidth - 4)}px`;
                          }
                        });
                      } else {
                        delete submenuRefs.current[index];
                      }
                    }}
                    className="dropdown-submenu"
                    style={{
                      position: 'absolute',
                      left: '196px',
                      marginTop: '-26px',
                      minWidth: '180px',
                      backgroundColor: '#fff',
                      border: '1px solid #ddd',
                      borderRadius: '3px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                      listStyle: 'none',
                      padding: '5px 0',
                      margin: '0',
                      zIndex: 1001,
                    }}
                    onMouseEnter={() => {
                      // Clear any pending timeout
                      if (hoverTimeoutRef.current) {
                        clearTimeout(hoverTimeoutRef.current);
                        hoverTimeoutRef.current = null;
                      }
                      // Keep submenu open when hovering over it
                      setSubmenuOpen(index);
                    }}
                    onMouseLeave={() => {
                      // Close submenu when mouse leaves it
                      if (hoverTimeoutRef.current) {
                        clearTimeout(hoverTimeoutRef.current);
                        hoverTimeoutRef.current = null;
                      }
                      setSubmenuOpen(null);
                    }}
                  >
                    {option.submenu!.map((subOption, subIndex) => {
                      if (subOption.isDivider) {
                        return (
                          <li
                            key={`subdivider-${subIndex}`}
                            style={{
                              height: '1px',
                              margin: '5px 0',
                              overflow: 'hidden',
                              backgroundColor: '#e5e5e5',
                              border: 'none',
                              padding: 0,
                            }}
                          ></li>
                        );
                      }

                      return (
                        <li key={subIndex}>
                          <a
                            href="#"
                            className="menu-item-wrapper"
                            onClick={async (e) => {
                              e.preventDefault();
                              if (subOption.callback) {
                                try {
                                  // Await the callback if it's async (permissions callbacks are async)
                                  await subOption.callback();
                                } catch (error) {
                                  console.error('Error in submenu callback:', error);
                                }
                                setIsOpen(false);
                                setSubmenuOpen(null);
                              }
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '8px 15px',
                              cursor: subOption.disabled ? 'not-allowed' : 'pointer',
                              color: subOption.disabled ? '#ccc' : '#272b2c',
                              fontSize: '14px',
                              textDecoration: 'none',
                              backgroundColor: 'transparent',
                              transition: 'background-color 0.2s',
                            }}
                            onMouseOver={(e) => {
                              if (!subOption.disabled) {
                                e.currentTarget.style.backgroundColor = '#f5f5f5';
                              }
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            {/* Angular: conditionalLabelIcon shows icon on LEFT when condition is true, spacer when false */}
                            {subOption.conditionalLabelIcon && subOption.condition ? (
                              conditions[subOption.condition] ? (
                                <i
                                  className={getIconClass(subOption)}
                                  style={{
                                    display: 'inline-block',
                                    marginRight: '8px',
                                    width: subOption.iconStyle?.includes('12') ? '12px' : '16px',
                                    height: subOption.iconStyle?.includes('12') ? '12px' : '16px',
                                  }}
                                ></i>
                              ) : (
                                <span style={{ display: 'inline-block', width: '14px', marginRight: '8px' }}></span>
                              )
                            ) : subOption.icon ? (
                              <i
                                className={getIconClass(subOption)}
                                style={{
                                  display: 'inline-block',
                                  marginRight: '8px',
                                  width: subOption.iconStyle?.includes('12') ? '12px' : '16px',
                                  height: subOption.iconStyle?.includes('12') ? '12px' : '16px',
                                }}
                              ></i>
                            ) : null}
                            <span style={{ flex: 1 }}>{subOption.label}</span>
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

