"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { PasswordField } from "@/components/auth/PasswordField";
import type { CreateUserInput, UserRole } from "@/models/schemas";
import type { StoredUser } from "@/lib/users";

function inputClass() {
  return "w-full rounded border border-neutral-300 px-2 py-1.5 text-sm focus:border-[#0f3d2e] focus:outline-none focus:ring-1 focus:ring-[#0f3d2e]";
}
function labelClass() {
  return "block text-xs font-medium text-neutral-500 mb-1";
}

type SimpleResult = { ok: true } | { error: string };

export function UserManagementForm({
  users,
  creatableRoles,
  onCreate,
  onResetPassword,
  onSetActive,
}: {
  users: StoredUser[];
  /** Roles the signed-in actor is allowed to create — server-enforced too, this is just UX. */
  creatableRoles: UserRole[];
  onCreate: (input: CreateUserInput) => Promise<SimpleResult>;
  onResetPassword: (userId: string, newPassword: string) => Promise<SimpleResult>;
  onSetActive: (userId: string, active: boolean) => Promise<SimpleResult>;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>(creatableRoles[0] ?? "worker");
  const [creating, setCreating] = useState(false);

  const [resetTarget, setResetTarget] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleCreate() {
    setCreating(true);
    try {
      const result = await onCreate({ name, email, password, role: role as "admin" | "worker" });
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(`${role === "admin" ? "Admin" : "Worker"} account created.`);
        setName("");
        setEmail("");
        setPassword("");
      }
    } catch {
      toast.error("Couldn't create the account. Check your connection and try again.");
    } finally {
      setCreating(false);
    }
  }

  async function handleReset(userId: string) {
    if (!resetPassword) return;
    setBusyId(userId);
    try {
      const result = await onResetPassword(userId, resetPassword);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Password reset. Share the new password with them directly.");
        setResetTarget(null);
        setResetPassword("");
      }
    } catch {
      toast.error("Couldn't reset the password. Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleSetActive(userId: string, active: boolean) {
    setBusyId(userId);
    try {
      const result = await onSetActive(userId, active);
      if ("error" in result) toast.error(result.error);
      else toast.success(active ? "Account reactivated." : "Account deactivated.");
    } catch {
      toast.error("Couldn't update the account. Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {creatableRoles.length > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-neutral-700">Create account</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
            <div>
              <label className={labelClass()}>Name</label>
              <input className={inputClass()} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className={labelClass()}>Email</label>
              <input type="email" className={inputClass()} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className={labelClass()}>Password</label>
              <PasswordField
                value={password}
                onChange={setPassword}
                placeholder="At least 6 characters"
                className={`${inputClass()} pr-8`}
                toggleClassName="absolute inset-y-0 right-0 flex items-center px-2 text-neutral-400 hover:text-neutral-600"
              />
            </div>
            <div>
              <label className={labelClass()}>Role</label>
              {creatableRoles.length > 1 ? (
                <select className={inputClass()} value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                  {creatableRoles.map((r) => (
                    <option key={r} value={r}>
                      {r === "admin" ? "Admin" : "Worker"}
                    </option>
                  ))}
                </select>
              ) : (
                <input className={inputClass()} value="Worker" disabled />
              )}
            </div>
          </div>
          <button
            type="button"
            disabled={creating || !name || !email || password.length < 6}
            onClick={handleCreate}
            className="mt-4 w-full rounded bg-[#0f3d2e] px-4 py-2 text-sm font-semibold text-[#c9a227] disabled:cursor-not-allowed disabled:opacity-50 hover:bg-[#0c3125] sm:w-auto"
          >
            {creating ? "Creating..." : "Create account"}
          </button>
          <p className="mt-2 text-xs text-neutral-400">
            Share the email and password with them directly — there&apos;s no automatic welcome email yet.
          </p>
        </div>
      )}

      <div className="rounded-lg border border-neutral-200 bg-white">
        <h2 className="border-b border-neutral-100 px-4 py-2.5 text-sm font-semibold text-neutral-700">Accounts</h2>

        {/* Table at md:+, stacked cards on mobile — same pattern as the quotations/customers lists. */}
        <table className="hidden w-full text-sm md:table">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRowDesktop
                key={u._id.toString()}
                user={u}
                busy={busyId === u._id.toString()}
                resetting={resetTarget === u._id.toString()}
                resetPassword={resetPassword}
                onStartReset={() => {
                  setResetTarget(u._id.toString());
                  setResetPassword("");
                }}
                onCancelReset={() => setResetTarget(null)}
                onResetPasswordChange={setResetPassword}
                onSubmitReset={() => handleReset(u._id.toString())}
                onSetActive={(active) => handleSetActive(u._id.toString(), active)}
              />
            ))}
          </tbody>
        </table>

        <div className="divide-y divide-neutral-100 md:hidden">
          {users.map((u) => (
            <UserCardMobile
              key={u._id.toString()}
              user={u}
              busy={busyId === u._id.toString()}
              resetting={resetTarget === u._id.toString()}
              resetPassword={resetPassword}
              onStartReset={() => {
                setResetTarget(u._id.toString());
                setResetPassword("");
              }}
              onCancelReset={() => setResetTarget(null)}
              onResetPasswordChange={setResetPassword}
              onSubmitReset={() => handleReset(u._id.toString())}
              onSetActive={(active) => handleSetActive(u._id.toString(), active)}
            />
          ))}
          {users.length === 0 && <p className="px-4 py-8 text-center text-sm text-neutral-400">No accounts yet.</p>}
        </div>

        {users.length === 0 && (
          <p className="hidden px-4 py-8 text-center text-sm text-neutral-400 md:block">No accounts yet.</p>
        )}
      </div>
    </div>
  );
}

