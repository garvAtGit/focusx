'use client'
import { formatStandardDate } from "@/lib/date-utils";

import { MessageSquare, Star, AlertTriangle } from "lucide-react"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { sendNotification } from "@/app/actions/notification-actions"
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { openWhatsAppChat } from "@/lib/whatsapp";
import { WhatsAppMessageModal } from "@/components/whatsapp/WhatsAppMessageModal";

interface DashboardQuery {
  id: string;
  studentId: string;
  type: "FEEDBACK" | "COMPLAINT" | "REVIEW";
  content: string;
  rating: number | null;
  createdAt: Date;
  student: {
    name: string;
    phone?: string | null;
  };
}

export function QueriesClient({ queries }: { queries: DashboardQuery[] }) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<DashboardQuery | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [whatsAppModalData, setWhatsAppModalData] = useState<{
    isOpen: boolean;
    name: string;
    phone: string;
    initialMessage?: string;
  } | null>(null);

  const handleReplyClick = (query: DashboardQuery) => {
    setReplyingTo(query);
    setReplyMessage("");
    setReplyOpen(true);
  };

  const submitReply = async () => {
    if (!replyingTo || !replyMessage.trim()) return;
    setSending(true);
    await sendNotification(
      replyingTo.studentId,
      "Reply to your Query/Feedback",
      replyMessage
    );
    setSending(false);
    setReplyOpen(false);
    alert("Reply sent as an in-app notification!");
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Queries & Feedback</h1>
          <p className="text-muted-foreground mt-1">Manage student reviews, feedback, and complaints.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {queries.length === 0 && (
          <div className="p-8 text-center text-muted-foreground bg-card border border-border rounded-xl">
            No queries found in the database.
          </div>
        )}

        {queries.map((query, index) => (
          <div key={query.id} className="bg-card p-6 rounded-2xl border border-border shadow-sm flex flex-col sm:flex-row gap-6 items-start">
            <div className={`p-3 rounded-xl shrink-0 ${query.type === 'FEEDBACK' ? 'bg-primary/10 text-primary' : query.type === 'COMPLAINT' ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'}`}>
              {query.type === 'FEEDBACK' && <MessageSquare className="w-6 h-6" />}
              {query.type === 'COMPLAINT' && <AlertTriangle className="w-6 h-6" />}
              {query.type === 'REVIEW' && <Star className="w-6 h-6 fill-warning" />}
            </div>
            
            <div className="flex-1 space-y-2 w-full">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-foreground">#{index + 1}. {query.student.name}</h3>
                  <span className="text-muted-foreground text-sm">• {formatStandardDate(query.createdAt)}</span>
                </div>
              </div>
              
              {query.type === 'REVIEW' && query.rating && (
                <div className="flex gap-1">
                  {Array.from({length: 5}).map((_, i) => (
                    <Star key={i} className={`w-4 h-4 ${i < query.rating! ? 'text-warning fill-warning' : 'text-muted-foreground'}`} />
                  ))}
                </div>
              )}
              
              <p className="text-foreground leading-relaxed bg-muted/30 p-4 rounded-xl border border-border/50 mt-2">
                &ldquo;{query.content}&rdquo;
              </p>
            </div>
            
            <div className="flex flex-row sm:flex-col gap-2 shrink-0 w-full sm:w-auto mt-4 sm:mt-0">
              <button onClick={() => handleReplyClick(query)} className="flex-1 sm:flex-none bg-background border border-border text-foreground hover:bg-muted font-semibold px-4 py-2 rounded-lg text-sm transition-colors text-center inline-block">
                Reply
              </button>
              {query.student?.phone && (
                <button
                  type="button"
                  title="Message on WhatsApp"
                  onClick={() => {
                    setWhatsAppModalData({
                      isOpen: true,
                      name: query.student.name,
                      phone: query.student.phone!,
                      initialMessage: `Hello ${query.student.name}, regarding your ${query.type.toLowerCase()}: "${query.content.slice(0, 80)}..."\n\n`,
                    });
                  }}
                  className="flex-1 sm:flex-none bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/20 font-semibold px-3 py-2 rounded-lg text-sm transition-colors text-center inline-flex items-center justify-center gap-1.5"
                >
                  <WhatsAppIcon className="w-3.5 h-3.5" /> WhatsApp
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={replyOpen} onOpenChange={setReplyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reply to {replyingTo?.student?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-2 font-semibold">Their message:</p>
            <p className="text-sm bg-muted/30 p-3 rounded-lg border border-border mb-4 italic">&ldquo;{replyingTo?.content}&rdquo;</p>
            <Textarea
              placeholder="Type your reply here. They will receive it as an in-app notification..."
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              className="min-h-[120px]"
            />
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setReplyOpen(false)}>Cancel</Button>
            {replyingTo?.student?.phone && (
              <Button
                type="button"
                className="bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1.5 font-bold"
                onClick={async () => {
                  const waText = `*Reply to your Query/Feedback:*\n\n${replyMessage}\n\n— Sent via FocusX`;
                  openWhatsAppChat(replyingTo.student.phone, waText);
                  await submitReply();
                }}
                disabled={sending || !replyMessage.trim()}
              >
                <WhatsAppIcon className="w-4 h-4" /> Reply & Open WhatsApp
              </Button>
            )}
            <Button onClick={submitReply} disabled={sending || !replyMessage.trim()}>
              {sending ? "Sending..." : "Send In-App Notification"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {whatsAppModalData && (
        <WhatsAppMessageModal
          open={whatsAppModalData.isOpen}
          onOpenChange={(open) => setWhatsAppModalData((prev) => (prev ? { ...prev, isOpen: open } : null))}
          recipientName={whatsAppModalData.name}
          recipientPhone={whatsAppModalData.phone}
          initialMessage={whatsAppModalData.initialMessage}
        />
      )}
    </>
  )
}
