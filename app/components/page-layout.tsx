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
    <div className="min-h-screen bg-background">
      {showHeader && <PageHeader />}
      <div className="relative">
        {/* Background effects */}
        <div className="absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,black,transparent)] pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/10 rounded-full blur-[100px] opacity-30 pointer-events-none" />

        <div className={`container relative py-8 px-4 md:py-10 ${className}`}>
          <div className="flex flex-col gap-2 mb-8 animate-fade-in">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
            <p className="text-muted-foreground text-base md:text-lg max-w-2xl">{description}</p>
          </div>
          <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
