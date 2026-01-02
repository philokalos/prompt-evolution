/**
 * Text Selection Module
 *
 * Uses AppleScript to capture selected text from the frontmost application
 * by simulating Cmd+C and detecting clipboard changes.
 */

import { exec } from 'child_process';
import { clipboard, systemPreferences, dialog, shell } from 'electron';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Delay helper
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Apps that don't work well with keystroke simulation.
 * These apps may crash or behave unexpectedly when receiving simulated Cmd+C.
 * For these apps, we skip selection capture and use clipboard only.
 */
const BLOCKED_APPS = [
  'Cursor',           // Electron-based IDE - crashes with simulated keystrokes
  'Code',             // VS Code - may have similar issues
  'Claude',           // Claude desktop app
  'Terminal',         // Terminal apps handle clipboard differently
  'iTerm2',
  'Warp',
  'Hyper',
];

/**
 * Get the name of the frontmost application.
 * @returns Application name or null if detection fails
 */
export async function getFrontmostApp(): Promise<string | null> {
  if (process.platform !== 'darwin') {
    return null;
  }

  try {
    const script = `
      tell application "System Events"
        set frontApp to name of first application process whose frontmost is true
        return frontApp
      end tell
    `;
    const { stdout } = await execAsync(`osascript -e '${script}'`);
    return stdout.trim();
  } catch (error) {
    console.warn('[TextSelection] Failed to get frontmost app:', error);
    return null;
  }
}

/**
 * Check if the given app is in the blocklist for keystroke simulation.
 * @param appName - Name of the application
 * @returns true if app should be blocked, false otherwise
 */
function isBlockedApp(appName: string | null): boolean {
  if (!appName) return false;
  return BLOCKED_APPS.some((blocked) =>
    appName.toLowerCase().includes(blocked.toLowerCase())
  );
}

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

  // Check if frontmost app is in blocklist
  const frontApp = await getFrontmostApp();
  if (isBlockedApp(frontApp)) {
    // Return current clipboard content instead of simulating Cmd+C
    const clipboardText = clipboard.readText();
    console.log(`[TextSelection] Blocked app: ${frontApp}, clipboard content: "${clipboardText?.substring(0, 50) || '(empty)'}"`);
    return clipboardText || null;
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
 * @param promptIfNeeded - If true, triggers system permission prompt
 * @returns true if permission granted, false otherwise
 */
export function checkAccessibilityPermission(promptIfNeeded = false): boolean {
  if (process.platform !== 'darwin') {
    return true; // Not applicable on non-macOS
  }

  const isTrusted = systemPreferences.isTrustedAccessibilityClient(promptIfNeeded);
  console.log(`[TextSelection] Accessibility permission: ${isTrusted ? 'granted' : 'not granted'}`);
  return isTrusted;
}

/**
 * Show a dialog explaining why accessibility permission is needed
 * and offer to open System Preferences.
 *
 * @returns true if user clicked "Open Settings", false otherwise
 */
export async function showAccessibilityPermissionDialog(): Promise<boolean> {
  const result = await dialog.showMessageBox({
    type: 'info',
    title: '접근성 권한 필요',
    message: '텍스트 선택 캡처 기능을 사용하려면 접근성 권한이 필요합니다.',
    detail:
      'PromptLint가 다른 앱에서 선택한 텍스트를 자동으로 복사하려면 ' +
      '시스템 환경설정 > 개인정보 보호 및 보안 > 접근성에서 PromptLint를 허용해주세요.\n\n' +
      '권한 없이도 클립보드에 복사된 텍스트는 분석할 수 있습니다.',
    buttons: ['설정 열기', '나중에'],
    defaultId: 0,
    cancelId: 1,
  });

  if (result.response === 0) {
    // Open System Preferences > Privacy & Security > Accessibility
    shell.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
    );
    return true;
  }

  return false;
}

/**
 * Result of text capture with source information.
 */
export interface TextCaptureResult {
  text: string | null;
  source: 'selection' | 'clipboard';
}

/**
 * Result of applying improved text to an app.
 */
export interface ApplyTextResult {
  success: boolean;
  fallback?: 'clipboard';
  message?: string;
}

/**
 * Capture mode determines how text is captured for analysis.
 */
export type CaptureMode = 'auto' | 'selection' | 'clipboard';

/**
 * Get text for analysis using the specified capture mode.
 *
 * Modes:
 * - auto: Try selected text first, fall back to clipboard (default)
 * - selection: Only capture selected text (via AppleScript)
 * - clipboard: Only use existing clipboard content
 *
 * @param mode - Capture mode (default: 'auto')
 * @returns Text and its source
 */
export async function captureTextForAnalysis(
  mode: CaptureMode = 'auto'
): Promise<TextCaptureResult> {
  if (mode === 'clipboard') {
    // Clipboard only mode
    const clipboardText = clipboard.readText();
    return {
      text: clipboardText || null,
      source: 'clipboard',
    };
  }

  // Try to get selected text (for 'auto' and 'selection' modes)
  const selectedText = await tryGetSelectedText();

  if (selectedText) {
    return {
      text: selectedText,
      source: 'selection',
    };
  }

  // For 'selection' mode, don't fall back to clipboard
  if (mode === 'selection') {
    return {
      text: null,
      source: 'selection',
    };
  }

  // For 'auto' mode, fall back to existing clipboard
  const clipboardText = clipboard.readText();
  return {
    text: clipboardText || null,
    source: 'clipboard',
  };
}

/**
 * Apply improved text to the source application.
 *
 * Flow:
 * 1. Write text to clipboard
 * 2. If app is blocked, return clipboard fallback
 * 3. Otherwise, activate app and simulate Cmd+A + Cmd+V
 *
 * @param text - The improved text to apply
 * @param appName - Name of the target application
 * @returns Result with success status and optional fallback message
 */
export async function applyTextToApp(
  text: string,
  appName: string
): Promise<ApplyTextResult> {
  // Always write to clipboard first
  clipboard.writeText(text);

  // Only works on macOS
  if (process.platform !== 'darwin') {
    return {
      success: false,
      fallback: 'clipboard',
      message: '클립보드에 복사됨 - Cmd+V로 붙여넣기 해주세요',
    };
  }

  // Check if app is blocked (doesn't work well with AppleScript)
  if (isBlockedApp(appName)) {
    console.log(`[TextSelection] Blocked app: ${appName}, using clipboard fallback`);
    return {
      success: false,
      fallback: 'clipboard',
      message: '클립보드에 복사됨 - Cmd+V로 붙여넣기 해주세요',
    };
  }

  try {
    // AppleScript to:
    // 1. Activate the source app
    // 2. Select all (Cmd+A)
    // 3. Paste (Cmd+V)
    const script = `
      tell application "${appName}" to activate
      delay 0.15
      tell application "System Events"
        keystroke "a" using command down
        delay 0.05
        keystroke "v" using command down
      end tell
    `;

    await execAsync(`osascript -e '${script}'`);
    console.log(`[TextSelection] Successfully applied text to ${appName}`);
    return { success: true };
  } catch (error) {
    console.warn('[TextSelection] Failed to apply text via AppleScript:', error);
    return {
      success: false,
      fallback: 'clipboard',
      message: '클립보드에 복사됨 - Cmd+V로 붙여넣기 해주세요',
    };
  }
}

