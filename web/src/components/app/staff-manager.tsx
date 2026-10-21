"use client";

import { useState } from "react";
import Button from "@/components/arc/button/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/arc/dialog/dialog";
import HoldToConfirm from "@/components/arc/hold-to-confirm/hold-to-confirm";
import { Input } from "@/components/arc/input/input";
import { PasswordField } from "@/components/arc/password-field/password-field";
import { Select } from "@/components/arc/select/select";
import { createStaff, deleteStaff, resetStaffPassword, updateStaff } from "@/server/actions/staff";
import { CLINICAL_ROLES, ROLE_INFO, type ClinicalRole } from "@/lib/permissions";
import { useAction } from "./use-action";
import { HUE, ROLE_HUE } from "@/lib/hues";
import { InlineError, Panel, Pill } from "./ui";
import { useToast } from "./toast-provider";

export interface StaffRow {
  userId: string;
  email: string;
  displayName: string;
  badgeNo: string | null;
  clinicalRole: ClinicalRole;
  active: boolean;
}

const ROLE_OPTIONS = CLINICAL_ROLES.map((r) => ({ value: r, label: ROLE_INFO[r].title }));

function CreateDialog() {
  const { run, pending, error } = useAction();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ email: "", displayName: "", badgeNo: "", role: "resident", password: "" });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add staff member</Button>
      </DialogTrigger>
      <DialogContent title="Add staff member" description="They sign in with this email and the temporary password you set. Share it in person.">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => createStaff(f), () => {
              toast("Staff member added", f.displayName);
              setF({ email: "", displayName: "", badgeNo: "", role: "resident", password: "" });
              setOpen(false);
            });
          }}
        >
          <Input label="Full name" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} required />
          <Input label="Email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
          <Input label="Badge number (optional)" value={f.badgeNo} onChange={(e) => setF({ ...f, badgeNo: e.target.value })} />
          <Select label="Role" options={ROLE_OPTIONS} value={f.role} onValueChange={(v) => setF({ ...f, role: v })} description={ROLE_INFO[f.role as ClinicalRole]?.desc} />
          <PasswordField label="Temporary password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={10} autoComplete="new-password" description="At least 10 characters." />
          <InlineError>{error}</InlineError>
          <div className="flex gap-3">
            <Button type="submit" loading={pending}>
              Create account
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="secondary">Cancel</Button>
            </DialogClose>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ row, isSelf }: { row: StaffRow; isSelf: boolean }) {
  const { run, pending, error } = useAction();
  const reset = useAction();
  const remove = useAction();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ displayName: row.displayName, badgeNo: row.badgeNo ?? "", role: row.clinicalRole as string, active: row.active });
  const [pw, setPw] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary" aria-label={`Edit ${row.displayName}`}>
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent title={`Edit ${row.displayName}`} description={row.email}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => updateStaff({ userId: row.userId, ...f }), () => {
              toast("Staff member updated");
              setOpen(false);
            });
          }}
        >
          <Input label="Full name" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} required />
          <Input label="Badge number" value={f.badgeNo} onChange={(e) => setF({ ...f, badgeNo: e.target.value })} />
          <Select label="Role" options={ROLE_OPTIONS} value={f.role} onValueChange={(v) => setF({ ...f, role: v })} disabled={isSelf} />
          <Select
            label="Account"
            options={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Deactivated (cannot sign in)" },
            ]}
            value={f.active ? "active" : "inactive"}
            onValueChange={(v) => setF({ ...f, active: v === "active" })}
            disabled={isSelf}
          />
          <InlineError>{error}</InlineError>
          <Button type="submit" loading={pending}>
            Save changes
          </Button>
        </form>
        <form
          className="mt-2 grid gap-3 border-t border-border pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            void reset.run(() => resetStaffPassword({ userId: row.userId, password: pw }), () => {
              toast("Password reset", "All sessions for this user were ended.");
              setPw("");
            });
          }}
        >
          <PasswordField label="New password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={10} required autoComplete="new-password" />
          <InlineError>{reset.error}</InlineError>
          <Button type="submit" variant="secondary" loading={reset.pending}>
            Reset password
          </Button>
        </form>
        {!isSelf && (
          <div className="mt-2 grid gap-3 border-t border-border pt-4">
            <p className="text-sm text-text-secondary">
              Deleting removes this login permanently. Records they made keep their name. To block sign-in temporarily, deactivate the account instead.
            </p>
            <InlineError>{remove.error}</InlineError>
            <HoldToConfirm
              tone="danger"
              label="Hold to delete account"
              confirmedLabel="Deleted"
              onConfirm={() =>
                void remove.run(
                  () => deleteStaff({ userId: row.userId }),
                  () => {
                    toast("Account deleted", row.displayName);
                    setOpen(false);
                  },
                )
              }
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function StaffManager({ rows, selfId }: { rows: StaffRow[]; selfId: string }) {
  return (
    <Panel title={`Staff (${rows.length})`} action={<CreateDialog />}>
      {/* Phone: one row per person with the edit button beside it. */}
      <ul className="grid divide-y divide-border rounded-xl border border-border sm:hidden" aria-label="Staff accounts">
        {rows.map((r) => (
          <li key={r.userId} className={`flex items-center justify-between gap-3 px-3 py-2.5 ${HUE[ROLE_HUE[r.clinicalRole]].edge}`}>
            <div className="min-w-0">
              <p className="truncate font-medium">{r.displayName}</p>
              <p className="truncate text-sm text-text-secondary">{r.email}</p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                <Pill hue={ROLE_HUE[r.clinicalRole]}>{ROLE_INFO[r.clinicalRole].title}</Pill>
                <Pill hue={r.active ? "emerald" : undefined}>{r.active ? "Active" : "Deactivated"}</Pill>
              </p>
            </div>
            <EditDialog row={r} isSelf={r.userId === selfId} />
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto rounded-xl border border-border sm:block">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <caption className="sr-only">Staff accounts</caption>
          <thead className="bg-surface-muted text-text-secondary">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Name</th>
              <th scope="col" className="px-3 py-2 font-medium">Email</th>
              <th scope="col" className="px-3 py-2 font-medium">Badge</th>
              <th scope="col" className="px-3 py-2 font-medium">Role</th>
              <th scope="col" className="px-3 py-2 font-medium">Status</th>
              <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.userId} className={`border-t border-border ${HUE[ROLE_HUE[r.clinicalRole]].edge}`}>
                <td className="px-3 py-2 font-medium">{r.displayName}</td>
                <td className="px-3 py-2">{r.email}</td>
                <td className="px-3 py-2">{r.badgeNo ?? "--"}</td>
                <td className="px-3 py-2"><Pill hue={ROLE_HUE[r.clinicalRole]}>{ROLE_INFO[r.clinicalRole].title}</Pill></td>
                <td className="px-3 py-2">
                  <Pill hue={r.active ? "emerald" : undefined}>{r.active ? "Active" : "Deactivated"}</Pill>
                </td>
                <td className="px-3 py-2 text-right">
                  <EditDialog row={r} isSelf={r.userId === selfId} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
