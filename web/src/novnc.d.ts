declare module '/novnc/core/rfb.js' {
  export default class RFB {
    constructor(target: HTMLElement, url: string, options?: Record<string, unknown>);
    scaleViewport: boolean;
    resizeSession: boolean;
    focusOnClick: boolean;
    addEventListener(event: string, callback: (e: unknown) => void): void;
    sendCredentials(creds: { password: string }): void;
    disconnect(): void;
  }
}

declare module 'novnc-core/lib/rfb' {
  export default class RFB {
    constructor(target: HTMLElement, url: string, options?: Record<string, unknown>);
    scaleViewport: boolean;
    resizeSession: boolean;
    focusOnClick: boolean;
    addEventListener(event: string, callback: (e: unknown) => void): void;
    sendCredentials(creds: { password: string }): void;
    disconnect(): void;
  }
}
