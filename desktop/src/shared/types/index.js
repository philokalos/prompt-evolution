"use strict";
/**
 * Shared Types Index
 * Barrel export for all desktop-specific shared types.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPC_SEND_CHANNELS = exports.IPC_INVOKE_CHANNELS = void 0;
// IPC channel constants and types
var ipc_js_1 = require("./ipc.js");
Object.defineProperty(exports, "IPC_INVOKE_CHANNELS", { enumerable: true, get: function () { return ipc_js_1.IPC_INVOKE_CHANNELS; } });
Object.defineProperty(exports, "IPC_SEND_CHANNELS", { enumerable: true, get: function () { return ipc_js_1.IPC_SEND_CHANNELS; } });
