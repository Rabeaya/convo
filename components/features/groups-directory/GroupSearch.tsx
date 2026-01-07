'use client';

/**
 * Group Search Component
 * 
 * Search input for filtering groups
 * Matches AngularJS search behavior with debounce
 */

import { useCallback, useEffect, useRef } from 'react';

interface GroupSearchProps {
  placeholder?: string;
  onSearch: (searchFragment: string) => void;
  show?: boolean;
}

export default function GroupSearch({ 
  placeholder = 'Search for groups', 
  onSearch,
  show = true 
}: GroupSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce function matching AngularJS behavior (20ms debounce)
  const debouncedSearch = useCallback((searchFragment: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(() => {
      onSearch(searchFragment);
    }, 20);
  }, [onSearch]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const searchFragment = e.target.value;
    debouncedSearch(searchFragment);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  if (!show) {
    return null;
  }

  return (
    <input
      ref={inputRef}
      className="form-control"
      type="text"
      placeholder={placeholder}
      spellCheck={false}
      onChange={handleInputChange}
    />
  );
}


