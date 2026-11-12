import { marked, Renderer } from 'marked'

const renderer = new Renderer()

// Add id= to headings so anchor links like #schedule-a work.
renderer.heading = function ({ text, depth }: { text: string; depth: number }) {
  const id = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
  return `<h${depth} id="${id}">${text}</h${depth}>\n`
}

marked.use({ renderer })

export function renderMarkdown(md: string): string {
  return marked.parse(md) as string
}
