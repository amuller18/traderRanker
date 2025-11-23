'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface WaitlistFormProps {
  variant?: 'hero' | 'sidebar'
  className?: string
}

export function WaitlistForm({ variant = 'hero', className = '' }: WaitlistFormProps) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast.error('Invalid Email', {
        description: 'Please enter a valid email address',
      })
      return
    }

    setIsSubmitting(true)

    // Simulate API call (replace with actual API call later)
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Show success message
    toast.success('Successfully Joined Waitlist!', {
      description: `We'll send updates to ${email} when copy trading launches.`,
      duration: 5000,
    })

    // Reset form
    setEmail('')
    setName('')
    setIsSubmitting(false)
  }

  if (variant === 'hero') {
    return (
      <form onSubmit={handleSubmit} className={`flex max-w-md gap-2 flex-1 sm:flex-none ${className}`}>
        <Input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isSubmitting}
          className="flex-1 h-12 text-base border-2 shadow-elevated"
          required
        />
        <Button
          type="submit"
          size="lg"
          variant="outline"
          disabled={isSubmitting}
          className="h-12 px-6 font-semibold shadow-elevated-lg hover:shadow-elevated-xl hover-lift"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Joining...
            </>
          ) : (
            'Join Waitlist'
          )}
        </Button>
      </form>
    )
  }

  // Sidebar variant
  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
      <Input
        type="text"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={isSubmitting}
        className="h-12 border-2"
      />
      <Input
        type="email"
        placeholder="Your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={isSubmitting}
        className="h-12 border-2"
        required
      />
      <Button type="submit" size="lg" disabled={isSubmitting} className="w-full h-12 font-semibold text-base">
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Joining...
          </>
        ) : (
          'Get Early Access'
        )}
      </Button>
    </form>
  )
}
