import { getSession } from "@/app/actions/auth-actions";
import { GlobalSessionRestorer } from "@/components/GlobalSessionRestorer";

export async function SessionRestorerWrapper() {
  const session = await getSession();
  const hasServerSession = !!session;

  return <GlobalSessionRestorer hasServerSession={hasServerSession} />;
}
