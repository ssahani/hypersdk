// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

declare module '/novnc/core/rfb.js' {
  export interface RFBOptions {
    credentials?: Record<string, unknown>
    shared?: boolean
    repeaterID?: string
    showDotCursor?: boolean
  }

  export default class RFB {
    constructor(target: HTMLElement, url: string, options?: RFBOptions);
    scaleViewport: boolean;
    clipViewport: boolean;
    resizeSession: boolean;
    focusOnClick: boolean;
    showDotCursor: boolean;
    addEventListener(event: string, callback: (e: unknown) => void): void;
    sendCredentials(creds: { password: string }): void;
    sendCtrlAltDel(): void;
    disconnect(): void;
  }
}

declare module 'novnc-core/lib/rfb' {
  export interface RFBOptions {
    credentials?: Record<string, unknown>
    shared?: boolean
    repeaterID?: string
    showDotCursor?: boolean
  }

  export default class RFB {
    constructor(target: HTMLElement, url: string, options?: RFBOptions);
    scaleViewport: boolean;
    clipViewport: boolean;
    resizeSession: boolean;
    focusOnClick: boolean;
    showDotCursor: boolean;
    addEventListener(event: string, callback: (e: unknown) => void): void;
    sendCredentials(creds: { password: string }): void;
    sendCtrlAltDel(): void;
    disconnect(): void;
  }
}
