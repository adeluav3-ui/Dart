import Link from 'next/link'
import { getLegalDoc } from '@/lib/legal'
import { renderMarkdown } from '@/lib/renderMarkdown'
import type { LegalSlug } from '@/lib/legal'

interface Props {
  slug: LegalSlug
}

export default async function LegalPageShell({ slug }: Props) {
  const doc = getLegalDoc(slug)
  const html = renderMarkdown(doc.content)

  const subtitle = [
    doc.version ? `Version ${doc.version}` : null,
    doc.effective_date ? `Effective ${doc.effective_date}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-16">
      <Link href="/" className="text-sm text-brand font-semibold mb-6 inline-block">
        ← GoCart
      </Link>
      <h1 className="font-heading font-extrabold text-2xl text-ink mt-2">{doc.title}</h1>
      {subtitle && (
        <p className="text-sm text-ink-2 mt-1 mb-6">{subtitle}</p>
      )}
      <div
        className="prose prose-sm max-w-none text-ink
          [&_h2]:font-heading [&_h2]:font-bold [&_h2]:text-lg [&_h2]:mt-8 [&_h2]:mb-2
          [&_h3]:font-bold [&_h3]:text-base [&_h3]:mt-6 [&_h3]:mb-1
          [&_p]:text-sm [&_p]:leading-relaxed [&_p]:mb-3 [&_p]:text-ink
          [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_li]:text-sm [&_li]:mb-1
          [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3
          [&_a]:text-brand [&_a]:underline"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
