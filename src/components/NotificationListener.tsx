'use client';

import { useEffect } from 'react';
import toast from 'react-hot-toast';
import type { Notification } from "@prisma/client";
import { BellRing, X } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import { useRouter } from 'next/navigation';

import { formatDistanceToNow } from 'date-fns';

export function NotificationListener({ 
  notifications 
}: { 
  notifications: Notification[]
}) {
  const router = useRouter();

  useEffect(() => {
    // Get unread notifications
    const unread = notifications.filter(n => !n.isRead);
    
    if (unread.length === 0) return;

    // Check localStorage to see which notifications we've already popped up
    const poppedStr = localStorage.getItem('poppedNotifications');
    const poppedIds = new Set(poppedStr ? JSON.parse(poppedStr) : []);

    let newToasts = 0;

    for (const notif of unread) {
      if (!poppedIds.has(notif.id)) {
        // This is a new unread notification that we haven't toasted on this device!
        newToasts++;
        poppedIds.add(notif.id);

        // Determine Icon based on type
        let Icon = BellRing;
        let iconColor = "text-primary";
        let iconBg = "bg-primary/10 border-primary/20";
        
        if (notif.type === "WARNING" || notif.type === "EXPIRING") {
          iconColor = "text-warning";
          iconBg = "bg-warning/10 border-warning/20";
        } else if (notif.type === "SUCCESS" || notif.type === "APPROVED") {
          iconColor = "text-success";
          iconBg = "bg-success/10 border-success/20";
        }

        // Show a top-tier custom toast
        toast.custom((t) => (
          <div
            className={`${
              t.visible ? 'animate-enter' : 'animate-leave'
            } max-w-md w-full bg-background/85 backdrop-blur-xl border border-border/50 shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-black/5 overflow-hidden transform transition-all duration-300 hover:scale-[1.02] cursor-pointer`}
            onClick={() => {
              toast.dismiss(t.id);
              if (notif.actionUrl) {
                router.push(notif.actionUrl);
              } else {
                // Focus the bell
                const bell = document.querySelector('[data-state="closed"] > .lucide-bell');
                if (bell) {
                   (bell.parentElement as HTMLButtonElement)?.click();
                }
              }
            }}
          >
            <div className="flex-1 w-0 p-4 relative">
              <div className="flex items-start">
                <div className="flex-shrink-0 pt-0.5">
                  <div className={`h-10 w-10 rounded-full ${iconBg} flex items-center justify-center border`}>
                    <Icon className={`h-5 w-5 ${iconColor}`} />
                  </div>
                </div>
                <div className="ml-3 flex-1 flex flex-col gap-1">
                  <div className="flex justify-between items-start gap-2">
                    <p className="text-[15px] font-bold text-foreground leading-tight">
                      {notif.title}
                    </p>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap mt-0.5 font-medium">
                      {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="text-[13px] text-muted-foreground/90 prose prose-sm max-w-none leading-snug">
                    <ReactMarkdown>{notif.message}</ReactMarkdown>
                  </div>
                  
                  {notif.actionLabel && notif.actionUrl && (
                    <div className="mt-2.5">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          toast.dismiss(t.id);
                          router.push(notif.actionUrl!);
                        }}
                        className="bg-primary text-primary-foreground text-xs font-bold px-4 py-1.5 rounded-lg shadow-sm hover:opacity-90 transition-opacity"
                      >
                        {notif.actionLabel}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex border-l border-border">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toast.dismiss(t.id);
                }}
                className="w-full border border-transparent rounded-none rounded-r-xl p-4 flex items-center justify-center text-sm font-medium text-primary hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
              >
                <X className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
              </button>
            </div>
          </div>
        ), {
          duration: 10000, // 10 seconds so they have time to read
          position: 'top-right',
          id: notif.id // prevent duplicates
        });
      }
    }

    if (newToasts > 0) {
      // Save back to localStorage
      localStorage.setItem('poppedNotifications', JSON.stringify(Array.from(poppedIds)));
      
      // Vibrate the device if supported
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
    }

  }, [notifications, router]);

  return null; // This component doesn't render anything visible directly
}
