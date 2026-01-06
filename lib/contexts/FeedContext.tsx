'use client';

/**
 * Feed Context
 * 
 * Provides feed data (users, groups) to feed components
 */

import { createContext, useContext, ReactNode } from 'react';
import { User } from '../api/auth';

interface FeedContextType {
  users: Record<string, User>;
  groups: Record<string, any>;
}

const FeedContext = createContext<FeedContextType | undefined>(undefined);

export function FeedProvider({ 
  children, 
  users, 
  groups 
}: { 
  children: ReactNode; 
  users: Record<string, User>; 
  groups: Record<string, any>; 
}) {
  return (
    <FeedContext.Provider value={{ users, groups }}>
      {children}
    </FeedContext.Provider>
  );
}

export function useFeedContext() {
  const context = useContext(FeedContext);
  if (!context) {
    throw new Error('useFeedContext must be used within FeedProvider');
  }
  return context;
}

