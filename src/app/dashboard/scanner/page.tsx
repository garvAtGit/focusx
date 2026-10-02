import { getSession } from "@/app/actions/auth-actions";
import { getActiveLibrary } from "@/lib/dashboard-utils";
import { redirect } from "next/navigation";
import { ScannerClient } from "./ScannerClient";

export const metadata = {
  title: "QR Scanner - FocusX Dashboard",
};

export default async function ScannerPage() {
  const session = await getSession();
  if (!session || (session.role !== "LIBRARIAN" && session.role !== "ADMIN" && session.role !== "RECEPTIONIST")) {
    redirect("/login");
  }

  const activeLibrary = await getActiveLibrary(session);
  if (!activeLibrary) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No active library found. Please select a library first.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">Web QR Scanner</h1>
        <p className="text-muted-foreground mt-1">
          Use this device's camera to scan student entry QR codes.
        </p>
      </div>
      
      <ScannerClient libraryId={activeLibrary.id} />
    </div>
  );
}
