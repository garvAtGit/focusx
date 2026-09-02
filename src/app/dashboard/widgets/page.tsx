import { getSession } from "@/app/actions/auth-actions";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AlertCircle, Code, Copy, LayoutTemplate, QrCode, ExternalLink } from "lucide-react";
import { CopyableField } from "@/components/CopyableField";
import { getActiveLibrary } from "@/lib/dashboard-utils";

export default async function WidgetsPage() {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN')) {
    redirect("/login");
  }

  const library = await getActiveLibrary(session);

  if (!library) redirect("/onboarding");

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-heading font-bold text-foreground">Marketing Widgets</h1>
        <p className="text-muted-foreground mt-1">Embed FocusX into your own website or share direct booking links.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Instagram/Social Link */}
        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
              <ExternalLink className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold font-heading">Social Media Link</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Put this link in your Instagram bio or WhatsApp status to let students book directly.
          </p>
          
          <CopyableField 
            label="Direct URL"
            value={`https://www.focusx.in/library/${library.id}`}
            hint="Students will see your library and immediately proceed to booking."
          />
        </div>

        {/* Website Embed Code */}
        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-[#0a1128]/10 text-[#0a1128] rounded-xl">
              <Code className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold font-heading">Website Embed Code</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Copy and paste this HTML code into your own library&apos;s website to enable native bookings.
          </p>

          <CopyableField 
            label="iframe Code"
            value={`<iframe src="https://www.focusx.in/library/${library.id}/book?embed=true" width="100%" height="800px" frameborder="0" style="border: 1px solid #eee; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.05);"></iframe>`}
            isTextarea={true}
            hint="The header and footer are automatically hidden in embed mode."
          />
        </div>

      </div>
    </div>
  );
}
