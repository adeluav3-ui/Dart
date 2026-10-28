import type { Block, PolicyPage } from '@/lib/parsePolicies'
import { applySettings } from '@/lib/parsePolicies'

interface Props {
  policy: PolicyPage
  settings: Record<string, string>
  dateSettingKey: string
}

export function PolicyContent({ policy, settings, dateSettingKey }: Props) {
  const dateValue = settings[dateSettingKey] || undefined
  function sub(text: string) {
    return applySettings(text, settings, dateValue)
  }

  const lastUpdated = sub(policy.lastUpdated)

  return (
    <div className="flex flex-col gap-5">
      {lastUpdated && (
        <p className="text-[12px] text-ink-2">Last updated: {lastUpdated}</p>
      )}

      {policy.preamble && (
        <p className="text-[14px] text-ink-2 leading-relaxed">{sub(policy.preamble)}</p>
      )}

      {policy.sections.map((section, si) => (
        <div key={si} className="flex flex-col gap-3">
          <h2 className="text-[15px] font-bold text-ink">{sub(section.heading)}</h2>
          {section.blocks.map((block, bi) => (
            <BlockRenderer key={bi} block={block} sub={sub} />
          ))}
        </div>
      ))}
    </div>
  )
}

function BlockRenderer({ block, sub }: { block: Block; sub: (s: string) => string }) {
  if (block.kind === 'para') {
    return (
      <p className="text-[14px] text-ink-2 leading-relaxed">{sub(block.text)}</p>
    )
  }

  if (block.kind === 'bullets') {
    return (
      <ul className="flex flex-col gap-2">
        {block.items.map((item, i) => (
          <li key={i} className="flex gap-2.5 text-[14px] text-ink-2 leading-relaxed">
            <span className="shrink-0 mt-[3px] w-1 h-1 rounded-full bg-ink-2 self-start translate-y-[6px]" />
            <span>{sub(item)}</span>
          </li>
        ))}
      </ul>
    )
  }

  if (block.kind === 'table') {
    const [header, ...dataRows] = block.rows
    return (
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-[13px] border-collapse" style={{ minWidth: '360px' }}>
          <thead>
            <tr>
              {header?.map((cell, ci) => (
                <th
                  key={ci}
                  className="text-left py-2.5 px-3 font-semibold text-ink bg-surface border-b border-line"
                >
                  {sub(cell)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 1 ? 'bg-canvas' : 'bg-white'}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className="py-2.5 px-3 text-ink-2 border-b border-line align-top last:border-b-0"
                  >
                    {sub(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return null
}
