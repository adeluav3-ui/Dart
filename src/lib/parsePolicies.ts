import { cache } from 'react'
import fs from 'fs'
import path from 'path'

// ── Types ──────────────────────────────────────────────────────────────────────

export type Block =
  | { kind: 'para'; text: string }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'table'; cols: number; rows: string[][] }

export interface PolicySection {
  heading: string
  blocks: Block[]
}

export interface PolicyPage {
  slug: 'terms' | 'privacy' | 'refunds'
  title: string
  lastUpdated: string  // raw, may contain [DATE] placeholder
  preamble: string
  sections: PolicySection[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SECTION_TITLES = ['Terms of Use', 'Privacy Policy', 'Refund Policy'] as const
const SLUGS: PolicyPage['slug'][] = ['terms', 'privacy', 'refunds']
const STOP_MARKER = 'Notes for legal review'

// Which sectionIndex-subsectionNumber has a table, and how many columns?
// 0=terms, 1=privacy, 2=refunds
const TABLE_COLS: Record<string, number> = {
  '1-1': 3,  // Privacy §1 "What we collect"
  '2-1': 2,  // Refunds §1 "When you get a refund"
}

// ── Placeholder substitution ──────────────────────────────────────────────────

// Maps the exact text inside [BRACKETS] → app_settings key
const PLACEHOLDER_MAP: Record<string, string> = {
  'COMPANY LEGAL NAME':                              'company_name',
  'NUMBER':                                          'company_rc_number',
  'REGISTERED ADDRESS':                              'company_address',
  'Monnify / Moniepoint Microfinance Bank — confirm':'payment_partner_name',
  'SUPPORT EMAIL':                                   'support_email',
  'SUPPORT PHONE':                                   'support_phone',
  'PRIVACY EMAIL':                                   'privacy_email',
}

/**
 * Replaces [BRACKET] placeholders with values from settings.
 * The caller passes DATE mapped to the section-specific key.
 * Unknown or empty settings: the bracket text is left visible.
 */
export function applySettings(
  text: string,
  settings: Record<string, string>,
  dateValue?: string,
): string {
  return text.replace(/\[([^\]]+)\]/g, (match, key: string) => {
    if (key === 'DATE') return dateValue || match
    const settingsKey = PLACEHOLDER_MAP[key]
    if (settingsKey) {
      const v = settings[settingsKey]
      return v ? v : match
    }
    return match
  })
}

// ── Parser ────────────────────────────────────────────────────────────────────

export const parsePolicies = cache((): PolicyPage[] => {
  const raw = fs.readFileSync(
    path.join(process.cwd(), 'content', 'legal', 'policies.md'),
    'utf8',
  )
  const lines = raw.split('\n').map(l => l.trim())

  // Find start index of each major section + the stop marker
  const starts: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if ((SECTION_TITLES as readonly string[]).includes(lines[i]) || lines[i] === STOP_MARKER) {
      starts.push(i)
    }
  }

  return SECTION_TITLES.map((title, s): PolicyPage => {
    const from = starts[s] + 1
    const to   = starts[s + 1] ?? lines.length
    const raw  = lines.slice(from, to)

    let lastUpdated = ''
    let preamble    = ''
    const sections: PolicySection[] = []
    let i = 0

    while (i < raw.length) {
      const line = raw[i]

      if (!line) { i++; continue }

      // "Last updated: ..." line
      if (line.startsWith('Last updated:')) {
        lastUpdated = line.replace('Last updated:', '').trim()
        i++
        continue
      }

      // Numbered subsection heading  e.g. "3. Delivery areas"
      const headingMatch = line.match(/^(\d+)\.\s+(.+)$/)
      if (headingMatch) {
        const subsNum = parseInt(headingMatch[1])
        const tableKey = `${s}-${subsNum}`
        const colCount = TABLE_COLS[tableKey]
        i++

        const blocks: Block[] = []

        if (colCount) {
          // Collect all non-empty lines until the next numbered heading
          const tableLines: string[] = []
          while (i < raw.length) {
            const tl = raw[i]
            if (!tl) { i++; continue }
            if (tl.match(/^\d+\.\s/)) break
            tableLines.push(tl)
            i++
          }
          // Group into rows of colCount
          const rows: string[][] = []
          for (let r = 0; r < tableLines.length; r += colCount) {
            const row = tableLines.slice(r, r + colCount)
            if (row.length === colCount) rows.push(row)
          }
          blocks.push({ kind: 'table', cols: colCount, rows })
        } else {
          // Paragraphs + bullets until next numbered heading
          while (i < raw.length) {
            const cl = raw[i]
            if (!cl) { i++; continue }
            if (cl.match(/^\d+\.\s/)) break

            if (cl.startsWith('•')) {
              const items: string[] = []
              while (i < raw.length && raw[i]?.startsWith('•')) {
                items.push(raw[i].slice(1).trim())
                i++
              }
              blocks.push({ kind: 'bullets', items })
            } else {
              blocks.push({ kind: 'para', text: cl })
              i++
            }
          }
        }

        sections.push({ heading: line, blocks })
        continue
      }

      // Content before first numbered heading = preamble paragraph
      if (sections.length === 0) {
        preamble = preamble ? `${preamble} ${line}` : line
        i++
        continue
      }

      i++
    }

    return { slug: SLUGS[s], title, lastUpdated, preamble, sections }
  })
})
