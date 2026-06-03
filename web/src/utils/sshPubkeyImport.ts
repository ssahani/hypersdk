// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

/** Read an OpenSSH `.pub` file into the callback (wizard / template deploy). */
export function readSshPubkeyFile(file: File | undefined, onKey: (key: string) => void): void {
  if (!file) return
  if (!file.name.endsWith('.pub')) return
  const reader = new FileReader()
  reader.onload = () => {
    const text = String(reader.result ?? '').trim()
    if (text) onKey(text)
  }
  reader.readAsText(file)
}
