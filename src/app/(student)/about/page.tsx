import { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us | FocusX",
  description: "Learn more about FocusX, India's premium platform to find, compare, and book study libraries and quiet spaces for uninterrupted focus.",
};

export default function AboutPage() {
  return (
    <div className="container mx-auto px-6 py-20 max-w-4xl min-h-[70vh]">
      <h1 className="text-4xl md:text-5xl font-extrabold font-heading text-slate-900 mb-8">
        About FocusX
      </h1>
      
      <div className="prose prose-lg prose-slate max-w-none space-y-6">
        <p>
          Welcome to <strong>FocusX</strong>, India&apos;s premier platform dedicated to helping students, professionals, and lifelong learners find their perfect study environment. We understand that in a bustling city, finding a quiet, dedicated space to focus can be challenging. That&apos;s why we created a seamless way to discover and reserve premium study libraries near you.
        </p>

        <h2 className="text-2xl font-bold mt-10 mb-4 text-slate-800">Our Mission</h2>
        <p>
          Our mission is simple: to provide uninterrupted focus for everyone. We partner with the best local study libraries that offer top-tier amenities—such as high-speed Wi-Fi, air conditioning, comfortable ergonomic seating, and silent zones. Whether you are preparing for competitive exams like UPSC, JEE, or NEET, or you are a remote worker needing a distraction-free day, FocusX makes it effortless to book your seat.
        </p>

        <h2 className="text-2xl font-bold mt-10 mb-4 text-slate-800">Why Choose FocusX?</h2>
        <ul className="list-disc pl-6 space-y-3">
          <li><strong>Premium Locations:</strong> We meticulously vet our partner libraries to ensure a high-quality, quiet atmosphere.</li>
          <li><strong>Flexible Booking:</strong> From daily passes to monthly reserved seats, choose a plan that fits your schedule and budget, starting from affordable rates.</li>
          <li><strong>Transparent Pricing:</strong> Compare amenities, reviews, and prices upfront with no hidden fees.</li>
        </ul>

        <h2 className="text-2xl font-bold mt-10 mb-4 text-slate-800">Join the Community</h2>
        <p>
          Start your journey towards better productivity today. Browse our network of study libraries and book your ideal space in seconds.
        </p>
      </div>
    </div>
  );
}
