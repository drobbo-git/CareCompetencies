import { useState } from "react";
import { useAuth } from "@/data/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sparkles } from "lucide-react";

/**
 * Stub login page. Lists the seed logins in a dropdown grouped by SystemRole.
 * Replace with Entra ID / MSAL sign-in in production.
 */
export default function LoginPage() {
  const { logins, signIn } = useAuth();
  const [selectedId, setSelectedId] = useState<string>("");

  const grouped = {
    Administrator: logins.filter((l) => l.systemRole === "Administrator"),
    UnitLeader:    logins.filter((l) => l.systemRole === "UnitLeader"),
    Preceptor:     logins.filter((l) => l.systemRole === "Preceptor"),
    Person:        logins.filter((l) => l.systemRole === "Person"),
  };

  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  async function handleSignIn() {
    if (!selectedId) return;
    setSigningIn(true);
    setSignInError(null);
    try {
      await signIn(selectedId);
    } catch {
      setSignInError("Sign-in failed. Is the API running?");
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-lg insight-gradient flex items-center justify-center text-white">
            <Sparkles className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">
            <span>Care</span>
            <span className="text-primary">Competencies</span>
          </CardTitle>
          <p className="text-xs text-muted-foreground">DUHS prototype</p>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="login-pick">Sign in as</label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger id="login-pick">
                <SelectValue placeholder="Pick a demo user…" />
              </SelectTrigger>
              <SelectContent>
                {grouped.Administrator.length > 0 && <RoleSection label="Administrators" logins={grouped.Administrator} />}
                {grouped.UnitLeader.length    > 0 && <RoleSection label="Unit Leaders"   logins={grouped.UnitLeader} />}
                {grouped.Preceptor.length     > 0 && <RoleSection label="Preceptors"     logins={grouped.Preceptor} />}
                {grouped.Person.length        > 0 && <RoleSection label="Orientees"      logins={grouped.Person} />}
              </SelectContent>
            </Select>
          </div>

          <Button className="w-full" onClick={handleSignIn} disabled={!selectedId || signingIn}>
            {signingIn ? "Signing in…" : "Continue"}
          </Button>
          {signInError && (
            <p className="text-center text-xs text-destructive">{signInError}</p>
          )}

          <p className="text-center text-xs text-muted-foreground pt-2 border-t">
            Part of CareOps — Integrated Healthcare Operations · DUHS demo prototype
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function RoleSection({ label, logins }: { label: string; logins: { id: string; displayName: string }[] }) {
  return (
    <>
      <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      {logins.map((l) => (
        <SelectItem key={l.id} value={l.id}>{l.displayName}</SelectItem>
      ))}
    </>
  );
}