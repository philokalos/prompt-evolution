/**
 * Text Selection Module
 *
 * Uses AppleScript to capture selected text from the frontmost application
 * by simulating Cmd+C and detecting clipboard changes.
 */

import { exec } from 'child_process';
import { clipboard } from 'electron';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Delay helper
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Try to get selected text from the frontmost application.
 *
 * Flow:
 * 1. Save current clipboard content
 * 2. Simulate Cmd+C via AppleScript
 * 3. Wait for clipboard to update
 * 4. Check if clipboard changed
 * 5. Return new text if changed, null if not
 *
 * @returns Selected text if any, or null if no selection
 */
export async function tryGetSelectedText(): Promise<string | null> {
  // Only works on macOS
  if (process.platform !== 'darwin') {
    return null;
  }

  const originalClipboard = clipboard.readText();

  try {
    // AppleScript to simulate Cmd+C in frontmost app
    // This requires Accessibility permission
    const script = `
      tell application "System Events"
        keystroke "c" using command down
      end tell
    `;

    await execAsync(`osascript -e '${script}'`);

    // Wait for clipboard to update (50-100ms is usually enough)
    await delay(80);

    const newClipboard = clipboard.readText();

    // Check if clipboard changed (text was selected and copied)
    if (newClipboard && newClipboard !== originalClipboard) {
      console.log('[TextSelection] Captured selected text:', newClipboard.substring(0, 50) + '...');
      return newClipboard;
    }

    // No selection or same content
    console.log('[TextSelection] No new selection detected, using existing clipboard');
    return null;
  } catch (error) {
    // AppleScript may fail if:
    // - Accessibility permission not granted
    // - App is in a mode that blocks keyboard simulation
    console.warn('[TextSelection] AppleScript failed:', error);
    return null;
  }
}

/**
 * Check if Accessibility permissions are granted.
 * Required for AppleScript keyboard simulation.
 *
 * @returns true if permission granted, false otherwise
 */
export async function checkAccessibilityPermission(): Promise<boolean> {
  if (process.platform !== 'darwin') {
    return true; // Not applicable on non-macOS
  }

  try {
    // This will fail if accessibility isn't granted
    await execAsync(`osascript -e 'tell application "System Events" to return 1'`);
    return true;
  } catch {
    console.warn('[TextSelection] Accessibility permission not granted');
    return false;
  }
}

/**
 * Result of text capture with source information.
 */
export interface TextCaptureResult {
  text: string | null;
  source: 'selection' | 'clipboard';
}

/**
 * Get text for analysis using the best available method.
 *
 * Priority:
 * 1. Selected text (via AppleScript)
 * 2. Existing clipboard content
 *
 * @returns Text and its source
 */
export async function captureTextForAnalysis(): Promise<TextCaptureResult> {
  // Try to get selected text first
  const selectedText = await tryGetSelectedText();

  if (selectedText) {
    return {
      text: selectedText,
      source: 'selection',
    };
  }

  // Fall back to existing clipboard
  const clipboardText = clipboard.readText();
  return {
    text: clipboardText || null,
    source: 'clipboard',
  };
}
