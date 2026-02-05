import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Check if the app is running in MAS (Mac App Store) sandbox mode.
 * Centralized utility to ensure consistent behavior across modules.
 */
let _isMASBuild: boolean | null = null;

export function isMASBuild(): boolean {
    if (_isMASBuild !== null) {
        return _isMASBuild;
    }

    if (!app.isPackaged) {
        _isMASBuild = false;
        return false;
    }

    try {
        // 1. Check for MAS receipt file (only present in MAS-distributed apps)
        const receiptPath = path.join(app.getAppPath(), '..', '_MASReceipt', 'receipt');
        if (fs.existsSync(receiptPath)) {
            console.log('[EnvUtil] MAS receipt found');
            _isMASBuild = true;
            return true;
        }

        // 2. Check for sandbox container path
        const homePath = app.getPath('home');
        if (homePath.includes('/Library/Containers/')) {
            console.log('[EnvUtil] Sandbox container detected');
            _isMASBuild = true;
            return true;
        }

        // 3. Process environment variable (fallback/manual override)
        if (process.env.MAS === 'true') {
            _isMASBuild = true;
            return true;
        }
    } catch (error) {
        console.error('[EnvUtil] Error detecting MAS build:', error);
    }

    _isMASBuild = false;
    return false;
}
