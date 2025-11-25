"use client";

import { useState, useEffect } from "react";
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

export default function ConfirmEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email");
  const [isChecking, setIsChecking] = useState(false);
  const [checkCount, setCheckCount] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    if (!email) {
      toast.error("No email provided");
      router.push("/auth/register");
      return;
    }

    // Check every 3 seconds if the email has been confirmed
    const checkEmailConfirmation = async () => {
      setIsChecking(true);
      setCheckCount(prev => prev + 1);

      try {
        // Try to get the current session
        const { data: { session }, error } = await supabase.auth.getSession();

        if (session?.user) {
          console.log("✅ Email confirmed! Session found:", session.user.id);
          toast.success("Email confirmed! Redirecting...");

          // Wait a moment for the profile to be created
          await new Promise(resolve => setTimeout(resolve, 500));

          router.push("/rankings");
          router.refresh();
          return true;
        }

        console.log(`🔍 Check ${checkCount}: No session yet`);
        return false;
      } catch (error) {
        console.error("Error checking session:", error);
        return false;
      } finally {
        setIsChecking(false);
      }
    };

    // Initial check after 2 seconds
    const initialTimeout = setTimeout(() => {
      checkEmailConfirmation();
    }, 2000);

    // Then check every 3 seconds
    const interval = setInterval(async () => {
      const confirmed = await checkEmailConfirmation();
      if (confirmed) {
        clearInterval(interval);
      }
    }, 3000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [email, router, supabase, checkCount]);

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

            {isChecking && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Checking for confirmation...</span>
              </div>
            )}

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
