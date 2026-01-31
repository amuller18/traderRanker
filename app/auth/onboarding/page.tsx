"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, User, Sparkles, TrendingUp, Target } from "lucide-react";
import { PageHeader } from "@/app/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const tradingExperience = [
  { value: "beginner", label: "Beginner", description: "New to crypto trading" },
  { value: "intermediate", label: "Intermediate", description: "1-2 years experience" },
  { value: "advanced", label: "Advanced", description: "3+ years experience" },
  { value: "professional", label: "Professional", description: "Full-time trader" },
];

const tradingInterests = [
  { value: "memecoins", label: "Memecoins", icon: Sparkles },
  { value: "defi", label: "DeFi Tokens", icon: TrendingUp },
  { value: "bluechip", label: "Blue Chips", icon: Target },
  { value: "all", label: "All of the Above", icon: User },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, updateProfile, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [experience, setExperience] = useState("");
  const [interest, setInterest] = useState("");

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login");
    }
  }, [user, authLoading, router]);

  // Pre-fill full name if available
  useEffect(() => {
    if (user?.full_name) {
      setFullName(user.full_name);
    }
    if (user?.avatar_url) {
      setAvatarUrl(user.avatar_url);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      toast.error("Please enter your name");
      return;
    }

    setIsLoading(true);

    try {
      await updateProfile({
        full_name: fullName.trim(),
        avatar_url: avatarUrl.trim() || undefined,
      });

      toast.success("Profile setup complete!");

      // Small delay to let profile propagate
      await new Promise((resolve) => setTimeout(resolve, 300));

      router.push("/account");
      router.refresh();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save profile";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    router.push("/account");
  };

  const getInitials = (name: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (authLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <PageHeader />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader />
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto mb-2">
              <Avatar className="h-20 w-20 border-2 border-primary/20">
                <AvatarImage src={avatarUrl} />
                <AvatarFallback className="text-lg bg-primary/10">
                  {getInitials(fullName || user.username)}
                </AvatarFallback>
              </Avatar>
            </div>
            <CardTitle className="text-2xl font-bold">
              Welcome to TraderRanker!
            </CardTitle>
            <CardDescription>
              Let's set up your profile so other traders can find you
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="fullName">
                  Full Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  This will be displayed on your public profile
                </p>
              </div>

              {/* Avatar URL */}
              <div className="space-y-2">
                <Label htmlFor="avatarUrl">Profile Picture URL</Label>
                <Input
                  id="avatarUrl"
                  type="url"
                  placeholder="https://example.com/your-avatar.jpg"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  Paste a link to your profile image (optional)
                </p>
              </div>

              {/* Trading Experience */}
              <div className="space-y-2">
                <Label htmlFor="experience">Trading Experience</Label>
                <Select value={experience} onValueChange={setExperience}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your experience level" />
                  </SelectTrigger>
                  <SelectContent>
                    {tradingExperience.map((exp) => (
                      <SelectItem key={exp.value} value={exp.value}>
                        <div className="flex flex-col">
                          <span>{exp.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {exp.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Trading Interest */}
              <div className="space-y-2">
                <Label>What are you interested in trading?</Label>
                <div className="grid grid-cols-2 gap-2">
                  {tradingInterests.map((item) => {
                    const Icon = item.icon;
                    const isSelected = interest === item.value;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setInterest(item.value)}
                        disabled={isLoading}
                        className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border hover:border-primary/50 hover:bg-muted/50"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-sm font-medium">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bio */}
              <div className="space-y-2">
                <Label htmlFor="bio">Short Bio</Label>
                <Textarea
                  id="bio"
                  placeholder="Tell us a bit about your trading style..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  disabled={isLoading}
                  rows={3}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Optional - share your trading philosophy or goals
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-3">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Complete Setup"
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={handleSkip}
                disabled={isLoading}
              >
                Skip for now
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
