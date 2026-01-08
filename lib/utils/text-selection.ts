/**
 * Text selection + highlight helpers
 *
 * Mirrors the AngularJS textSelections service behavior used in:
 * - cnvFeedItem.js (note-details selection + playback)
 * - cnvComment.js (comment-inner selection + playback)
 *
 * We don't use Rangy in React, but we preserve:
 * - beginIndex/endIndex computed over nested text nodes
 * - tooltip positioning from Range.getBoundingClientRect()
 * - highlight via <mark class="sel-text-highlight">
 */

export type TextSelectionData = {
  beginIndex: number;
  endIndex: number;
  text: string;
  range: Range;
  rect: DOMRect;
};

function normalizeTextForIndexes(s: string): string {
  // Angular getSelection converts line breaks to '\r'
  return (s || '').replace(/\n/g, '\r');
}

function iterTextNodes(root: Node): Text[] {
  const out: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) {
    out.push(n as Text);
  }
  return out;
}

function nodeTextLen(node: Text): number {
  return (node.nodeValue || '').length;
}

function findOffsetInRoot(rootEl: HTMLElement, targetNode: Node, offsetInNode: number): number | null {
  // Convert selection container to a text node if needed.
  let node: Node | null = targetNode;
  if (node.nodeType !== Node.TEXT_NODE) {
    const asEl = node as HTMLElement;
    const firstTxt = asEl.querySelector ? asEl.querySelector('*') : null;
    // Fallback: if selection container is element, use first text node inside root.
    node = firstTxt ? firstTxt.firstChild : null;
  }

  const texts = iterTextNodes(rootEl);
  let acc = 0;
  for (const t of texts) {
    if (t === node) {
      return acc + Math.max(0, Math.min(offsetInNode, nodeTextLen(t)));
    }
    acc += nodeTextLen(t);
  }
  // If exact node not found (e.g., selection spans outside), return null
  return null;
}

export function getSelectionDataWithin(containerEl: HTMLElement): TextSelectionData | null {
  const sel = window.getSelection?.();
  if (!sel || sel.rangeCount === 0) return null;

  const range = sel.getRangeAt(0);
  const selectedText = sel.toString();
  if (!selectedText || selectedText.trim() === '') return null;

  // Angular special-case: if selection includes the "more/less" placeholder, trim to the text before it.
  const endParentEl =
    range.endContainer.nodeType === Node.ELEMENT_NODE
      ? (range.endContainer as Element)
      : (range.endContainer.parentElement as Element | null);
  const placeholderEl = endParentEl?.closest?.('.truncate-placeholder, .more_text') as HTMLElement | null;

  // Ensure selection is inside container
  const common = range.commonAncestorContainer;
  if (!containerEl.contains(common)) return null;

  const beginIndex = findOffsetInRoot(containerEl, range.startContainer, range.startOffset);
  const endIndex = findOffsetInRoot(containerEl, range.endContainer, range.endOffset);
  if (beginIndex === null || endIndex === null) return null;

  const b = Math.min(beginIndex, endIndex);
  const e = Math.max(beginIndex, endIndex);
  if (b >= e) return null;

  if (placeholderEl && containerEl.contains(placeholderEl)) {
    // Compute the offset where placeholder starts (first text node contained in placeholder)
    const walker = document.createTreeWalker(containerEl, NodeFilter.SHOW_TEXT);
    let acc = 0;
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const t = n as Text;
      if (placeholderEl.contains(t)) {
        // Trim selection end to start of placeholder
        if (acc <= b) {
          return null;
        }
        return {
          beginIndex: b,
          endIndex: acc,
          text: normalizeTextForIndexes(sel.toString()),
          range,
          rect: range.getBoundingClientRect(),
        };
      }
      acc += nodeTextLen(t);
    }
  }

  return {
    beginIndex: b,
    endIndex: e,
    text: normalizeTextForIndexes(selectedText),
    range,
    rect: range.getBoundingClientRect(),
  };
}

export function clearNativeSelection() {
  const sel = window.getSelection?.();
  try {
    sel?.removeAllRanges();
  } catch {
    // ignore
  }
}

export function removeAllHighlights(root: ParentNode = document) {
  const marks = Array.from(root.querySelectorAll('mark.sel-text-highlight'));
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) continue;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  }
}

export function applyHighlightByOffsets(containerEl: HTMLElement, beginIndex: number, endIndex: number) {
  // Remove existing in this container
  removeAllHighlights(containerEl);

  const start = Math.max(0, Math.min(beginIndex, endIndex));
  const end = Math.max(0, Math.max(beginIndex, endIndex));
  if (start >= end) return;

  let acc = 0;
  const walker = document.createTreeWalker(containerEl, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;
  while (node) {
    const next = walker.nextNode() as Text | null; // prefetch next before DOM edits

    const val = node.nodeValue || '';
    const len = val.length;
    const nodeStart = acc;
    const nodeEnd = acc + len;

    if (nodeEnd > start && nodeStart < end) {
      const overlapStart = Math.max(0, start - nodeStart);
      const overlapEnd = Math.min(len, end - nodeStart);
      if (overlapStart < overlapEnd) {
        let mid: Text = node;
        if (overlapStart > 0) {
          mid = mid.splitText(overlapStart);
        }
        if (overlapEnd - overlapStart < mid.nodeValue!.length) {
          mid.splitText(overlapEnd - overlapStart);
        }

        const mark = document.createElement('mark');
        mark.className = 'sel-text-highlight';
        mid.parentNode?.insertBefore(mark, mid);
        mark.appendChild(mid);
      }
    }

    acc += len;
    node = next;
  }
}


