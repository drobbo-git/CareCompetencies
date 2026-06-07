import { useState } from "react";
import { useAuth } from "@/data/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles } from "lucide-react";

export default function LoginPage() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setSigningIn(true);
    setError(null);
    try {
      await signIn(username.trim(), password);
    } catch {
      setError("Invalid username or password.");
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-lg insight-gradient flex items-center justify-center text-white">
            <Sparkles className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">
            <span>Care</span><span className="text-primary">Competencies</span>
          </CardTitle>
          <p className="text-xs text-muted-foreground">DUHS · Sign in with your Duke credentials</p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Duke NetID</Label>
              <Input
                id="username"
                autoComplete="username"
                placeholder="simmonsm"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={signingIn}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={signingIn}
              />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={!username.trim() || !password || signingIn}>
              {signingIn ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground pt-4 mt-4 border-t">
            Part of CareOps — Integrated Healthcare Operations
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
