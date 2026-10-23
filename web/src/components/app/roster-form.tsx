"use client";

import { useMemo, useState } from "react";
import Button from "@/components/arc/button/button";
import { Select } from "@/components/arc/select/select";
import { saveRoster } from "@/server/actions/roster";
import { useAction } from "./use-action";
import { InlineError } from "./ui";

interface StaffItem {
  name: string;
  role: string;
}

export function RosterForm({
  initial,
  staffList = [],
}: {
  initial: { doc1: string; doc2: string; attending: string };
  staffList?: StaffItem[];
}) {
  const { run, pending, error } = useAction();
  const [doc1, setDoc1] = useState(initial.doc1);
  const [doc2, setDoc2] = useState(initial.doc2);
  const [attending, setAttending] = useState(initial.attending);
  const [saved, setSaved] = useState(false);

  const docOptions = useMemo(() => {
    // Strictly residents & admins (attendings excluded)
    const residents = staffList.filter((s) => s.role === "resident" || s.role === "admin");
    const list = residents.map((s) => ({ value: s.name, label: `${s.name} (Resident)` }));
    if (initial.doc1 && !list.some((o) => o.value === initial.doc1)) {
      list.unshift({ value: initial.doc1, label: `${initial.doc1} (current)` });
    }
    return list;
  }, [staffList, initial.doc1]);

  const doc2Options = useMemo(() => {
    // Strictly residents & admins (attendings excluded)
    const residents = staffList.filter((s) => s.role === "resident" || s.role === "admin");
    const list = [
      { value: "", label: "-- None (Sole Doctor on Duty) --" },
      ...residents.map((s) => ({ value: s.name, label: `${s.name} (Resident)` })),
    ];
    if (initial.doc2 && !list.some((o) => o.value === initial.doc2)) {
      list.push({ value: initial.doc2, label: `${initial.doc2} (current)` });
    }
    return list;
  }, [staffList, initial.doc2]);

  const attendingOptions = useMemo(() => {
    // Strictly attendings & admins (residents excluded)
    const attendings = staffList.filter((s) => s.role === "attending" || s.role === "admin");
    const list = attendings.map((s) => ({ value: s.name, label: `${s.name} (Attending)` }));
    if (initial.attending && !list.some((o) => o.value === initial.attending)) {
      list.unshift({ value: initial.attending, label: `${initial.attending} (current)` });
    }
    return list;
  }, [staffList, initial.attending]);

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        const rosterPayload = { doc1, doc2, attending };
        void run(
          () => saveRoster(rosterPayload),
          () => setSaved(true),
          {
            type: "saveRoster",
            payload: rosterPayload,
            description: `Update duty roster (${doc1})`,
          },
        );
      }}
    >
      <div className="grid gap-4">
        {docOptions.length > 0 ? (
          <>
            <Select
              label="Duty doctor 1 (Residents only)"
              options={docOptions}
              value={doc1}
              onValueChange={setDoc1}
              description="Primary resident physician on duty."
            />
            <Select
              label="Duty doctor 2 (Optional - Residents only)"
              options={doc2Options}
              value={doc2}
              onValueChange={setDoc2}
              description="Second resident on duty if paired, or leave empty."
            />
            <Select
              label="Attending consultant (Attendings only)"
              options={attendingOptions}
              value={attending}
              onValueChange={setAttending}
              description="Supervising consultant on call."
            />
          </>
        ) : (
          <p className="text-sm text-text-secondary">No staff profiles registered yet. Create staff accounts first in the Staff tab.</p>
        )}
      </div>
      <InlineError>{error}</InlineError>
      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending} disabled={!doc1 || !attending}>
          Update roster
        </Button>
        {saved && !error && <span role="status" className="text-sm text-success">Roster updated</span>}
      </div>
    </form>
  );
}
