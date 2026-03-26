'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

const components: Components = {
  h1: ({ children }) => (
    <h3 className="text-base font-bold mt-3 mb-1.5 first:mt-0">{children}</h3>
  ),
  h2: ({ children }) => (
    <h4 className="text-sm font-bold mt-3 mb-1 first:mt-0">{children}</h4>
  ),
  h3: ({ children }) => (
    <h5 className="text-sm font-semibold mt-2 mb-1 first:mt-0">{children}</h5>
  ),
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => (
    <ul className="mb-2 last:mb-0 ml-4 space-y-0.5 list-disc marker:text-muted-foreground/60">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 last:mb-0 ml-4 space-y-0.5 list-decimal marker:text-muted-foreground/60">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed pl-0.5">{children}</li>,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-md border border-border">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-muted/60">{children}</thead>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr className="border-b border-border last:border-0">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-2.5 py-1.5 text-left font-semibold text-muted-foreground whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-2.5 py-1.5 whitespace-nowrap tabular-nums">{children}</td>
  ),
  code: ({ className, children }) => {
    const isBlock = className?.includes('language-')
    if (isBlock) {
      return (
        <pre className="my-2 overflow-x-auto rounded-md bg-muted/80 p-2.5 text-xs font-mono">
          <code>{children}</code>
        </pre>
      )
    }
    return (
      <code className="rounded bg-muted/80 px-1 py-0.5 text-xs font-mono">{children}</code>
    )
  },
  pre: ({ children }) => <>{children}</>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-primary/30 pl-3 text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-border" />,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:text-primary/80"
    >
      {children}
    </a>
  ),
}

interface MarkdownContentProps {
  content: string
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="prose-agent">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
