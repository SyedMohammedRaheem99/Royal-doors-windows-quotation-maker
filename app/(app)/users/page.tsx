import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { isSuperAdmin, resolveActor } from "@/lib/authz";
import { createUser, deactivateUser, listUsersFor, reactivateUser, resetUserPassword } from "@/lib/users";
import { UserManagementForm } from "@/components/users/UserManagementForm";
import { CreateUserInputSchema, ResetPasswordInputSchema, type CreateUserInput, type UserRole } from "@/models/schemas";

export default async function UsersPage() {
  const actor = await resolveActor(await auth());
  if (!actor || actor.role === "worker") redirect("/dashboard");

  const result = await listUsersFor(actor);
  const users = result.ok ? JSON.parse(JSON.stringify(result.data)) : [];

  const creatableRoles: UserRole[] = isSuperAdmin(actor) ? ["admin", "worker"] : ["worker"];

  async function createAction(input: CreateUserInput) {
    "use server";
    const a = await resolveActor(await auth());
    if (!a || a.role === "worker") return { error: "Not authorized." };

    const parsed = CreateUserInputSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join(", ") };

    const created = await createUser(parsed.data, a);
    if (!created.ok) return { error: created.error };

    revalidatePath("/users");
    return { ok: true as const };
  }

  async function resetPasswordAction(userId: string, newPassword: string) {
    "use server";
    const a = await resolveActor(await auth());
    if (!a || a.role === "worker") return { error: "Not authorized." };

    const parsed = ResetPasswordInputSchema.safeParse({ newPassword });
    if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join(", ") };

    const reset = await resetUserPassword(userId, parsed.data, a);
    if (!reset.ok) return { error: reset.error };

    return { ok: true as const };
  }

  async function setActiveAction(userId: string, active: boolean) {
    "use server";
    const a = await resolveActor(await auth());
    if (!a || a.role === "worker") return { error: "Not authorized." };

    const changed = active ? await reactivateUser(userId, a) : await deactivateUser(userId, a);
    if (!changed.ok) return { error: changed.error };

    revalidatePath("/users");
    return { ok: true as const };
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-neutral-900">Users</h1>
      <p className="mb-6 text-sm text-neutral-500">
        {isSuperAdmin(actor)
          ? "Create and manage admin and worker accounts."
          : "Create and manage the worker accounts you're responsible for."}
        {" "}A role or password change takes effect the next time that person signs in.
      </p>
      <UserManagementForm
        users={users}
        creatableRoles={creatableRoles}
        onCreate={createAction}
        onResetPassword={resetPasswordAction}
        onSetActive={setActiveAction}
      />
    </div>
  );
}
