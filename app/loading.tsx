/**
 * Global loading component
 */

export default function Loading() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#e2e5ea',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Source Sans Pro', sans-serif",
    }}>
      <div style={{
        fontSize: '14px',
        color: '#272b2c',
      }}>
        Loading...
      </div>
    </div>
  );
}

