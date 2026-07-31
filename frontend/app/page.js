"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getRooms } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Sparkles, Waves, ShieldCheck, ArrowRight, BedDouble, Star } from "lucide-react";

const inr = (n) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(n) || 0);

export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role === "admin") {
      router.replace("/admin");
      return;
    }
    getRooms()
      .then((data) => setRooms(data.slice(0, 3)))
      .catch((err) => console.error("Failed to load rooms", err))
      .finally(() => setLoading(false));
  }, [user, router]);

  return (
    <div className="space-y-24 pb-24">
      {/* Hero Banner Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: copy */}
          <div className="space-y-7">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-[#0071c2] text-xs font-semibold uppercase tracking-wide">
              <Sparkles className="w-4 h-4" />
              <span>AI-powered concierge booking</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-slate-900 tracking-tight leading-[1.1]">
              Stay in comfort,<br />
              <span className="text-[#0071c2]">book in seconds.</span>
            </h1>

            <p className="max-w-xl text-base sm:text-lg text-slate-500 leading-relaxed">
              Discover serene suites and villas across India — with an instant, role-aware AI
              concierge that checks availability, books rooms, and answers every policy question for you.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
              <Link
                href="/rooms"
                className="px-7 py-3.5 rounded-lg bg-[#0071c2] hover:bg-[#005ea6] text-white font-semibold text-base shadow-sm text-center transition-colors"
              >
                Explore rooms & suites
              </Link>
              <Link
                href="/amenities"
                className="px-7 py-3.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold text-base text-center transition-colors"
              >
                View amenities
              </Link>
            </div>

            <div className="flex items-center gap-6 pt-3 text-sm text-slate-500">
              <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" /> 4.9
                <span className="font-normal text-slate-400">· 2,400+ guest reviews</span>
              </span>
              <span className="hidden sm:inline text-slate-300">|</span>
              <span className="hidden sm:inline">₹ tariffs · GST invoice · UPI accepted</span>
            </div>
          </div>

          {/* Right: image */}
          <div className="relative">
            <img
              src="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80"
              alt="LuxeStay resort"
              className="w-full h-[420px] object-cover rounded-3xl shadow-lg"
            />
            <div className="absolute -bottom-5 -left-5 bg-white rounded-2xl shadow-lg border border-slate-100 px-5 py-4 hidden sm:block">
              <p className="text-xs text-slate-400 font-medium">Starting from</p>
              <p className="text-xl font-bold text-slate-900">₹18,000<span className="text-sm font-medium text-slate-400"> / night</span></p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: Sparkles,
              title: "Role-aware AI concierge",
              body: "Ask our assistant for available rooms, book instantly, or view admin approval queues — right inside the chat widget."
            },
            {
              icon: Waves,
              title: "Serene stays across India",
              body: "Wake up to ocean sunrises, private infinity pools, and marble baths in our presidential suites and villas."
            },
            {
              icon: ShieldCheck,
              title: "Secure by design",
              body: "Robust server-side permission checks. Non-admin guests can never approve bookings or bypass database filters."
            }
          ].map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={i}
                className="bg-white border border-slate-200 p-8 rounded-2xl space-y-4 hover:shadow-md hover:border-[#0071c2]/30 transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0071c2]">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Featured Rooms Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-6">
          <div>
            <span className="text-xs uppercase tracking-widest text-[#0071c2] font-bold">Curated accommodations</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mt-1">Featured suites & villas</h2>
          </div>
          <Link
            href="/rooms"
            className="inline-flex items-center text-[#0071c2] hover:text-[#005ea6] font-semibold text-sm group"
          >
            <span>View all accommodations</span>
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading accommodations…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-md transition-all duration-300 group flex flex-col"
              >
                <div className="relative h-56 overflow-hidden">
                  <img
                    src={room.image_url || "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b"}
                    alt={room.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-white/95 backdrop-blur text-[#0071c2] text-xs font-bold shadow-sm">
                    ₹{inr(room.price_per_night)} / night
                  </div>
                </div>
                <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-xs text-slate-400 font-semibold">
                      <BedDouble className="w-4 h-4" />
                      <span>{room.type} · Room #{room.room_number}</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">{room.title}</h3>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{room.description}</p>
                  </div>
                  <Link
                    href="/rooms"
                    className="w-full py-2.5 rounded-lg bg-slate-50 hover:bg-[#0071c2] hover:text-white text-slate-700 text-center font-semibold text-xs transition-colors block border border-slate-200 hover:border-[#0071c2]"
                  >
                    View details & book
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
