/**
 * IPC Handler: Copy & Switch
 * For blocked apps — copies to clipboard and switches focus.
 */

import { ipcMain } from 'electron';
import type { CopyAndSwitchResult } from '../text-selection.js';

export interface CopySwitchHandlerDeps {
  copyAndSwitch: (text: string, sourceApp: string) => Promise<CopyAndSwitchResult>;
  hideWindow: () => void;
}

export function registerCopySwitchHandler(deps: CopySwitchHandlerDeps): void {
  const { copyAndSwitch, hideWindow } = deps;

  ipcMain.handle(
    'copy-and-switch',
    async (_event, payload: { text: string; sourceApp: string }) => {
      const { text, sourceApp } = payload;

      if (!text) {
        return {
          success: false,
          copiedToClipboard: false,
          appSwitched: false,
          message: 'No text provided',
        };
      }

      const result = await copyAndSwitch(text, sourceApp);

      if (result.copiedToClipboard) {
        hideWindow();
      }

      return result;
    }
  );
}
