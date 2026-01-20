'use client';

/**
 * Dropzone Component
 * 
 * Matches AngularJS cnv-dropzone directive exactly
 * Shows "Drop files here" message when dragging files over the editor
 */

import React, { useState, useEffect } from 'react';

interface DropzoneProps {
  dropzoneId: string;
  message?: string;
  messageClass?: string;
}

export default function Dropzone({ dropzoneId, message = 'Drop files here', messageClass = '' }: DropzoneProps) {
  const [activated, setActivated] = useState(false);
  const [expand, setExpand] = useState(false);

  useEffect(() => {
    // Listen to cnv-drag-start and cnv-drag-end events (matches Angular cnvDragDrop directive)
    const handleDragStart = () => {
      setActivated(true);
      setExpand(true);
    };

    const handleDragEnd = () => {
      setActivated(true);
      setExpand(false);
    };

    const handleFileSelected = () => {
      setActivated(true);
      setExpand(false);
    };

    // Custom events dispatched by drag-and-drop handlers
    window.addEventListener('cnv-drag-start', handleDragStart);
    window.addEventListener('cnv-drag-end', handleDragEnd);
    window.addEventListener('fileSelected', handleFileSelected);

    return () => {
      window.removeEventListener('cnv-drag-start', handleDragStart);
      window.removeEventListener('cnv-drag-end', handleDragEnd);
      window.removeEventListener('fileSelected', handleFileSelected);
    };
  }, []);

  if (!activated) return null;

  return (
    <div 
      className={`dropzone ${expand ? 'dropzone-expand' : 'dropzone-collapse'}`}
    >
      <div>
        <div>
          <div className={`dropzone-target ${messageClass}`} id={dropzoneId}>
            {message}
          </div>
        </div>
      </div>
    </div>
  );
}

