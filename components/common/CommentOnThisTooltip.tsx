'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type CommentOnThisTooltipPosition = {
  top: number; // content-relative top inside portal target
  left: number; // content-relative left inside portal target
};

type Props = {
  portalTarget: HTMLElement;
  position: CommentOnThisTooltipPosition;
  onClick: () => void;
  onClose: () => void;
};

/**
 * Strict visual parity with Angular textSelections.showIcoAboveSel()
 * DOM structure:
 * <div class="sel-open-comments text-operations arrow-*" ...>
 *   <span class="cross ..."></span>
 *   <i class="cnv-icons-16 icons_Comments-white"></i>
 *   <span>Comment on this</span>
 * </div>
 */
export default function CommentOnThisTooltip({ portalTarget, position, onClick, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [arrowClass, setArrowClass] = useState<'arrow-center' | 'arrow-right' | 'arrow-left'>('arrow-center');
  const [computedLeft, setComputedLeft] = useState<number>(position.left);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const tooltipWidth = el.getBoundingClientRect().width;
    const containerWidth = portalTarget.getBoundingClientRect().width;
    const left = position.left;

    // Mirrors Angular showIcoAboveSel arrow logic
    if (left > tooltipWidth / 2 + 20 && left + tooltipWidth + 20 < containerWidth) {
      setArrowClass('arrow-center');
      setComputedLeft(left - (tooltipWidth / 2 + 9));
    } else if (left + tooltipWidth + 20 > containerWidth) {
      setArrowClass('arrow-right');
      setComputedLeft(left - (tooltipWidth - 4));
    } else {
      setArrowClass('arrow-left');
      setComputedLeft(left - 24);
    }
  }, [portalTarget, position.left]);

  useEffect(() => {
    setComputedLeft(position.left);
  }, [position.left]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener('click', handleClickOutside, true);
    return () => document.removeEventListener('click', handleClickOutside, true);
  }, [onClose]);

  const tooltip = (
    <div
      ref={ref}
      className={`sel-open-comments text-operations visible ${arrowClass}`}
      style={{
        top: `${position.top}px`,
        left: `${computedLeft}px`,
      }}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target?.classList?.contains('cross')) {
          e.preventDefault();
          e.stopPropagation();
          onClose();
          return;
        }
        onClick();
      }}
    >
      <span className="cross cnv-icons-20 icons2_Close-darkgray"></span>
      <i className="cnv-icons-16 icons_Comments-white"></i>
      <span>Comment on this</span>
    </div>
  );

  return createPortal(tooltip, portalTarget);
}


