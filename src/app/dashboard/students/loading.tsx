"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { motion } from "framer-motion"

export default function StudentsLoading() {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  }

  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-2">
          <Skeleton className="h-10 w-48 bg-muted" />
          <Skeleton className="h-4 w-64 bg-muted/50" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-10 bg-muted rounded-md" />
          <Skeleton className="h-10 w-32 bg-muted rounded-md" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/20">
          <Skeleton className="h-10 w-full sm:w-64 bg-muted" />
          <Skeleton className="h-10 w-full sm:w-32 bg-muted" />
        </div>
        
        <motion.div 
          className="p-4 space-y-4"
          variants={container}
          initial="hidden"
          animate="show"
        >
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <motion.div key={i} variants={item} className="flex items-center justify-between space-x-4">
              <Skeleton className="h-16 w-full bg-muted/40 rounded-lg" />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}
