'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import { openWhatsAppChat } from '@/lib/whatsapp';
import { Phone, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface WhatsAppMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientName: string;
  recipientPhone?: string | null;
  initialMessage?: string;
  libraryName?: string;
  onSent?: () => void;
}

export function WhatsAppMessageModal({
  open,
  onOpenChange,
  recipientName,
  recipientPhone,
  initialMessage = '',
  libraryName,
  onSent,
}: WhatsAppMessageModalProps) {
  const [message, setMessage] = useState(initialMessage);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setMessage(initialMessage || `Hello ${recipientName || 'Student'}, `);
    }
  }, [open, initialMessage, recipientName]);

  const quickTemplates = [
    {
      label: 'Renewal Reminder',
      text: `Hello ${recipientName}, your library plan is nearing its expiry. Please renew your seat at ${libraryName || 'the library'} to keep your reservation active.`,
    },
    {
      label: 'Payment Pending',
      text: `Hello ${recipientName}, your payment for ${libraryName || 'the library'} is currently pending. Kindly complete the payment at reception or online.`,
    },
    {
      label: 'Seat Notice',
      text: `Hello ${recipientName}, regarding your seat reservation at ${libraryName || 'the library'}: please ensure to check in upon arrival.`,
    },
    {
      label: 'Important Update',
      text: `Hello ${recipientName}, here is an important notice from ${libraryName || 'FocusX Library'}:\n\n`,
    },
  ];

  const handleSend = () => {
    if (!recipientPhone) {
      toast.error('No phone number available for this student.');
      return;
    }

    if (!message.trim()) {
      toast.error('Please type a message before sending.');
      return;
    }

    // Opens focused compact single-chat window (hiding WhatsApp sidebar)
    const opened = openWhatsAppChat(recipientPhone, message.trim(), true);
    if (opened) {
      toast.success(`Opening direct WhatsApp chat for ${recipientName}`);
      onOpenChange(false);
      if (onSent) onSent();
    } else {
      toast.error('Could not open WhatsApp. Please check your browser popup settings.');
    }
  };

  const handleCopy = () => {
    if (!message.trim()) return;
    navigator.clipboard.writeText(message.trim());
    setCopied(true);
    toast.success('Message copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-6 rounded-3xl border-border bg-card">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center border border-emerald-500/20 shrink-0">
              <WhatsAppIcon className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold font-heading text-foreground">
                Message {recipientName}
              </DialogTitle>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                <Phone className="w-3 h-3 text-emerald-600" />
                <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                  {recipientPhone || 'No phone'}
                </span>
                {libraryName && <span>• {libraryName}</span>}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Quick Preset Templates */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">
              Quick Templates
            </label>
            <div className="flex flex-wrap gap-1.5">
              {quickTemplates.map((tpl) => (
                <button
                  key={tpl.label}
                  type="button"
                  onClick={() => setMessage(tpl.text)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border/80 transition-colors"
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Message Textbox */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
              Message Content
            </label>
            <Textarea
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message here..."
              className="w-full text-sm resize-none rounded-2xl border-border bg-background focus:ring-2 focus:ring-emerald-500"
            />
            <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-0.5">
              <span>Opens direct chat only with {recipientName}</span>
              <span>{message.length} characters</span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs font-semibold"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy Text'}
          </Button>

          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSend}
              disabled={!recipientPhone || !message.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50"
            >
              <WhatsAppIcon className="w-4 h-4" />
              Send on WhatsApp
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
