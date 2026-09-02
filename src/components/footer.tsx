import Link from "next/link";
import Image from "next/image";
import { MapPin, Phone, Mail } from "lucide-react";
import { GlobalFeedbackModal } from "./global-feedback-modal";

export function Footer() {
  return (
    <footer className="w-full mt-auto pt-16 pb-8">
      <div className="container mx-auto px-4 md:px-10">
        <div className="bg-white border border-border/60 rounded-[32px] p-8 md:p-12 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8 mb-12">
            
            {/* Left Column */}
            <div className="flex flex-col space-y-4">
              <Link href="/" className="flex items-center gap-2 group">
                <Image src="/final-logo.svg" alt="FocusX Logo" width={48} height={48} className="object-contain" />
                <span className="text-xl tracking-tight text-primary font-heading font-bold">
                  FocusX
                </span>
              </Link>
              <p className="text-muted-foreground text-[14px] leading-relaxed max-w-sm mt-4">
                Find, compare, and shortlist study libraries near you. We help students discover reliable spaces and help owners reach the right audience.
              </p>
            </div>

            {/* Middle Column */}
            <div className="flex flex-col space-y-4">
              <h3 className="font-bold text-black mb-2">Menu</h3>
              <ul className="space-y-3 flex flex-col">
                <li><Link href="/about" className="text-[14px] text-muted-foreground hover:text-primary transition-colors">About</Link></li>
                <li><Link href="/student/profile" className="text-[14px] text-muted-foreground hover:text-primary transition-colors">Profile</Link></li>
                <li><Link href="/onboarding" className="text-[14px] text-muted-foreground hover:text-primary transition-colors">List Your Library</Link></li>
                <li><Link href="/student/saved" className="text-[14px] text-muted-foreground hover:text-primary transition-colors">Favourites</Link></li>
                <li><Link href="/privacy" className="text-[14px] text-muted-foreground hover:text-primary transition-colors">Privacy Policy</Link></li>
                <li><Link href="/contact" className="text-[14px] text-muted-foreground hover:text-primary transition-colors">Contact</Link></li>
                <li><GlobalFeedbackModal /></li>
              </ul>
            </div>

            {/* Right Column */}
            <div className="flex flex-col space-y-4">
              <h3 className="font-bold text-black mb-2">Contact Us</h3>
              <ul className="space-y-4">
                <li>
                  <a href="tel:+919354610893" className="flex items-start gap-3 text-muted-foreground hover:text-primary transition-colors">
                    <Phone className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span className="text-[14px]">+91 9354610893</span>
                  </a>
                </li>
                <li>
                  <a href="https://maps.google.com/?q=DTU+IIF+AB-4,+Shahbad,+Rohini,+Delhi,+110042" target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 text-muted-foreground hover:text-primary transition-colors">
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span className="text-[14px]">DTU IIF AB-4, Shahbad, Rohini, Delhi, 110042</span>
                  </a>
                </li>
                <li>
                  <a href="mailto:focusdesk.in@gmail.com" className="flex items-start gap-3 text-muted-foreground hover:text-primary transition-colors">
                    <Mail className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span className="text-[14px]">focusdesk.in@gmail.com</span>
                  </a>
                </li>
              </ul>
            </div>

          </div>

          <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-border/40 gap-4">
            <p className="text-[13px] text-muted-foreground text-center md:text-left max-w-xl">
              ©2026 FocusDesk Private Limited. Explore study spaces, save your shortlist, and connect students with trusted libraries.
            </p>
            <div className="flex gap-4">
              <a href="https://www.youtube.com/@FocusXTalks" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M19.812 5.418c.861.23 1.538.907 1.768 1.768C21.998 8.746 22 12 22 12s0 3.255-.418 4.814a2.504 2.504 0 0 1-1.768 1.768c-1.56.419-7.814.419-7.814.419s-6.255 0-7.814-.419a2.505 2.505 0 0 1-1.768-1.768C2 15.255 2 12 2 12s0-3.255.417-4.814a2.507 2.507 0 0 1 1.768-1.768C5.744 5 11.998 5 11.998 5s6.255 0 7.814.418ZM15.194 12 10 15V9l5.194 3Z" clipRule="evenodd" />
                </svg>
              </a>
              <a href="https://x.com/focusx_in" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0 0 22 5.92a8.19 8.19 0 0 1-2.357.646 4.118 4.118 0 0 0 1.804-2.27 8.224 8.224 0 0 1-2.605.996 4.107 4.107 0 0 0-6.993 3.743 11.65 11.65 0 0 1-8.457-4.287 4.106 4.106 0 0 0 1.27 5.477A4.072 4.072 0 0 1 2.8 9.713v.052a4.105 4.105 0 0 0 3.292 4.022 4.095 4.095 0 0 1-1.853.07 4.108 4.108 0 0 0 3.834 2.85A8.233 8.233 0 0 1 2 18.407a11.616 11.616 0 0 0 6.29 1.84" />
                </svg>
              </a>
              <a href="https://www.instagram.com/focusx.in" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 0 1 1.772 1.153 4.902 4.902 0 0 1 1.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 0 1-1.153 1.772 4.902 4.902 0 0 1-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 0 1-1.772-1.153 4.902 4.902 0 0 1-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 0 1 1.153-1.772A4.902 4.902 0 0 1 5.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 0 0-.748-1.15 3.098 3.098 0 0 0-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 1 1 0 10.27 5.135 5.135 0 0 1 0-10.27zm0 1.802a3.333 3.333 0 1 0 0 6.666 3.333 3.333 0 0 0 0-6.666zm5.338-3.205a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4z" clipRule="evenodd" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
