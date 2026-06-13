// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

/** Thumbnail / theatre preview — no toolbar, scale to fit, no scrollbars. */
export const embeddedVncPreviewProps = {
  previewMode: true as const,
  defaultScaledFit: true as const,
  fillViewport: true as const,
  fillViewportOffset: '0',
}

/** Full-page console panel — keep toolbar, scale to fit, no scrollbars. */
export const fillViewportVncProps = {
  defaultScaledFit: true as const,
  fillViewport: true as const,
  fillViewportOffset: '0',
}
