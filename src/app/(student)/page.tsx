import prisma from "@/lib/prisma"
import { connection } from 'next/server'
import Link from "next/link"
import { ArrowRight, Search, Target, CalendarCheck } from "lucide-react"

import { JoinNetwork } from "@/components/home/join-network"
import { FeaturedCarousel } from "@/components/home/featured-carousel"
import { BentoFeatures } from "@/components/home/bento-features"
import { Testimonials } from "@/components/home/testimonials"
import { PartnerCTA } from "@/components/home/partner-cta"
import { cacheLife, cacheTag } from "next/cache"

async function getFeaturedLibraries() {
  'use cache';
  cacheLife('hours');
  cacheTag('libraries:featured');
  const libs = await prisma.library.findMany({
    where: {
      kycStatus: "APPROVED",
    },
    include: {
      plans: { where: { isActive: true } },
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  // Sort Kripa Library to the top, limit to 3
  return libs.sort((a, b) => {
    if (a.name === 'Kripa Library') return -1;
    if (b.name === 'Kripa Library') return 1;
    return 0;
  }).slice(0, 3);
}

import { getSession } from "@/app/actions/auth-actions"
import { redirect } from "next/navigation"

export default async function HomePage({ 
  searchParams 
}: { 
  searchParams: Promise<{ [key: string]: string | string[] | undefined }> 
}) {
  await connection();
  const sp = await searchParams;

  if (sp.explore !== 'true') {
    const session = await getSession();
    if (session) {
      const activeBooking = await prisma.booking.findFirst({
        where: {
          studentId: session.userId,
          status: 'CONFIRMED',
          endTime: { gt: new Date() }
        }
      });
      if (activeBooking) {
        redirect('/student/dashboard');
      }
    }
  }

  // Fetch top 3 libraries to showcase in the interactive mockup and carousel
  const libraries = await getFeaturedLibraries();

  return (
    <div className="flex flex-col bg-background overflow-hidden relative w-full">
      
      {/* 1. Hero Section */}
      <section className="bg-white w-full relative pt-12 pb-12 md:pt-20 md:pb-16">
        <div className="container mx-auto px-5 md:px-10 max-w-7xl">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-10 lg:gap-16">
            
            {/* Left Content */}
            <div className="w-full lg:w-[60%] flex flex-col items-start lg:items-start z-10 text-center lg:text-left">
              <h1 className="w-full text-[36px] sm:text-[48px] md:text-[60px] leading-[1.1] md:leading-[100%] font-bold text-[#000000] tracking-tight uppercase" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
                THE PERFECT SPACE<br className="hidden sm:block lg:block" />
                <span className="sm:hidden"> </span>
                TO <span className="font-[300]">STUDY</span>
              </h1>
              
              <p className="mt-4 md:mt-6 text-[16px] md:text-[20px] text-[#000000] max-w-[512px] leading-[26px] md:leading-[30px] mx-auto lg:mx-0" style={{ fontFamily: 'var(--font-inter), sans-serif', fontWeight: 400 }}>
                Access premium, quiet study environments designed to help you do your best work.
              </p>
              
              <div className="mt-8 md:mt-10 w-full lg:w-auto flex justify-center lg:justify-start">
                <Link 
                  href="/libraries" 
                  className="inline-flex items-center gap-2 bg-[#3b82f6] text-white rounded-full px-6 py-3 md:px-8 md:py-3 font-medium text-[15px] md:text-[16px] hover:bg-blue-600 transition-colors shadow-sm"
                >
                  Book Your Space <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
            </div>

            {/* Right Content - SVG Hand */}
            <div className="w-full lg:w-[40%] flex justify-center lg:justify-end items-center relative z-10 mt-4 lg:mt-0">
              <img 
                src="/hero-section-hand.svg" 
                alt="FocusX App QR Check-in" 
                width={450}
                height={450}
                fetchPriority="high"
                className="w-[85%] sm:w-[70%] lg:w-full max-w-[450px] h-auto object-contain lg:scale-110 lg:translate-x-10"
              />
            </div>
          </div>

          {/* 3 Bottom Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mt-16 md:mt-20 relative z-20">
            {/* Card 1 */}
            <div className="bg-white border border-[#f3f4f6] rounded-[16px] p-5 md:p-6 flex items-start gap-4 md:gap-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="bg-[#f3f4f6] rounded-full p-3 flex-shrink-0">
                <Search className="w-5 h-5 text-[#374151]" />
              </div>
              <div className="flex flex-col">
                <h3 className="text-[14px] md:text-[15px] font-[500] text-[#000000]" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>Find Your Space</h3>
                <p className="text-[12px] text-[#777777] mt-1.5 leading-[18px]" style={{ fontFamily: 'var(--font-inter), sans-serif', fontWeight: 400 }}>
                  Browse premium libraries in your area based on amenities, pricing, and ratings.
                </p>
              </div>
            </div>
            
            {/* Card 2 */}
            <div className="bg-white border border-[#f3f4f6] rounded-[16px] p-5 md:p-6 flex items-start gap-4 md:gap-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="bg-[#f3f4f6] rounded-full p-3 flex-shrink-0">
                <Target className="w-5 h-5 text-[#374151]" />
              </div>
              <div className="flex flex-col">
                <h3 className="text-[14px] md:text-[15px] font-[500] text-[#000000]" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>Book Instantly</h3>
                <p className="text-[12px] text-[#777777] mt-1.5 leading-[18px]" style={{ fontFamily: 'var(--font-inter), sans-serif', fontWeight: 400 }}>
                  Choose a flexible plan or full-day shift, select your preferred seat, and book.
                </p>
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-white border border-[#f3f4f6] rounded-[16px] p-5 md:p-6 flex items-start gap-4 md:gap-5 shadow-sm hover:shadow-md transition-shadow sm:col-span-2 md:col-span-1">
              <div className="bg-[#f3f4f6] rounded-full p-3 flex-shrink-0">
                <CalendarCheck className="w-5 h-5 text-[#374151]" />
              </div>
              <div className="flex flex-col">
                <h3 className="text-[14px] md:text-[15px] font-[500] text-[#000000]" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>Start Focusing</h3>
                <p className="text-[12px] text-[#777777] mt-1.5 leading-[18px]" style={{ fontFamily: 'var(--font-inter), sans-serif', fontWeight: 400 }}>
                  Walk in, tap your phone on the NFC card to check in, and enjoy a distraction-free environment.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Featured Libraries Carousel */}
      <FeaturedCarousel libraries={libraries} />

      {/* 3. Bento Box Features (Why Choose FocusX) */}
      <BentoFeatures />

      {/* 4. Join the Network (replaces How it Works) */}
      <JoinNetwork />

      {/* 5. Student Testimonials */}
      <Testimonials />

      {/* 6. Partner CTA */}
      <PartnerCTA />

    </div>
  )
}
