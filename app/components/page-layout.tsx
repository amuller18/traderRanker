import type { ReactNode } from 'react'
import { PageHeader } from '@/app/page-header'

interface PageLayoutProps {
  title: string
  description: string
  children: ReactNode
  showHeader?: boolean
  className?: string
}

export function PageLayout({
  title,
  description,
  children,
  showHeader = true,
  className = '',
}: PageLayoutProps) {
  return (
    <div>
      {showHeader && <PageHeader />}
      <div className="min-h-screen gradient-background">
        <div className={`container py-10 px-4 ${className}`}>
          <div className="flex flex-col gap-3 mb-10 animate-fade-in">
            <h1 className="text-4xl font-bold tracking-tight text-gradient">{title}</h1>
            <p className="text-muted-foreground text-lg">{description}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
