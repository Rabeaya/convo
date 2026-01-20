'use client';

/**
 * Expanded Editor Page (Notes App)
 * 
 * Matches Angular route: /v1/acc-{accountId}/apps/{appInstanceId}/messages/{noteId}#title={title}
 * Opens the inline insert editor in fullscreen/expanded mode in a new tab
 * Implements full cnv-notes-app UI with all action buttons and features
 */

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import NotesApp from '@/components/notes/NotesApp';
import { useAuthStore } from '@/lib/stores/auth-store';
import '@/app/notes/notes.css';

export default function ExpandedEditorPage() {
  const params = useParams();
  const { account, loginData } = useAuthStore();
  
  const accountId = params.accountId as string;
  const appInstanceId = params.appInstanceId as string;
  const noteId = params.noteId as string;
  
  // Get title from hash fragment (Angular uses hash for title)
  const [initialTitle, setInitialTitle] = useState('');
  const [isReady, setIsReady] = useState(false);
  
  useEffect(() => {
    // Check hash fragment for title (Angular pattern: #title=...)
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash) {
        const titleMatch = hash.match(/title=([^&]*)/);
        if (titleMatch) {
          const decodedTitle = decodeURIComponent(titleMatch[1]);
          setInitialTitle(decodedTitle);
        }
      }
      setIsReady(true);
    }
  }, []);

  // Note: Account ID verification is handled by the auth system
  // We don't need to block rendering here - if user is authenticated, they can access the editor
  // The account ID in the URL is mainly for routing/organization purposes

  if (!isReady) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Loading editor...</p>
      </div>
    );
  }

  return (
    <div className="home-container" style={{ minHeight: '100vh', backgroundColor: '#fff', height: '100vh', overflow: 'hidden' }}>
      {/* Notes App Container - matches Angular cnv-app-cont */}
      <div className="cnv-app-cont" style={{
        minHeight: '100vh',
        height: '100vh',
        backgroundColor: '#fff',
        overflow: 'hidden'
      }}>
        {/* Notes App - matches Angular cnv-notes-app */}
        <NotesApp noteId={noteId} initialTitle={initialTitle} />
      </div>
    </div>
  );
}

