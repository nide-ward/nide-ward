"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { PasswordField } from "@/components/arc/password-field/password-field";
import { authClient } from "@/lib/auth-client";
import { InlineError } from "./ui";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        try {
          const { error } = await authClient.signIn.username({ username: username.trim(), password });
          if (error) {
            setError(error.status === 429 ? "Too many attempts. Wait a minute and try again." : "That username and password do not match an active account.");
            return;
          }
          // The app sends a temporary password on to the "set your password" screen.
          router.push("/");
          router.refresh();
        } catch {
          setError("Could not reach the server. Check the connection and try again.");
        } finally {
          setPending(false);
        }
      }}
    >
      <Input
        label="Username"
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />
      <PasswordField label="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <InlineError>{error}</InlineError>
      <Button type="submit" size="lg" loading={pending}>
        Sign in
      </Button>
    </form>
  );
}
