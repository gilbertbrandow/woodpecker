import * as React from "react";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "../context/auth";
import { Button } from "../components/ui/button";
import { LichessIcon } from "../components/LichessIcon";
import { GitHubPill } from "../components/GitHubPill";

export function LoginPage(): React.ReactElement | null {
  const { user, onboarding, waitlisted, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (user) void navigate({ to: "/app" });
    else if (onboarding) void navigate({ to: "/onboarding" });
    else if (waitlisted) void navigate({ to: "/waitlist" });
  }, [user, onboarding, waitlisted, loading, navigate]);

  if (loading) return null;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <GitHubPill />
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Welcome to Woodpecker
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Woodpecker is a free training tool for Lichess players where you build
          a custom puzzle set from tactics, positional puzzles, and decoys.
          Create a Schedule and compete with others training the same Woodpecker
          cycles. Sign in with your Lichess account to get started.
        </p>
      </div>
      <a href="/api/auth/login">
        <Button size="lg" className="gap-3">
          <LichessIcon className="h-5 w-5" />
          Sign in with Lichess
        </Button>
      </a>
    </div>
  );
}
