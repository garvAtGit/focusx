"use client"

import { motion } from "framer-motion"
import { ArrowRight, Heart, Star, MapPin } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { Prisma } from "@prisma/client"

type FeaturedLibrary = Prisma.LibraryGetPayload<{
  include: {
    plans: true;
  };
}>;

export function FeaturedCarousel({ libraries }: { libraries: FeaturedLibrary[] }) {
  const router = useRouter();

  if (!libraries || libraries.length === 0) return null;

  return (
    <section className="py-24 bg-[#eff3f9] relative overflow-hidden">
      <div className="container max-w-[1300px] mx-auto px-6 md:px-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl font-extrabold tracking-tight font-heading text-slate-900"
            >
              Top Rated Libraries
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="mt-3 text-lg text-slate-600 max-w-xl"
            >
              Discover the most popular study spaces in your city, vetted for quality and comfort.
            </motion.p>
          </div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <Link 
              href="/libraries" 
              className="inline-flex items-center gap-2 text-primary font-bold hover:text-blue-700 transition-colors group"
            >
              View All Libraries
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {libraries.map((lib, idx) => {
            const monthlyPlans = lib.plans?.filter((plan) => plan.validityDays >= 28) || [];
            const plansToUse = monthlyPlans.length > 0 ? monthlyPlans : (lib.plans || []);
            const minPrice = plansToUse.length > 0 ? Math.min(...plansToUse.map((plan) => plan.price)) : 500;
            const image = lib.photos?.[0] || "https://images.unsplash.com/photo-1568667256549-094345857637?w=800&q=80";
            
            return (
              <motion.div
                key={lib.id || idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.15 }}
                onClick={() => router.push(`/library/${lib.id}`)}
                className="group flex flex-col gap-4 bg-white rounded-3xl p-4 shadow-sm hover:shadow-xl transition-all duration-300 border border-border cursor-pointer"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-muted">
                  <Image
                    src={image}
                    alt={lib.name}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold shadow-sm text-slate-900 flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-orange-400 fill-orange-400" />
                    4.9
                  </div>
                  <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-sm p-2 rounded-full cursor-pointer hover:bg-black/60 transition-colors">
                    <Heart className="w-4 h-4 text-white" />
                  </div>
                </div>

                <div className="flex flex-col gap-1 px-2 pb-2">
                  <div className="flex justify-between items-start gap-4">
                    <h3 className="font-bold text-xl text-slate-900 leading-tight">
                      {lib.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-1">
                    <MapPin className="w-4 h-4" />
                    {lib.locality || "Delhi"}, {lib.city || "Delhi NCR"}
                  </div>
                  
                  <div className="w-full h-px bg-slate-100 my-3" />
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Starting from</p>
                      <p className="text-lg font-black text-slate-900">
                        ₹{minPrice} <span className="text-sm font-medium text-slate-500 font-sans">/ mo</span>
                      </p>
                    </div>
                    <Link 
                      href={`/library/${lib.id}`}
                      className="bg-primary/10 text-primary font-bold px-4 py-2 rounded-xl hover:bg-primary hover:text-white transition-colors"
                    >
                      Book Now
                    </Link>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
