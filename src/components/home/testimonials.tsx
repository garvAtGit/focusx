"use client"

import { motion } from "framer-motion"
import { Star } from "lucide-react"

const testimonials = [
  {
    name: "Riya Sharma",
    exam: "UPSC Aspirant",
    content: "Finding a quiet place to study in Delhi was impossible until I found FocusX. The ergonomic chairs and silent environment helped me increase my study hours from 6 to 10 hours a day.",
    initials: "RS",
    color: "bg-blue-100 text-blue-700"
  },
  {
    name: "Aman Gupta",
    exam: "CA Finalist",
    content: "The flexible booking system is a lifesaver. I only pay for the hours I actually study. Plus, the high-speed WiFi never drops during my online lectures.",
    initials: "AG",
    color: "bg-orange-100 text-orange-700"
  },
  {
    name: "Priya Patel",
    exam: "NEET Aspirant",
    content: "I love how I can see actual photos and amenities of the library before booking. The AC cooling is perfect, and the power backup ensures zero interruptions.",
    initials: "PP",
    color: "bg-teal-100 text-teal-700"
  }
]

export function Testimonials() {
  return (
    <section className="py-24 bg-[#eff3f9] relative overflow-hidden">
      <div className="container max-w-[1300px] mx-auto px-6 md:px-10">
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-extrabold tracking-tight font-heading text-slate-900"
          >
            Trusted by <span className="text-primary">Top Aspirants</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto"
          >
            Don&apos;t just take our word for it. Here is what students are saying about their FocusX experience.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.15 }}
              className="bg-white rounded-3xl p-8 shadow-sm border border-border flex flex-col justify-between"
            >
              <div>
                <div className="flex gap-1 mb-6">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="w-5 h-5 text-orange-400 fill-orange-400" />
                  ))}
                </div>
                <p className="text-slate-700 text-lg leading-relaxed mb-8 font-medium">
                  &ldquo;{testimonial.content}&rdquo;
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${testimonial.color}`}>
                  {testimonial.initials}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">{testimonial.name}</h4>
                  <p className="text-sm text-slate-500">{testimonial.exam}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
