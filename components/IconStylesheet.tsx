'use client';

import { useEffect } from 'react';

export default function IconStylesheet() {
  useEffect(() => {
    // Check if the stylesheet is already loaded
    const existingLink = document.querySelector('link[href="/assets/cnv-icons/sprites/icons.data.svg.css"]');
    
    if (!existingLink) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = '/assets/cnv-icons/sprites/icons.data.svg.css';
      document.head.appendChild(link);
    }
  }, []);

  return null;
}

