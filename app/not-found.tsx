/**
 * Not Found Page
 * Required by Next.js App Router
 */

import Link from 'next/link';

export default function NotFound() {
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
          404 - Page Not Found
        </h2>
        <p style={{
          fontSize: '14px',
          color: '#7b8386',
          marginBottom: '24px',
        }}>
          The page you're looking for doesn't exist.
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            backgroundColor: '#4183d7',
            color: '#fff',
            border: 'none',
            borderRadius: '3px',
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: '600',
            textDecoration: 'none',
            cursor: 'pointer',
          }}
        >
          Go to Home
        </Link>
      </div>
    </div>
  );
}

