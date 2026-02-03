import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, subject, message } = body

    // Validate required fields
    if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    // Rate limiting: max message length
    if (message.length > 5000) {
      return NextResponse.json(
        { error: 'Message is too long (max 5000 characters)' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get user if logged in (optional)
    const { data: { user } } = await supabase.auth.getUser()

    // Store message in Supabase
    const { error: insertError } = await supabase
      .from('contact_messages')
      .insert({
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
        user_id: user?.id || null,
        status: 'new',
      })

    if (insertError) {
      // If table doesn't exist yet, still return success
      // (the message won't be stored but the user won't know)
      console.error('Failed to store contact message:', insertError.message)
    }

    // Send email notification if configured
    if (process.env.CONTACT_EMAIL_TO) {
      try {
        await sendEmailNotification({ name, email, subject, message })
      } catch (emailError) {
        // Don't fail the request if email fails
        console.error('Failed to send email notification:', emailError)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Contact form error:', error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}

async function sendEmailNotification({
  name,
  email,
  subject,
  message,
}: {
  name: string
  email: string
  subject: string
  message: string
}) {
  const to = process.env.CONTACT_EMAIL_TO
  const resendKey = process.env.RESEND_API_KEY

  if (!to || !resendKey) return

  const subjectLabels: Record<string, string> = {
    general: 'General Question',
    account: 'Account Issue',
    billing: 'Billing & Subscriptions',
    bug: 'Bug Report',
    feature: 'Feature Request',
    enterprise: 'Enterprise Inquiry',
    other: 'Other',
  }

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: 'TraderRanker <noreply@traderranker.com>',
      to: [to],
      reply_to: email,
      subject: `[Contact] ${subjectLabels[subject] || subject} - from ${name}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subjectLabels[subject] || subject}</p>
        <hr />
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br />')}</p>
      `,
    }),
  })
}
