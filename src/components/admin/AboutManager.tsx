"use client";

import { Globe2, AtSign, MessageCircle, ArrowRight } from "lucide-react";

const BRAND_GREEN = "#226B49";
const BRAND_GREEN_SOFT = "#E9F2ED";

const contacts = [
  {
    label: "WhatsApp",
    value: "+92 319 5403032",
    href: "https://wa.me/923195403032",
    icon: MessageCircle,
  },
  {
    label: "Instagram",
    value: "@foresty_nexus",
    href: "https://instagram.com/foresty_nexus",
    icon: AtSign,
  },
  {
    label: "Website",
    value: "foresty-nexus.vercel.app",
    href: "https://foresty-nexus.vercel.app",
    icon: Globe2,
  },
];

export default function AboutManager() {
  return (
    // 'bg-stone-50' provides the requested "white (not full white)" off-white theme
    <div className="relative h-full overflow-hidden bg-stone-50 px-6 py-8 md:py-10 font-sans flex flex-col">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[url('/maintree.png')] bg-no-repeat opacity-40"
        style={{ backgroundPosition: "right -3rem bottom -2rem", backgroundSize: "min(52vw, 42rem) auto" }}
      />
      <div className="relative max-w-[78rem] mx-auto w-full flex-1 flex flex-col">
        {/* Main Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-start">
          {/* Left Column: Text Info */}
          <section className="lg:col-span-5 flex flex-col justify-center pt-4">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-8 h-[2px] bg-green-600"></span>
              <span className="text-sm font-bold tracking-widest text-green-600 uppercase">
                About Us
              </span>
            </div>

            <h1 className="text-4xl md:text-5xl font-extrabold text-stone-900 leading-[1.15] tracking-tight mb-6">
              The people behind <br />
              <span className="text-green-600">Sevesto POS.</span>
            </h1>

            <div className="space-y-4 text-stone-600 text-base md:text-lg leading-relaxed max-w-lg">
              <p>
                We build what businesses need to grow. Foresty helps businesses
                turn everyday problems into better systems, better experiences,
                and better growth. From getting discovered online to bringing in
                more customers, simplifying operations, automating repetitive
                work, and keeping everything easier to manage  we build the
                digital tools that make running a business less complicated.
                Websites. Business software. Automation. Marketing. Systems that
                actually solve problems.
              </p>
            
            </div>
          </section>

          {/* Right Column: Contact Card */}
          <section className="lg:col-span-7 lg:mt-[52px] bg-white/90 backdrop-blur-sm rounded-SM p-6 md:p-10 border border-stone-200">
            <div className="mb-8">
              <span className="inline-block px-3 py-1 bg-[#E9F2ED] text-[#226B49] text-xs font-bold uppercase tracking-widest rounded-sm mb-4">
                Reach us directly
              </span>
              <h2 className="text-3xl font-extrabold text-stone-900 mb-2">
                Get in touch
              </h2>
              <p className="text-stone-500 text-base">
                Support, changes, or a new project: message Foresty directly.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {contacts.map((contact) => {
                const Icon = contact.icon;
                return (
                  <a
                    key={contact.label}
                    href={contact.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col p-5 rounded-2xl border border-stone-200 bg-stone-50 hover:bg-white hover:border-[#226B49] hover:shadow-md transition-all duration-200 no-underline relative min-h-[160px]"
                  >
                    <span className="w-12 h-12 rounded-xl bg-[#E9F2ED] text-[#226B49] flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-200">
                      <Icon size={24} strokeWidth={2} aria-hidden="true" />
                    </span>

                    <div className="mt-auto pb-10">
                      <span className="block text-lg font-bold text-stone-900 mb-1 ">
                        {contact.label}
                      </span>
                      <span className={`block text-sm text-stone-500 group-hover:text-stone-700 transition-colors ${
                        contact.label === "Website" ? "whitespace-nowrap text-[13px]" : "break-all"
                      }`}>
                        {contact.value}
                      </span>
                    </div>

                    <div className="absolute bottom-5 right-5 w-8 h-8 rounded-full bg-stone-200 text-[#226B49] flex items-center justify-center group-hover:bg-[#226B49] group-hover:text-white transition-colors duration-200">
                      <ArrowRight size={16} strokeWidth={2.5} />
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-auto pt-8 text-center flex items-center justify-center gap-4 text-stone-400 text-sm">
          <span className="w-12 h-[1px] bg-stone-200"></span>
          <p>Sevesto POS · A product by <a href="https://foresty-nexus.vercel.app" target="_blank" rel="noopener noreferrer" className="text-green-500 hover:underline">FORESTY</a></p>
          <span className="w-12 h-[1px] bg-stone-200"></span>
        </div>
      </div>
    </div>
  );
}
