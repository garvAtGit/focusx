"use client";

import { useState, useTransition } from "react";
import { Bell, Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import toast from "react-hot-toast";
import { manualNotifyStudent } from "@/app/actions/rule-actions";

interface Props {
  studentId: string;
  studentName: string;
}

const TEMPLATE_HINT = "Variables: {name} {phone} {library_name}";

export function ManualNotifyModal({ studentId, studentName }: Props) {
  const [open, setOpen]           = useState(false);
  const [title, setTitle]         = useState("");
  const [message, setMessage]     = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSend() {
    if (!title.trim()) { toast.error("Title is required"); return; }
    if (!message.trim()) { toast.error("Message is required"); return; }

    startTransition(async () => {
      const res = await manualNotifyStudent(studentId, title, message);
      if (res.error) { toast.error(res.error); return; }
      toast.success(`Notification sent to ${studentName}`);
      setTitle("");
      setMessage("");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 px-3 py-1.5 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors"
          title="Send notification to this student"
        >
          <Bell className="w-3.5 h-3.5" />
          Notify
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Notification to {studentName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="notif-title">Title</Label>
            <Input
              id="notif-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Please renew your plan"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notif-message">Message</Label>
            <Textarea
              id="notif-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Hey {name}, your plan expires soon. Please visit the library to renew."
            />
            <p className="text-xs text-muted-foreground">{TEMPLATE_HINT}</p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={isPending}>
              {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Send Notification
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
