// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

import { useTranslation } from 'react-i18next'
import { setAppLanguage } from '../i18n'

export default function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n, t } = useTranslation()
  const lang = i18n.language.startsWith('es') ? 'es' : 'en'

  return (
    <label className={className ?? 'flex items-center gap-2 text-sm text-slate-400'}>
      <span className="sr-only">{t('common.language')}</span>
      <select
        value={lang}
        onChange={(e) => setAppLanguage(e.target.value === 'es' ? 'es' : 'en')}
        className="bg-slate-800/80 border border-slate-600/50 rounded-lg px-2 py-1 text-slate-200"
        aria-label={t('common.language')}
      >
        <option value="en">English</option>
        <option value="es">Español</option>
      </select>
    </label>
  )
}
