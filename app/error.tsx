'use client';

/**
 * Error Boundary Component
 * Required by Next.js App Router
 */

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error);
  }, [error]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#e2e5ea',
      fontFamily: "'Source Sans Pro', sans-serif",
    }}>
      <div style={{
        backgroundColor: '#fff',
        padding: '40px',
        borderRadius: '3px',
        boxShadow: '0 1px 9px -2px rgba(0, 0, 0, 0.175)',
        maxWidth: '500px',
        textAlign: 'center',
      }}>
        <h2 style={{
          fontSize: '24px',
          fontWeight: '600',
          color: '#272b2c',
          marginBottom: '16px',
        }}>
          Something went wrong!
        </h2>
        <p style={{
          fontSize: '14px',
          color: '#7b8386',
          marginBottom: '24px',
        }}>
          {error.message || 'An unexpected error occurred'}
        </p>
        <button
          onClick={reset}
          style={{
            backgroundColor: '#4183d7',
            color: '#fff',
            border: 'none',
            borderRadius: '3px',
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#3371bd';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#4183d7';
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}

