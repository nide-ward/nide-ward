"use client";

import { useState } from "react";
import Button from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { saveRoster } from "@/server/actions/roster";
import { useAction } from "./use-action";
import { InlineError } from "./ui";

export function RosterForm({ initial }: { initial: { doc1: string; doc2: string; attending: string } }) {
  const { run, pending, error } = useAction();
  const [doc1, setDoc1] = useState(initial.doc1);
  const [doc2, setDoc2] = useState(initial.doc2);
  const [attending, setAttending] = useState(initial.attending);
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        void run(() => saveRoster({ doc1, doc2, attending }), () => setSaved(true));
      }}
    >
      <Input label="Duty doctor 1" value={doc1} onChange={(e) => setDoc1(e.target.value)} required maxLength={120} placeholder="Dr. Ahmed Taha" />
      <Input label="Duty doctor 2 (optional)" value={doc2} onChange={(e) => setDoc2(e.target.value)} maxLength={120} />
      <Input label="Attending consultant" value={attending} onChange={(e) => setAttending(e.target.value)} required maxLength={120} />
      <InlineError>{error}</InlineError>
      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          Update roster
        </Button>
        {saved && !error && <span role="status" className="text-sm text-success">Roster updated</span>}
      </div>
    </form>
  );
}
