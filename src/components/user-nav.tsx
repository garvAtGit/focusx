"use client"

import { LogOut, User, Heart, Calendar, LayoutDashboard, Share2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { logout } from "@/app/actions/auth-actions"
import type { User as UserRecord } from "@prisma/client"

export function UserNav({ user }: { user: UserRecord }) {
  const router = useRouter();
  const initials = user?.name ? user.name.substring(0, 1).toUpperCase() : "U";
  const isStaff = user?.role === 'LIBRARIAN' || user?.role === 'ADMIN' || user?.role === 'RECEPTIONIST';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="focus:outline-none">
        <div className="h-10 w-10 rounded-full overflow-hidden border border-border/50 hover:border-border flex items-center justify-center bg-slate-100 text-slate-700 font-medium text-base transition-all shadow-sm">
          {user?.profilePhotoUrl ? (
            <Image src={user.profilePhotoUrl} alt={user.name || "User"} width={40} height={40} className="object-cover h-full w-full" />
          ) : (
            initials
          )}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[280px] p-2 rounded-2xl shadow-xl border border-border/60 bg-white">
        <div className="flex items-center justify-start gap-3 p-3 mb-1">
          <div className="h-12 w-12 rounded-full overflow-hidden border border-border/50 flex flex-shrink-0 items-center justify-center bg-[#8B5CF6] text-white font-medium text-xl">
            {user?.profilePhotoUrl ? (
              <Image src={user.profilePhotoUrl} alt={user.name || "User"} width={48} height={48} className="object-cover h-full w-full" />
            ) : (
              initials
            )}
          </div>
          <div className="flex flex-col space-y-0.5 min-w-0">
            <p className="text-[15px] font-semibold leading-none truncate text-black">{user?.name || "User"}</p>
            <p className="text-[13px] leading-tight text-muted-foreground truncate">
              {user?.phone || user?.email}
            </p>
          </div>
        </div>
        <DropdownMenuSeparator className="bg-border/60 mx-1 my-1" />
        {isStaff && (
          <>
            <DropdownMenuGroup className="px-1 py-1">
              <DropdownMenuItem onClick={() => router.push("/dashboard")} className="rounded-lg cursor-pointer py-2.5 focus:bg-primary/10 text-primary font-semibold">
                <LayoutDashboard className="mr-3 h-[18px] w-[18px]" />
                <span className="text-[14px]">Go to Dashboard</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="bg-border/60 mx-1 my-1" />
          </>
        )}
        <DropdownMenuGroup className="px-1 py-1 space-y-0.5">
          <DropdownMenuItem onClick={() => router.push("/student/dashboard")} className="rounded-lg cursor-pointer py-2.5 focus:bg-muted focus:text-black text-black">
            <Calendar className="mr-3 h-[18px] w-[18px] text-muted-foreground" />
            <span className="font-medium text-[14px]">My Bookings</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/student/profile")} className="rounded-lg cursor-pointer py-2.5 focus:bg-muted focus:text-black text-black">
            <User className="mr-3 h-[18px] w-[18px] text-muted-foreground" />
            <span className="font-medium text-[14px]">Profile</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/student/saved")} className="rounded-lg cursor-pointer py-2.5 focus:bg-muted focus:text-black text-black">
            <Heart className="mr-3 h-[18px] w-[18px] text-muted-foreground" />
            <span className="font-medium text-[14px]">Saved libraries</span>
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: 'FocusX - Best Library Booking App',
                  text: 'Check out FocusX, the easiest way to find and book library seats!',
                  url: window.location.origin,
                }).catch(console.error);
              } else {
                navigator.clipboard.writeText(window.location.origin);
              }
            }} 
            className="rounded-lg cursor-pointer py-2.5 focus:bg-muted focus:text-black text-black"
          >
            <Share2 className="mr-3 h-[18px] w-[18px] text-muted-foreground" />
            <span className="font-medium text-[14px]">Refer & Share</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="bg-border/60 mx-1 my-1" />
        <div className="px-1 py-1">
          <DropdownMenuItem onClick={() => logout()} className="rounded-lg cursor-pointer py-2.5 focus:bg-muted focus:text-black text-black">
            <LogOut className="mr-3 h-[18px] w-[18px] text-muted-foreground" />
            <span className="font-medium text-[14px]">Sign out</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
