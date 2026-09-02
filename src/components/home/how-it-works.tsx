"use client"

import { motion } from "framer-motion"
import { Search, MapPin, CheckCircle2 } from "lucide-react"

const steps = [
  {
    icon: Search,
    title: "Find Your Space",
    description: "Browse premium libraries in your area based on amenities, pricing, and ratings."
  },
  {
    icon: MapPin,
    title: "Book Instantly",
    description: "Choose a flexible plan or full-day shift, select your preferred seat, and book."
  },
  {
    icon: CheckCircle2,
    title: "Start Focusing",
    description: "Walk in, tap your phone on the NFC card to check-in, and enjoy a distraction-free environment."
  }
]

export function HowItWorks() {
  return (
    <section className="py-24 bg-white relative overflow-hidden">
      <div className="container max-w-[1300px] mx-auto px-6 md:px-10">
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-extrabold tracking-tight font-heading text-slate-900"
          >
            How <span className="text-primary">FocusX</span> Works
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto"
          >
            Your perfect study session is just three clicks away.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
          {/* Connector Line */}
          <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-0.5 bg-slate-100 -z-10" />

          {steps.map((step, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.2 }}
              className="flex flex-col items-center text-center relative bg-white"
            >
              <div className="w-24 h-24 rounded-3xl bg-blue-50 flex items-center justify-center mb-6 shadow-sm border border-blue-100 relative group">
                <div className="absolute inset-0 bg-primary/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <step.icon className="w-10 h-10 text-primary" strokeWidth={1.5} />
                <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-sm shadow-lg">
                  {idx + 1}
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{step.title}</h3>
              <p className="text-slate-600 leading-relaxed max-w-sm">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
