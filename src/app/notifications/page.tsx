import { redirect } from "next/navigation";
import { getSession } from "@/app/actions/auth-actions";

export const dynamic = "force-dynamic";

export default async function NotificationsRedirectPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  if (session.role === "ADMIN") {
    redirect("/admin/notifications");
  }

  if (session.role === "LIBRARIAN" || session.role === "RECEPTIONIST") {
    redirect("/dashboard/notifications");
  }

  redirect("/student/dashboard");
}
