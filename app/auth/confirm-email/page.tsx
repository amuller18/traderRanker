"use client";

import { useState, useEffect, useRef, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle2, Mail, Loader2 } from "lucide-react";
import { PageHeader } from "@/app/page-header";
import { toast } from "sonner";

function ConfirmEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email");
  const [isConfirmed, setIsConfirmed] = useState(false);

  // Use refs to track values without causing re-renders
  const checkCountRef = useRef(0);
  const hasRedirectedRef = useRef(false);

  // CRITICAL: Use useMemo to ensure we get the same client instance across renders
  // This prevents infinite loops from recreating the client on every render
  const supabase = useMemo(() => createClient(), []);

  // Handle successful confirmation - redirect to account
  const handleConfirmationSuccess = async () => {
    if (hasRedirectedRef.current) return;
    hasRedirectedRef.current = true;
    setIsConfirmed(true);

    toast.success("Email confirmed! Redirecting...");

    // Wait a moment for the profile to be created
    await new Promise(resolve => setTimeout(resolve, 500));

    router.push("/account");
  };

  useEffect(() => {
    if (!email) {
      toast.error("No email provided");
      router.push("/auth/register");
      return;
    }

    // Listen for auth state changes - this is the PRIMARY detection method
    // This fires when the user confirms email in the same or different tab
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // SIGNED_IN event fires when email is confirmed and session is created
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') && session?.user) {
          await handleConfirmationSuccess();
        }
      }
    );

    // Also poll getSession as a fallback - catches session from other tabs via cookies
    const checkEmailConfirmation = async () => {
      // Prevent multiple redirects
      if (hasRedirectedRef.current) return true;

      checkCountRef.current += 1;

      try {
        // Try to get the current session
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          await handleConfirmationSuccess();
          return true;
        }

        return false;
      } catch (error) {
        console.error("Error checking session:", error);
        return false;
      }
    };

    let intervalId: NodeJS.Timeout | null = null;

    // Initial check after 2 seconds
    const initialTimeout = setTimeout(() => {
      checkEmailConfirmation();
    }, 2000);

    // Then check every 3 seconds
    intervalId = setInterval(async () => {
      // If already redirecting, stop polling immediately
      if (hasRedirectedRef.current) {
        if (intervalId) clearInterval(intervalId);
        return;
      }

      const confirmed = await checkEmailConfirmation();
      if (confirmed && intervalId) {
        clearInterval(intervalId);
      }
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(initialTimeout);
      if (intervalId) clearInterval(intervalId);
    };
    // Only depend on email and supabase (both stable) to prevent effect re-running
    // Router is intentionally excluded as it's used only for navigation side-effects
  }, [email, supabase, router]);

  // Show confirmed state
  if (isConfirmed) {
    return (
      <div className="flex flex-col min-h-screen">
        <PageHeader />
        <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="space-y-1 text-center">
              <div className="mx-auto mb-4 rounded-full bg-green-500/10 p-3 w-fit">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <CardTitle className="text-2xl font-bold">Email Confirmed!</CardTitle>
              <CardDescription>
                Your account is now active
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Redirecting to your account...</span>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader />
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto mb-4 rounded-full bg-primary/10 p-3 w-fit">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">Check your email</CardTitle>
            <CardDescription>
              We've sent a confirmation link to
            </CardDescription>
            {email && (
              <p className="text-sm font-medium text-foreground pt-1">
                {email}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 text-sm text-muted-foreground">
              <p className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <span>Click the confirmation link in your email to activate your account</span>
              </p>
              <p className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <span>This page will automatically detect when you've confirmed and redirect you</span>
              </p>
              <p className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <span>If you don't see the email, check your spam folder</span>
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
              <p className="font-medium mb-1">Need help?</p>
              <p>If you're having trouble, try signing in manually after confirming your email.</p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push("/auth/login")}
            >
              Go to Sign In
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export default function ConfirmEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col min-h-screen">
        <PageHeader />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    }>
      <ConfirmEmailContent />
    </Suspense>
  );
}
