import { getSession } from "@/app/actions/auth-actions";
import { GlobalSessionRestorer } from "@/components/GlobalSessionRestorer";
import { SentryUserSync } from "@/components/SentryUserSync";

export async function SessionRestorerWrapper() {
  const session = await getSession();
  const hasServerSession = !!session;

  return (
    <>
      <GlobalSessionRestorer hasServerSession={hasServerSession} />
      <SentryUserSync userId={session?.userId ?? null} role={session?.role ?? null} />
    </>
  );
}
