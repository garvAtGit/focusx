"use client"

import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

export function JoinNetwork() {
  return (
    <section className="py-16 md:py-24 bg-white relative">
      <div className="container max-w-[1200px] mx-auto px-6 md:px-10">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-20">
          
          {/* Left Content - Image */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="w-full lg:w-[45%] flex justify-center lg:justify-start"
          >
            <img 
              src="/join-together.svg" 
              alt="Join Focusx Network" 
              className="w-full max-w-[500px] object-contain"
            />
          </motion.div>

          {/* Right Content - Text and Buttons */}
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="w-full lg:w-[55%] flex flex-col items-center lg:items-start text-center lg:text-left"
          >
            <h2 className="text-[32px] sm:text-[38px] md:text-[44px] lg:text-[48px] font-bold text-[#000000] leading-[1.2]" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
              Better <span className="text-[#3b82f6]">Together</span>, Join<br className="hidden lg:block"/> the Focusx Network
            </h2>
            
            <p className="mt-5 md:mt-6 text-[16px] md:text-[18px] text-[#777777] max-w-xl leading-relaxed" style={{ fontFamily: 'var(--font-inter), sans-serif', fontWeight: 400 }}>
              Empower local students by listing your space. We provide the tools, you provide the environment
            </p>
            
            <div className="mt-8 md:mt-10 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
              <Link 
                href="/onboarding" 
                className="w-full sm:w-auto inline-flex justify-center items-center gap-2 bg-[#3b82f6] text-white rounded-full px-8 py-3.5 font-medium text-[16px] hover:bg-blue-600 transition-colors shadow-sm"
              >
                List Your Library <ArrowRight className="w-5 h-5" />
              </Link>
              
              <Link 
                href="/contact" 
                className="w-full sm:w-auto inline-flex justify-center items-center bg-white text-[#3b82f6] border border-[#3b82f6] rounded-full px-8 py-3.5 font-medium text-[16px] hover:bg-blue-50 transition-colors"
              >
                Contact Sales
              </Link>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  )
}
