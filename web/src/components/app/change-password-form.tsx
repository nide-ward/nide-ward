"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/arc/button/button";
import { PasswordField } from "@/components/arc/password-field/password-field";
import { authClient } from "@/lib/auth-client";
import { changeOwnPassword } from "@/server/actions/preferences";
import { useAction } from "./use-action";
import { InlineError } from "./ui";
import { useToast } from "./toast-provider";

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const { run, pending, error } = useAction();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mismatch, setMismatch] = useState(false);

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (next !== confirm) {
          setMismatch(true);
          return;
        }
        setMismatch(false);
        void run(
          () => changeOwnPassword({ currentPassword: current, newPassword: next }),
          () => {
            toast("Password updated", "Use it the next time you sign in.");
            router.push("/");
          },
        );
      }}
    >
      <PasswordField
        label={forced ? "Temporary password" : "Current password"}
        autoComplete="current-password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        required
      />
      <PasswordField
        label="New password"
        autoComplete="new-password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        required
        minLength={10}
        description="At least 10 characters, different from the temporary one."
      />
      <PasswordField label="Repeat new password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={10} />
      <InlineError>{mismatch ? "The two new passwords do not match." : error}</InlineError>
      <Button type="submit" size="lg" loading={pending}>
        {forced ? "Set password and continue" : "Change password"}
      </Button>
      <div className="flex gap-3">
        {!forced && (
          <Button type="button" variant="secondary" onClick={() => router.push("/")}>
            Cancel
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={async () => {
            await authClient.signOut();
            router.push("/login");
            router.refresh();
          }}
        >
          Sign out
        </Button>
      </div>
    </form>
  );
}
