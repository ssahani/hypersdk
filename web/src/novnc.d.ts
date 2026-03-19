declare module '@novnc/novnc/lib/rfb.js' {
  interface RFBCredentials {
    password?: string
  }

  interface RFBOptions {
    credentials?: RFBCredentials
    shared?: boolean
    wsProtocols?: string[]
  }

  export default class RFB {
    constructor(target: HTMLElement, urlOrChannel: string | WebSocket, options?: RFBOptions)

    scaleViewport: boolean
    resizeSession: boolean
    showDotCursor: boolean
    viewOnly: boolean
    clipViewport: boolean
    dragViewport: boolean
    focusOnClick: boolean

    disconnect(): void
    sendCredentials(credentials: RFBCredentials): void
    sendKey(keysym: number, code: string, down?: boolean): void
    sendCtrlAltDel(): void
    machineShutdown(): void
    machineReboot(): void
    machineReset(): void

    addEventListener(type: string, listener: (event: any) => void): void
    removeEventListener(type: string, listener: (event: any) => void): void
  }
}
