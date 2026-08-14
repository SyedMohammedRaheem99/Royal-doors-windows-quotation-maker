import { auth } from "@/auth";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div>
      <h1 className="text-xl font-semibold text-neutral-900">Welcome, {session?.user?.name}</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Recent quotations, quick stats and shortcuts will appear here.
      </p>
    </div>
  );
}
