"use client";

import { useEffect, useState } from "react";
import { getRooms, sendChatMessage } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { BedDouble, Users, Filter } from "lucide-react";

const inr = (n) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(n) || 0);

export default function RoomsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [checkIn, setCheckIn] = useState("2026-08-01");
  const [checkOut, setCheckOut] = useState("2026-08-03");
  const [bookingMessage, setBookingMessage] = useState(null);

  useEffect(() => {
    if (user?.role === "admin") {
      router.replace("/admin");
    }
  }, [user, router]);

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const data = await getRooms(filter, checkIn, checkOut);
      setRooms(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role !== "admin") {
      fetchRooms();
    }
  }, [filter, checkIn, checkOut, user]);

  const handleBookRoom = (room) => {
    if (!user) {
      setBookingMessage({ type: "error", text: "Please log in to your account to request a booking." });
      return;
    }
    // Open conversational AI Chatbot to guide check-in/out dates details
    const event = new CustomEvent("open-chat-booking", { detail: room });
    window.dispatchEvent(event);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">

      {/* Header Banner */}
      <div className="space-y-4 border-b border-slate-200 pb-8">
        <span className="text-xs uppercase tracking-widest text-[#0071c2] font-bold">LuxeStay inventory</span>
        <h1 className="text-4xl sm:text-5xl font-bold text-slate-900">Rooms & luxury suites</h1>
        <p className="text-slate-500 text-sm sm:text-base max-w-2xl">
          Browse our oceanfront suites, garden villas, and penthouses. Select your stay dates below to check real-time room availability.
        </p>

        {/* Date Availability Calendar Search Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Check-in date</label>
            <input
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#0071c2]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Check-out date</label>
            <input
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#0071c2]"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={fetchRooms}
              className="w-full py-2.5 rounded-xl bg-[#0071c2] hover:bg-[#005ea6] text-white font-bold text-xs shadow-sm transition-colors"
            >
              Check Availability
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-3 pt-4">
          <span className="text-xs text-slate-400 font-semibold flex items-center mr-2">
            <Filter className="w-3.5 h-3.5 mr-1" /> Filter status:
          </span>
          {["all", "available", "pending_approval", "booked"].map((statusKey) => (
            <button
              key={statusKey}
              onClick={() => setFilter(statusKey)}
              className={`px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors ${
                filter === statusKey
                  ? "bg-[#0071c2] text-white shadow-sm"
                  : "bg-white text-slate-500 border border-slate-200 hover:border-[#0071c2]/50 hover:text-[#0071c2]"
              }`}
            >
              {statusKey.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Booking Alert Banner */}
      {bookingMessage && (
        <div
          className={`p-4 rounded-2xl border text-sm flex items-center justify-between animate-in fade-in duration-200 ${
            bookingMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
              : bookingMessage.type === "error"
              ? "bg-rose-50 border-rose-200 text-rose-700"
              : "bg-blue-50 border-blue-200 text-[#0071c2]"
          }`}
        >
          <span>{bookingMessage.text}</span>
          <button onClick={() => setBookingMessage(null)} className="text-xs font-bold underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Rooms Grid */}
      {loading ? (
        <div className="text-center py-20 text-slate-400">Loading room inventory…</div>
      ) : rooms.length === 0 ? (
        <div className="text-center py-20 text-slate-400 bg-white rounded-3xl border border-slate-200">
          No rooms match the selected filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-md transition-all duration-300 flex flex-col justify-between"
            >
              <div className="relative h-64 overflow-hidden">
                <img
                  src={room.image_url || "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b"}
                  alt={room.title}
                  className="w-full h-full object-cover"
                />
                {/* Status Badge */}
                <div className="absolute top-4 right-4">
                  {room.status === "available" && (
                    <span className="px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-bold shadow-sm">
                      Available
                    </span>
                  )}
                  {room.status === "pending_approval" && (
                    <span className="px-3 py-1 rounded-full bg-amber-500 text-white text-xs font-bold shadow-sm">
                      Pending approval
                    </span>
                  )}
                  {room.status === "booked" && (
                    <span className="px-3 py-1 rounded-full bg-rose-500 text-white text-xs font-bold shadow-sm">
                      Booked
                    </span>
                  )}
                </div>

                <div className="absolute bottom-4 left-4 px-3 py-1 rounded-full bg-white/95 backdrop-blur text-[#0071c2] text-xs font-bold shadow-sm">
                  ₹{inr(room.price_per_night)} / night
                </div>
              </div>

              <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center space-x-3 text-xs text-slate-400 font-semibold">
                    <span className="flex items-center"><BedDouble className="w-4 h-4 mr-1" /> {room.type}</span>
                    <span>·</span>
                    <span className="flex items-center"><Users className="w-4 h-4 mr-1" /> {room.capacity} guests</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">{room.title} <span className="text-slate-400 font-medium text-base">(Room #{room.room_number})</span></h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{room.description}</p>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  {room.status === "available" ? (
                    <button
                      onClick={() => handleBookRoom(room)}
                      className="w-full py-3 rounded-lg bg-[#0071c2] hover:bg-[#005ea6] text-white font-semibold text-sm shadow-sm transition-colors"
                    >
                      Book Room #{room.room_number}
                    </button>
                  ) : (
                    <button
                      disabled
                      className="w-full py-3 rounded-lg bg-slate-100 text-slate-400 font-semibold cursor-not-allowed uppercase text-xs tracking-wider"
                    >
                      Status: {room.status.replace("_", " ")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
