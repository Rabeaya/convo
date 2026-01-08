/**
 * AngularJS parity: textSelections service (subset)
 *
 * Focus: nested text selection playback/highlight used in Feed + Comments.
 *
 * Mirrors:
 * - selectText('nested', options)
 * - rmSelectionById / rmAllSelections
 * - caching + max 2 highlighted snippets
 * - invisible highlight -> visible highlight after scroll/timing
 */

export type TextSelectionsOptions = {
  commentId: string;
  data: { beginIndex: any; endIndex: any; text?: string };
  nodes: HTMLElement; // root container to search in
  scrollContainer: HTMLElement; // scrolling container
  highlight: boolean;
  highlightRemoveTime: number | null;
  selectionOffset?: number;
  getContent: () => string;
  complete?: (rangeDimensions: { nodes: HTMLElement[]; top: number; left: number; height: number; width: number }) => void;
  failure?: () => void;
};

type AnnotationInfo = {
  nodes: HTMLElement[];
  containerScrollTop: number;
  position: number;
  timerDelay?: number | null;
  timingFuncId?: number | null;
};

const TXT_SEL_CLAS_NAME = 'sel-text-highlight';
const TXT_SEL_INV_CLAS_NAME = 'sel-text-invisible-highlight';

const SEARCH_BUFFER_LENGTH = 25;

let _snippetPosition = 1;
const _annotations: Record<string, AnnotationInfo> = {};

function clampInt(n: any, fallback: number) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.floor(v) : fallback;
}

function validateSnippetData(opts: TextSelectionsOptions) {
  const sd = opts.data as any;
  sd.beginIndex = sd.beginIndex || 0;
  sd.endIndex = sd.endIndex || 1;
  if (sd.endIndex <= sd.beginIndex) sd.endIndex = sd.beginIndex + 1;
  const content = opts.getContent?.() || '';
  if (!content || sd.beginIndex > content.length) return false;
  return true;
}

function unwrapSpan(span: HTMLElement) {
  const parent = span.parentNode;
  if (!parent) return;
  while (span.firstChild) parent.insertBefore(span.firstChild, span);
  parent.removeChild(span);
  parent.normalize();
}

function rmSelectionById(commentId: string) {
  const ann = _annotations[commentId];
  if (!ann) return;
  ann.nodes.forEach((n) => {
    if (n.classList.contains(TXT_SEL_CLAS_NAME) || n.classList.contains(TXT_SEL_INV_CLAS_NAME)) {
      unwrapSpan(n);
    }
  });
  if (ann.timingFuncId) {
    clearTimeout(ann.timingFuncId);
  }
  delete _annotations[commentId];
}

export function rmAllSelections() {
  Object.keys(_annotations).forEach(rmSelectionById);
}

function calcSelDimensions(nodes: HTMLElement[]) {
  if (!nodes.length) return { top: 0, left: 0, height: 0, width: 0, nodes };
  const first = nodes[0];
  const firstRect = first.getBoundingClientRect();
  const last = nodes[nodes.length - 1];
  const lastRect = last.getBoundingClientRect();
  const height = lastRect.top - firstRect.top + lastRect.height;

  // width: max line width approximation
  let maxWidth = firstRect.width;
  let lineTop = firstRect.top;
  let lineLeft = firstRect.left;
  for (const n of nodes) {
    const r = n.getBoundingClientRect();
    if (r.top !== lineTop) {
      lineTop = r.top;
      lineLeft = r.left;
    }
    maxWidth = Math.max(maxWidth, r.left - lineLeft + r.width);
  }
  return { top: firstRect.top, left: firstRect.left, height, width: maxWidth, nodes };
}

function findTextNodeAtOffset(root: HTMLElement, offset: number): { node: Text; nodeOffset: number } | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let acc = 0;
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const t = n as Text;
    const len = (t.nodeValue || '').length;
    if (acc + len >= offset) {
      return { node: t, nodeOffset: Math.max(0, offset - acc) };
    }
    acc += len;
  }
  return null;
}

function greedySearchFallback(content: string, beginIndex: number, endIndex: number, snippetText?: string) {
  if (!snippetText) return null;
  const bufStart = Math.max(0, beginIndex - SEARCH_BUFFER_LENGTH);
  const bufEnd = Math.min(content.length, endIndex + SEARCH_BUFFER_LENGTH);
  const buf = content.slice(bufStart, bufEnd);
  const idx = buf.indexOf(snippetText);
  if (idx === -1) return null;
  const foundBegin = bufStart + idx;
  return { beginIndex: foundBegin, endIndex: foundBegin + snippetText.length };
}