interface RowProps {
  user: StoredUser;
  busy: boolean;
  resetting: boolean;
  resetPassword: string;
  onStartReset: () => void;
  onCancelReset: () => void;
  onResetPasswordChange: (v: string) => void;
  onSubmitReset: () => void;
  onSetActive: (active: boolean) => void;
}

function roleLabel(role: UserRole) {
  return role === "super_admin" ? "Super admin" : role === "admin" ? "Admin" : "Worker";
}

function UserRowDesktop({
  user,
  busy,
  resetting,
  resetPassword,
  onStartReset,
  onCancelReset,
  onResetPasswordChange,
  onSubmitReset,
  onSetActive,
}: RowProps) {
  return (
    <tr className="border-t border-neutral-100">
      <td className="px-4 py-2">{user.name}</td>
      <td className="px-4 py-2 text-neutral-500">{user.email}</td>
      <td className="px-4 py-2">{roleLabel(user.role)}</td>
      <td className="px-4 py-2">
        {user.active === false ? (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">Deactivated</span>
        ) : (
          <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">Active</span>
        )}
      </td>
      <td className="px-4 py-2 text-right">
        {user.role === "super_admin" ? (
          <span className="text-xs text-neutral-400">—</span>
        ) : resetting ? (
          <div className="flex items-center justify-end gap-2">
            <PasswordField
              value={resetPassword}
              onChange={onResetPasswordChange}
              placeholder="New password"
              className="w-32 rounded border border-neutral-300 px-2 py-1 pr-6 text-xs"
              toggleClassName="absolute inset-y-0 right-0 flex items-center px-1 text-neutral-400 hover:text-neutral-600"
            />
            <button
              type="button"
              disabled={busy || resetPassword.length < 6}
              onClick={onSubmitReset}
              className="rounded bg-[#0f3d2e] px-2 py-1 text-xs font-medium text-[#c9a227] disabled:opacity-50"
            >
              Save
            </button>
            <button type="button" onClick={onCancelReset} className="text-xs text-neutral-500 hover:underline">
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={onStartReset} className="text-xs text-[#0f3d2e] hover:underline">
              Reset password
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onSetActive(user.active === false)}
              className="text-xs text-neutral-500 hover:underline disabled:opacity-50"
            >
              {user.active === false ? "Reactivate" : "Deactivate"}
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

function UserCardMobile({
  user,
  busy,
  resetting,
  resetPassword,
  onStartReset,
  onCancelReset,
  onResetPasswordChange,
  onSubmitReset,
  onSetActive,
}: RowProps) {
  return (
    <div className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-neutral-900">{user.name}</p>
          <p className="text-xs text-neutral-500">{user.email}</p>
        </div>
        {user.active === false ? (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">Deactivated</span>
        ) : (
          <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">Active</span>
        )}
      </div>
      <p className="mt-1 text-xs text-neutral-400">{roleLabel(user.role)}</p>

      {user.role !== "super_admin" && (
        <div className="mt-3">
          {resetting ? (
            <div className="flex flex-col gap-2">
              <PasswordField
                value={resetPassword}
                onChange={onResetPasswordChange}
                placeholder="New password"
                className="w-full rounded border border-neutral-300 px-2 py-1.5 pr-8 text-sm"
                toggleClassName="absolute inset-y-0 right-0 flex items-center px-2 text-neutral-400 hover:text-neutral-600"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy || resetPassword.length < 6}
                  onClick={onSubmitReset}
                  className="flex-1 rounded bg-[#0f3d2e] px-3 py-1.5 text-xs font-medium text-[#c9a227] disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={onCancelReset}
                  className="flex-1 rounded border border-neutral-300 px-3 py-1.5 text-xs text-neutral-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-4">
              <button type="button" onClick={onStartReset} className="text-xs text-[#0f3d2e] hover:underline">
                Reset password
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onSetActive(user.active === false)}
                className="text-xs text-neutral-500 hover:underline disabled:opacity-50"
              >
                {user.active === false ? "Reactivate" : "Deactivate"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
