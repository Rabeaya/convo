'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export type AddTagsModalProps = {
  initialTags: string; // comma-separated, matches Angular
  onSubmit: (tagsCsv: string) => void;
  onClose: () => void;
};

function normalizeTag(raw: string): string | null {
  const s = String(raw || '').trim();
  if (!s) return null;
  const withHash = s.startsWith('#') ? s : `#${s}`;
  // Angular: allowed-tags-pattern="^#[0-9a-zA-Z_-]+.*$"
  const m = withHash.match(/^#[0-9a-zA-Z_-]+/);
  if (!m) return null;
  return m[0];
}

export default function AddTagsModal({ initialTags, onSubmit, onClose }: AddTagsModalProps) {
  const initial = useMemo(() => {
    const parts = String(initialTags || '')
      .split(',')
      .map((t) => normalizeTag(t))
      .filter((t): t is string => !!t);
    return Array.from(new Set(parts));
  }, [initialTags]);

  const [tags, setTags] = useState<string[]>(initial);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const addFromInput = () => {
    const parts = input.split(',').map((p) => normalizeTag(p)).filter(Boolean) as string[];
    if (parts.length === 0) return;
    setTags((prev) => Array.from(new Set([...prev, ...parts])));
    setInput('');
  };

  return (
    <div className="modal fade in" style={{ display: 'block' }}>
      <div className="modal-backdrop fade in" onClick={onClose} />
      <div className="modal-dialog" style={{ width: 500 }}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h4>Tag this post</h4>
            <button type="button" className="close" onClick={onClose}>
              ×
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              addFromInput();
              onSubmit(tags.join(','));
            }}
          >
            <div className="modal-body sharepost">
              <p>Add tags to make your post easier to find.</p>
              <br />

              <div className="to-field" style={{ border: '1px solid #e0e0e0', borderRadius: 3, padding: 8 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {tags.map((t) => (
                    <span
                      key={t}
                      style={{
                        background: '#f2f4f8',
                        border: '1px solid #e2e5ea',
                        borderRadius: 3,
                        padding: '3px 6px',
                        fontSize: 13,
                        color: '#2b2b2b',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {t}
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setTags((prev) => prev.filter((x) => x !== t));
                        }}
                        style={{ color: '#7b8386', textDecoration: 'none' }}
                      >
                        ×
                      </a>
                    </span>
                  ))}
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addFromInput();
                      }
                      if (e.key === ',' ) {
                        e.preventDefault();
                        addFromInput();
                      }
                      if (e.key === 'Escape') onClose();
                    }}
                    placeholder="+Add more"
                    style={{
                      border: 'none',
                      outline: 'none',
                      fontSize: 14,
                      flex: 1,
                      minWidth: 120,
                    }}
                  />
                </div>
              </div>

              <br />
              <p>Separate tags with commas</p>
            </div>

            <div className="modal-footer">
              <button
                type="submit"
                className="btn btn-primary"
                style={{
                  backgroundColor: 'rgb(51, 113, 189)',
                  borderColor: 'rgb(51, 113, 189)',
                  color: '#fff',
                }}
              >
                Done
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}


