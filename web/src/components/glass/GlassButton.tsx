// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import type { ButtonHTMLAttributes, ReactNode } from 'react'

type GlassButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export type GlassButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: GlassButtonVariant
  children: ReactNode
}

const variantClass: Record<GlassButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'glass px-5 py-2.5 rounded-liquid border-white/10 hover:bg-white/5 active:scale-[0.985] transition-all text-[var(--text-primary)]',
  danger: 'glass px-5 py-2.5 rounded-liquid border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20 active:scale-[0.985] transition-all',
}

export function GlassButton({
  variant = 'primary',
  className = '',
  type = 'button',
  children,
  ...props
}: GlassButtonProps) {
  return (
    <button type={type} className={`${variantClass[variant]} ${className}`.trim()} {...props}>
      {children}
    </button>
  )
}
