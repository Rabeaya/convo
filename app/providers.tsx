'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
import { ChatWindowsProvider } from '@/contexts/ChatWindowsContext';
import { ChatListProvider } from '@/contexts/ChatListContext';
import { MessagesProvider } from '@/contexts/MessagesContext';

/**
 * Providers component
 * 
 * Wraps the app with necessary providers (React Query, Contexts, etc.)
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <MessagesProvider>
        <ChatListProvider>
          <ChatWindowsProvider>
            {children}
          </ChatWindowsProvider>
        </ChatListProvider>
      </MessagesProvider>
    </QueryClientProvider>
  );
}

