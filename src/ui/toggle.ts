/**
 * The Level 1 toggle button (T-GNR-105, docs/ui-behavior.md section 2.2).
 *
 * Built only with createElement/createElementNS: never from an HTML string (docs/security-privacy.md
 * section 2). A native <button type="button"> already handles click, Enter and Space.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Primer Octicons `chevron-right` (16 px), MIT licensed (see NOTICE). Copied from the path GitHub
 * itself serves (ref-docs/raw, 2026-11-15). CSS rotates it 90 degrees when the listing is expanded.
 */
const CHEVRON_RIGHT =
  'M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z';

export const TOGGLE_MARK = 'toggle';
export const LABEL_SHOW = 'Show files';
export const LABEL_HIDE = 'Hide files';

function chevron(doc: Document): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', 'gnr-chevron');
  const path = doc.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', CHEVRON_RIGHT);
  path.setAttribute('fill', 'currentColor');
  svg.appendChild(path);
  return svg;
}

/** A new toggle for the listing whose container id is `controlsId`. */
export function createToggle(doc: Document, controlsId: string): HTMLButtonElement {
  const button = doc.createElement('button');
  button.type = 'button';
  button.setAttribute('data-gnr', TOGGLE_MARK);
  button.className = 'gnr-toggle';
  button.setAttribute('aria-controls', controlsId);
  button.appendChild(chevron(doc));
  setToggleExpanded(button, false);
  return button;
}

/** Mirrors the listing state on the button: `aria-expanded` and the accessible name. */
export function setToggleExpanded(button: HTMLButtonElement, expanded: boolean): void {
  button.setAttribute('aria-expanded', String(expanded));
  button.setAttribute('aria-label', expanded ? LABEL_HIDE : LABEL_SHOW);
  button.title = expanded ? LABEL_HIDE : LABEL_SHOW;
}
