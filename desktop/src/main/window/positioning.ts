/**
 * Window Positioning Module
 * Handles cursor-relative window positioning for multi-monitor setups.
 */

import { screen, type BrowserWindow } from 'electron';

/**
 * Position the window near the mouse cursor.
 * Places window to the right of cursor, or left if not enough space.
 * Handles multi-monitor setups correctly.
 *
 * @param window - The BrowserWindow to position
 */
export function positionWindowNearCursor(window: BrowserWindow): void {
  if (!window || window.isDestroyed()) return;

  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const { width: screenW, height: screenH } = display.workAreaSize;
  const { x: screenX, y: screenY } = display.workArea;
  const [winW, winH] = window.getSize();

  // Position to the right of cursor (20px gap)
  let x = cursor.x + 20;
  let y = cursor.y - Math.floor(winH / 2); // Vertical center alignment

  // If overflows right edge, position to the left
  if (x + winW > screenX + screenW) {
    x = cursor.x - winW - 20;
  }

  // Clamp to screen bounds
  if (y < screenY) y = screenY + 10;
  if (y + winH > screenY + screenH) y = screenY + screenH - winH - 10;

  window.setPosition(x, y);
  console.log(`[Window] Positioned at ${x}, ${y} (cursor: ${cursor.x}, ${cursor.y})`);
}

/**
 * Get the display nearest to a given point
 *
 * @param point - Screen coordinates
 * @returns Display information
 */
export function getDisplayNearPoint(point: { x: number; y: number }): Electron.Display {
  return screen.getDisplayNearestPoint(point);
}

/**
 * Get current cursor position
 *
 * @returns Cursor screen coordinates
 */
export function getCursorPosition(): { x: number; y: number } {
  return screen.getCursorScreenPoint();
}