function cachedSearch(commentId: string, opts: TextSelectionsOptions): boolean {
  const ann = _annotations[commentId];
  if (!ann) return false;

  if (ann.timingFuncId && ann.timerDelay) {
    clearTimeout(ann.timingFuncId);
    ann.timingFuncId = window.setTimeout(() => rmSelectionById(commentId), ann.timerDelay);
  }

  opts.scrollContainer.scrollTo({ top: ann.containerScrollTop, behavior: 'smooth' });
  if (opts.complete) {
    opts.complete(calcSelDimensions(ann.nodes));
  }

  // move to back of queue
  ann.position = _snippetPosition++;
  return true;
}

function enforceMaxTwoHighlights() {
  const keys = Object.keys(_annotations);
  if (keys.length <= 2) return;
  let smallestKey = keys[0];
  let smallestPos = _snippetPosition;
  for (const k of keys) {
    if (_annotations[k].position < smallestPos) {
      smallestPos = _annotations[k].position;
      smallestKey = k;
    }
  }
  rmSelectionById(smallestKey);
}

function wrapByOffsets(root: HTMLElement, beginIndex: number, endIndex: number, commentId: string): HTMLElement[] {
  const spans: HTMLElement[] = [];
  const start = Math.max(0, Math.min(beginIndex, endIndex));
  const end = Math.max(0, Math.max(beginIndex, endIndex));
  if (start >= end) return spans;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let acc = 0;
  let node = walker.nextNode() as Text | null;
  while (node) {
    const next = walker.nextNode() as Text | null; // prefetch before DOM edits
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

        const span = document.createElement('span');
        span.className = TXT_SEL_INV_CLAS_NAME;
        (span as any).dataset.commentId = commentId;
        mid.parentNode?.insertBefore(span, mid);
        span.appendChild(mid);
        spans.push(span);
      }
    }

    acc += len;
    node = next;
  }

  return spans;
}

function computeNewScrollTop(scrollContainer: HTMLElement, firstNode: HTMLElement, gutterOffset: number) {
  const scRect = scrollContainer.getBoundingClientRect();
  const nRect = firstNode.getBoundingClientRect();
  let newScrollTop = scrollContainer.scrollTop + (nRect.top - scRect.top);

  if (newScrollTop - gutterOffset < scrollContainer.scrollTop) {
    newScrollTop -= gutterOffset;
  } else if (newScrollTop + gutterOffset > scrollContainer.scrollTop + scrollContainer.offsetHeight) {
    const height = nRect.height;
    newScrollTop = newScrollTop + height - scrollContainer.offsetHeight + gutterOffset;
  } else {
    newScrollTop = scrollContainer.scrollTop;
  }
  return Math.max(0, newScrollTop);
}

export function selectTextNested(opts: TextSelectionsOptions) {
  const commentId = opts.commentId;
  if (!commentId) return;

  if (cachedSearch(commentId, opts)) return;

  if (!validateSnippetData(opts)) {
    opts.failure?.();
    return;
  }

  const content = opts.getContent();
  let beginIndex = clampInt(opts.data.beginIndex, 0);
  let endIndex = clampInt(opts.data.endIndex, beginIndex + 1);

  const expected = opts.data.text || '';
  if (expected) {
    const slice = content.slice(beginIndex, endIndex);
    if (slice !== expected) {
      const fb = greedySearchFallback(content, beginIndex, endIndex, expected);
      if (fb) {
        beginIndex = fb.beginIndex;
        endIndex = fb.endIndex;
      }
    }
  }

  // Remove existing highlight for this id
  rmSelectionById(commentId);

  // Apply invisible highlight
  const nodes = wrapByOffsets(opts.nodes, beginIndex, endIndex, commentId);
  if (!nodes.length) {
    opts.failure?.();
    return;
  }

  // Scroll into view + then swap classes
  const gutterOffset = opts.selectionOffset || 100;
  const newScrollTop = computeNewScrollTop(opts.scrollContainer, nodes[0], gutterOffset);

  const finish = () => {
    setTimeout(() => {
      if (opts.highlight) {
        nodes.forEach((n) => {
          n.classList.remove(TXT_SEL_INV_CLAS_NAME);
          n.classList.add(TXT_SEL_CLAS_NAME);
        });
      }

      _annotations[commentId] = {
        nodes,
        containerScrollTop: newScrollTop,
        position: _snippetPosition++,
      };

      if (opts.highlightRemoveTime) {
        _annotations[commentId].timerDelay = opts.highlightRemoveTime;
        _annotations[commentId].timingFuncId = window.setTimeout(() => rmSelectionById(commentId), opts.highlightRemoveTime);
      }

      enforceMaxTwoHighlights();

      if (opts.complete) {
        const dim = calcSelDimensions(nodes);
        opts.complete(dim);
      }
    }, 200);
  };

  if (Math.abs(newScrollTop - opts.scrollContainer.scrollTop) > 0) {
    opts.scrollContainer.scrollTo({ top: newScrollTop, behavior: 'smooth' });
    // Approximate Angular animate duration 400ms
    setTimeout(finish, 400);
  } else {
    finish();
  }
}


