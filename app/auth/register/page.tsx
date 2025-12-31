"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { PageHeader } from "@/app/page-header";
import { PhantomSignInButton } from "@/components/PhantomSignInButton";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailCheckStatus, setEmailCheckStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [emailCheckMessage, setEmailCheckMessage] = useState("");

  // Check email availability when email changes
  useEffect(() => {
    // Reset state if email is empty
    if (!email || email.trim() === '') {
      setEmailCheckStatus('idle');
      setEmailCheckMessage('');
      return;
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailCheckStatus('idle');
      setEmailCheckMessage('');
      return;
    }

    // Debounce the API call
    const timeoutId = setTimeout(async () => {
      setEmailCheckStatus('checking');
      setEmailCheckMessage('Checking...');

      try {
        const response = await fetch('/api/auth/check-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
        });

        if (!response.ok) {
          setEmailCheckStatus('idle');
          setEmailCheckMessage('');
          return;
        }

        const data = await response.json();

        if (data.exists) {
          setEmailCheckStatus('taken');
          setEmailCheckMessage('This email is already registered');
        } else {
          setEmailCheckStatus('available');
          setEmailCheckMessage('Email is available');
        }
      } catch (error) {
        console.error('Error checking email:', error);
        setEmailCheckStatus('idle');
        setEmailCheckMessage('');
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if email is already taken
    if (emailCheckStatus === 'taken') {
      toast.error("This email is already registered. Please sign in instead.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (username.length < 3) {
      toast.error("Username must be at least 3 characters");
      return;
    }

    setIsLoading(true);

    try {
      const result = await register(email, username, password);

      if (result.requiresEmailConfirmation) {
        console.debug('Registration successful - email confirmation required');
        toast.info("Account created! Please check your email to confirm.");

        // Redirect to email confirmation page
        router.push(`/auth/confirm-email?email=${encodeURIComponent(email)}`);
      } else {
        console.debug('Registration successful - auth state updated');
        toast.success("Account created successfully!");

        // Small delay to ensure auth state and profile propagate
        await new Promise(resolve => setTimeout(resolve, 100));

        router.push("/account");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Registration failed";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader />
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
          <CardDescription>
            Enter your information to get started with TraderRanker
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="johndoe"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className={
                    emailCheckStatus === 'taken'
                      ? 'border-red-500 pr-10'
                      : emailCheckStatus === 'available'
                      ? 'border-green-500 pr-10'
                      : ''
                  }
                />
                {emailCheckStatus === 'checking' && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {emailCheckStatus === 'taken' && (
                  <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
                )}
                {emailCheckStatus === 'available' && (
                  <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                )}
              </div>
              {emailCheckMessage && (
                <p className={`text-xs ${
                  emailCheckStatus === 'taken'
                    ? 'text-red-500'
                    : emailCheckStatus === 'available'
                    ? 'text-green-500'
                    : 'text-muted-foreground'
                }`}>
                  {emailCheckMessage}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create account"
              )}
            </Button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            {/* Phantom Wallet Sign-Up */}
            <PhantomSignInButton
              onSuccess={() => {
                router.push('/account');
                router.refresh();
              }}
              className="w-full"
            />

            <p className="text-sm text-muted-foreground text-center">
              Already have an account?{" "}
              <Link
                href="/auth/login"
                className="text-primary hover:underline font-medium"
              >
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
      </div>
    </div>
  );
}
