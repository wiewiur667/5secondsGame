// Text hygiene for player-typed answers. Pure — no state, easy to test.

export const MAX_ANSWER = 60 // characters (code points), enforced server-side

// What we store and show: NFC, no control / zero-width / bidi-override chars,
// whitespace collapsed, trimmed, capped at MAX_ANSWER code points.
export function cleanAnswer(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const s = raw
    .normalize('NFC')
    .replace(/[​-‏‪-‮⁠-⁩﻿]/g, '')
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return Array.from(s).slice(0, MAX_ANSWER).join('').trim()
}

// Comparison key for "Telepatia" (identical answers): case-, diacritic- and
// punctuation-insensitive, so "Żółw!" matches "zolw". `ł` has no Unicode
// decomposition, so it is mapped by hand.
export function sameKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[łŁ]/g, 'l')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
