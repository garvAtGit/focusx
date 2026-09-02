"use client"

import { motion } from "framer-motion"
import { ArrowRight, LibraryBig } from "lucide-react"
import Link from "next/link"

export function PartnerCTA() {
  return (
    <section className="py-24 bg-white relative overflow-hidden">
      <div className="container max-w-[1300px] mx-auto px-6 md:px-10 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="bg-slate-900 rounded-[2.5rem] p-10 md:p-16 lg:p-20 relative overflow-hidden flex flex-col lg:flex-row items-center justify-between gap-12"
        >
          {/* Decorative Background Elements */}
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-96 h-96 bg-primary/30 blur-[100px] rounded-full" />
          <div className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/3 w-96 h-96 bg-blue-600/20 blur-[100px] rounded-full" />

          <div className="flex-1 relative z-10">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full text-white/90 text-sm font-bold mb-6 border border-white/10">
              <LibraryBig className="w-4 h-4" />
              For Library Owners
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight font-heading text-white leading-[1.1]">
              Empty seats?<br />
              <span className="text-blue-400">Fill them today.</span>
            </h2>
            <p className="mt-6 text-lg text-slate-300 max-w-xl leading-relaxed">
              Partner with FocusX to digitize your library, manage bookings seamlessly, and reach thousands of students searching for study spaces in your area.
            </p>
          </div>

          <div className="relative z-10 w-full lg:w-auto flex flex-col sm:flex-row gap-4">
            <Link 
              href="/onboarding" 
              className="inline-flex items-center justify-center gap-2 bg-primary text-white rounded-full px-8 py-4 font-bold text-lg hover:bg-blue-500 transition-all shadow-[0_10px_30px_-10px_rgba(37,99,235,0.6)]"
            >
              List Your Library
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link 
              href="/contact" 
              className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm rounded-full px-8 py-4 font-bold text-lg transition-all border border-white/10"
            >
              Contact Sales
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
