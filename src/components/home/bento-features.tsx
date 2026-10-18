"use client"

import { motion } from "framer-motion"

const features = [
  {
    title: "Book Your Seat Hassle Free",
    description: "Skip the queues and confusion. Reserve your seat instantly with a smooth booking experience.",
    image: "/booking.svg",
    points: [
      "Quick Booking",
      "Instant Confirmation",
      "Pay Online or at Counter"
    ]
  },
  {
    title: "Track Daily Progress",
    description: "Stay on top of your routine with clear, consistent tracking - every day, without effort.",
    image: "/track-progress.svg",
    points: [
      "Easy Daily Log",
      "Real-Time Insights",
      "Stay Consistent Daily"
    ]
  },
  {
    title: "Mentor Support & AI",
    description: "Access real mentors and AI-powered tools designed to support your daily progress.",
    image: "/mental-health.svg",
    points: [
      "1 on 1 Expert Guidance",
      "24/7 AI Assistance",
      "Personalized Learning Path"
    ]
  }
]

export function BentoFeatures() {
  return (
    <section className="py-20 md:py-28 bg-white relative">
      <div className="container max-w-[1200px] mx-auto px-6 md:px-10">
        <div className="text-center mb-16 md:mb-20">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-[32px] md:text-[40px] font-bold tracking-tight text-[#000000]"
            style={{ fontFamily: 'var(--font-inter), sans-serif' }}
          >
            Why Choose Focusx
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-4 md:mt-5 text-[16px] md:text-[18px] text-[#777777] max-w-2xl mx-auto leading-relaxed"
            style={{ fontFamily: 'var(--font-inter), sans-serif', fontWeight: 400 }}
          >
            Everything you need to crack your exams, designed perfectly into every library on our platform.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.15 }}
              className="bg-white border border-[#E5E7EB] rounded-[24px] p-8 md:p-10 flex flex-col items-center text-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all duration-300"
            >
              <div className="w-full max-w-[200px] h-[180px] mb-8 flex items-center justify-center">
                <img src={feature.image} alt={feature.title} className="w-full h-full object-contain" />
              </div>
              
              <h3 className="text-[20px] font-[600] text-[#1e293b] mb-4" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
                {feature.title}
              </h3>
              
              <p className="text-[14px] text-[#777777] leading-[22px] mb-8" style={{ fontFamily: 'var(--font-inter), sans-serif', fontWeight: 400 }}>
                {feature.description}
              </p>
              
              <div className="w-full flex flex-col gap-3.5 mt-auto">
                {feature.points.map((point, pIdx) => (
                  <p key={pIdx} className="text-[14px] font-[500] text-[#334155]" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
                    {point}
                  </p>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
