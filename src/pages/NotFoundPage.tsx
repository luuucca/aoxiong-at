import React, { useEffect } from 'react'
import { ButtonLink } from '../components/ui/Button'
import { DEFAULT_TITLE, useNoindex } from '../utils/seo'

export default function NotFoundPage() {
  useNoindex()

  useEffect(() => {
    document.title = '页面不存在 | 奥匈置业研究所'
    return () => { document.title = DEFAULT_TITLE }
  }, [])

  return (
    <main className="min-h-screen flex flex-col items-start justify-center bg-bg-base px-6 pt-16 sm:items-center sm:text-center">
      <p className="text-caption text-fg-tertiary mb-4 tabular-nums">404</p>
      <h1 className="font-serif text-display-lg text-fg-primary mb-4 tracking-tight">这个页面不存在</h1>
      <p className="text-body-lg text-fg-secondary mb-8 max-w-prose">链接可能已经失效，或者房源已经下架。</p>
      <ButtonLink to="/listings" variant="primary" size="lg" className="self-end sm:self-auto">查看在售房源</ButtonLink>
    </main>
  )
}
