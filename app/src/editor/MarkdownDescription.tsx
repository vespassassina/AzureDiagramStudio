import { Marked } from 'marked'
import DOMPurify from 'dompurify'
import { memo, useRef } from 'react'
import { Eye, Pencil } from 'lucide-react'
import './MarkdownDescription.css'

export type MarkdownMode = 'edit' | 'preview'

function escapeAttribute(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function safeLink(value: string): string | null {
  if (!/^https?:\/\//i.test(value) || /[\s\u0000-\u001f\u007f-\u009f\\]/u.test(value) || /&(?:#|[a-z]+;)|%(?:0[0-9a-f]|1[0-9a-f]|7f|8[0-9a-f]|9[0-9a-f])/i.test(value)) return null
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null
  } catch { return null }
}

const parser = new Marked({ gfm: true, async: false, renderer: {
  html() { return '' },
  image() { return '' },
  checkbox() { return '' },
  link(token) {
    const text = this.parser.parseInline(token.tokens)
    const href = safeLink(token.href)
    return href ? `<a href="${escapeAttribute(href)}">${text}</a>` : text
  },
} })

function renderMarkdown(source: string): string {
  const fragment = DOMPurify.sanitize(parser.parse(source, { async: false }), {
    ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'ul', 'ol', 'li', 'strong', 'em', 'del', 'blockquote', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a'],
    ALLOWED_ATTR: ['href', 'start'],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    RETURN_DOM_FRAGMENT: true,
  })
  for (const anchor of fragment.querySelectorAll('a')) {
    const href = safeLink(anchor.getAttribute('href') ?? '')
    if (!href) { anchor.replaceWith(...anchor.childNodes); continue }
    anchor.setAttribute('href', href)
    anchor.setAttribute('target', '_blank')
    anchor.setAttribute('rel', 'noopener noreferrer')
  }
  const container = document.createElement('div')
  container.append(fragment)
  return container.innerHTML
}

export const MarkdownPreview = memo(function MarkdownPreview({ source }: { source: string }) {
  try {
    const html = renderMarkdown(source)
    return <div className="markdown-preview" role="region" aria-label="Markdown preview" tabIndex={0} data-markdown-preview dangerouslySetInnerHTML={{ __html: html }} />
  } catch {
    return <div className="markdown-preview" role="region" aria-label="Markdown preview" tabIndex={0} data-markdown-preview><p role="alert">Markdown preview unavailable.</p><pre>{source}</pre></div>
  }
})

export function MarkdownDescription({ value, mode, writable, presenting = false, onModeChange, onDraft, onFinish, onCancel, deferFinish }: {
  value: string; mode: MarkdownMode; writable: boolean; presenting?: boolean
  onModeChange(mode: MarkdownMode): void; onDraft(value: string): void; onFinish(): void; onCancel(): void; deferFinish(): boolean
}) {
  const composing = useRef(false)
  const blurred = useRef(false)
  return <div className="markdown-description">
    {!presenting && <div className="markdown-modes" role="group" aria-label="Markdown mode" data-markdown-ui>
      {(['edit', 'preview'] as const).map(next => <button key={next} type="button" aria-label={next === 'edit' ? 'Edit Markdown' : 'Preview Markdown'} aria-pressed={mode === next} onMouseDown={event => event.preventDefault()} onClick={() => { if (!composing.current) onModeChange(next) }}>{next === 'edit' ? <Pencil size={15} /> : <Eye size={15} />}{next === 'edit' ? 'Edit' : 'Preview'}</button>)}
    </div>}
    {presenting || mode === 'preview' ? <MarkdownPreview source={value} /> : <textarea aria-label="Architecture description (Markdown)" value={value} rows={7} maxLength={20000} readOnly={!writable}
      onChange={event => { if (writable) onDraft(event.target.value) }}
      onCompositionStart={() => { composing.current = true }}
      onCompositionEnd={() => { composing.current = false; if (blurred.current) { blurred.current = false; queueMicrotask(onFinish) } }}
      onBlur={event => {
        if (!writable || deferFinish() || (event.relatedTarget instanceof HTMLElement && (event.relatedTarget.closest('[data-markdown-ui]') || event.relatedTarget.getAttribute('aria-label') === 'New diagram'))) return
        if (composing.current) blurred.current = true; else onFinish()
      }}
      onKeyDown={event => {
        if (composing.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return
        if (event.key === 'Escape' && writable) { event.stopPropagation(); onCancel(); event.currentTarget.blur() }
      }} />}
  </div>
}