'use client';

import { Bell, BellRing, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { markNotificationRead } from "@/app/actions/notification-actions";
import { useRouter } from "next/navigation";
import type { Notification } from "@prisma/client";
import ReactMarkdown from 'react-markdown';
import { formatDistanceToNow } from 'date-fns';

export function NotificationBell({ 
  notifications 
}: { 
  notifications: Notification[]
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleOpenChange = async (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen && unreadCount > 0) {
      // Mark as read when closing the sheet
      const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
      for (const id of unreadIds) {
        await markNotificationRead(id);
      }
      router.refresh();
    }
  };

  const filteredNotifications = notifications.filter(n => 
    activeTab === 'unread' ? !n.isRead : true
  );

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger className="relative w-10 h-10 sm:w-11 sm:h-11 flex-shrink-0 flex items-center justify-center rounded-full hover:bg-muted transition-colors mr-1 sm:mr-2">
          <Bell size={24} className="!w-6 !h-6 text-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white border-2 border-background">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
      </SheetTrigger>
      
      {/* w-full for mobile, w-[450px] for desktop */}
      <SheetContent className="w-full sm:max-w-[450px] p-0 flex flex-col border-l border-border bg-background">
        <SheetHeader className="p-4 sm:px-6 border-b border-border bg-background/50 backdrop-blur-md sticky top-0 z-10 flex flex-row items-center justify-between">
          <SheetTitle className="text-xl font-heading font-bold text-foreground">Notifications</SheetTitle>
        </SheetHeader>

        <div className="flex px-4 sm:px-6 pt-4 pb-2 gap-2 border-b border-border/50">
          <button 
            onClick={() => setActiveTab('all')}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${activeTab === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          >
            All
          </button>
          <button 
            onClick={() => setActiveTab('unread')}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors flex items-center gap-1.5 ${activeTab === 'unread' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          >
            Unread
            {unreadCount > 0 && (
              <span className={`flex h-4 min-w-4 items-center justify-center rounded-full text-[10px] px-1 ${activeTab === 'unread' ? 'bg-primary-foreground text-primary' : 'bg-primary/20 text-foreground'}`}>
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Bell className="w-8 h-8 opacity-20 mb-2" />
              <p className="text-sm">No notifications here</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {filteredNotifications.map(notif => {
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

                return (
                <div 
                  key={notif.id} 
                  className={`relative p-4 sm:px-6 border-b border-border/50 transition-colors ${!notif.isRead ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/30'}`}
                >
                  {!notif.isRead && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" />
                  )}
                  
                  <div className="flex items-start gap-4">
                    <div className={`h-10 w-10 shrink-0 rounded-full ${iconBg} flex items-center justify-center border mt-1`}>
                      <Icon className={`h-5 w-5 ${iconColor}`} />
                    </div>
                    
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between items-start gap-2">
                        <p className={`text-[15px] font-bold text-foreground leading-tight`}>{notif.title}</p>
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap mt-0.5 font-medium">
                          {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      
                      <div className="text-[13px] text-muted-foreground/90 prose prose-sm max-w-none leading-snug">
                        <ReactMarkdown>{notif.message}</ReactMarkdown>
                      </div>

                      {notif.actionLabel && notif.actionUrl && (
                        <div className="pt-2">
                          <button 
                            onClick={() => {
                              setOpen(false);
                              router.push(notif.actionUrl!);
                            }}
                            className="bg-primary text-primary-foreground text-xs font-bold px-4 py-1.5 rounded-lg shadow-sm hover:opacity-90 transition-opacity inline-flex items-center"
                          >
                            {notif.actionLabel}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                )
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
