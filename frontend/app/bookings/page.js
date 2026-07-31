"use client";

import { useEffect, useState, useRef } from "react";
import { getBookings, cancelBooking, payBooking } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Calendar, Wallet, CheckCircle, Clock, XCircle, AlertCircle, Printer, CreditCard, ShieldCheck, Lock } from "lucide-react";

// HTML5 Canvas Confetti Particle Generator
class ConfettiParticle {
  constructor(canvasWidth, canvasHeight) {
    this.x = canvasWidth / 2 + (Math.random() - 0.5) * 150;
    this.y = canvasHeight + 10;
    this.vx = (Math.random() - 0.5) * 16;
    this.vy = -Math.random() * 18 - 10;
    this.gravity = 0.35;
    this.color = ["#0071c2", "#10b981", "#fbbf24", "#f43f5e", "#8b5cf6"][Math.floor(Math.random() * 5)];
    this.size = Math.random() * 8 + 4;
    this.alpha = 1;
    this.decay = Math.random() * 0.015 + 0.008;
    this.rotation = Math.random() * 360;
    this.rotationSpeed = (Math.random() - 0.5) * 10;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity;
    this.alpha -= this.decay;
    this.rotation += this.rotationSpeed;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.translate(this.x, this.y);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    ctx.restore();
  }
}

const inr = (n) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(n) || 0);

export default function MyBookingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [activePrintBooking, setActivePrintBooking] = useState(null);

  const [triggerConfetti, setTriggerConfetti] = useState(false);
  const canvasRef = useRef(null);

  // Payment states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPayBooking, setSelectedPayBooking] = useState(null);
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);

  const fetchUserBookings = async () => {
    setLoading(true);
    try {
      const data = await getBookings();
      setBookings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "admin") {
      router.replace("/admin");
      return;
    }
    if (user) {
      fetchUserBookings();
    }
  }, [user, router]);

  // HTML5 Canvas Confetti Burst animation loop
  useEffect(() => {
    if (!triggerConfetti || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    let particles = Array.from({ length: 150 }, () => new ConfettiParticle(canvas.width, canvas.height));
    let animationFrameId;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.update();
        p.draw(ctx);
      });
      
      particles = particles.filter(p => p.alpha > 0 && p.y < canvas.height + 20);
      
      if (particles.length > 0) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        setTriggerConfetti(false);
      }
    };

    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [triggerConfetti]);

  // Real-Time Database Heartbeat Polling for Pending Bookings
  useEffect(() => {
    if (!user || user.role === "admin") return;

    const hasPending = bookings.some(b => b.status === "pending_approval");
    if (!hasPending) return;

    const interval = setInterval(async () => {
      try {
        const data = await getBookings();
        
        let newlyApprovedDetected = false;
        
        setBookings(prevBookings => {
          return data.map(newB => {
            const oldB = prevBookings.find(b => b.id === newB.id);
            if (oldB && oldB.status === "pending_approval" && newB.status === "approved") {
              newlyApprovedDetected = true;
            }
            return newB;
          });
        });

        if (newlyApprovedDetected) {
          setTriggerConfetti(true);
        }
      } catch (err) {
        console.error("Failed to poll live booking status", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [bookings, user]);

  const handlePrint = (booking) => {
    setActivePrintBooking(booking);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleCancel = async (bookingId) => {
    if (!confirm("Are you sure you want to cancel this reservation request?")) return;
    try {
      await cancelBooking(bookingId);
      setMessage({ type: "success", text: "Reservation cancelled successfully." });
      fetchUserBookings();
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Failed to cancel reservation." });
    }
  };

  const handlePaySubmit = async (e) => {
    e.preventDefault();
    if (!selectedPayBooking) return;
    if (cardNumber.replace(/\s/g, "").length !== 16) {
      alert("Please enter a valid 16-digit card number.");
      return;
    }
    if (cardExpiry.length !== 5) {
      alert("Please enter card expiry in MM/YY format.");
      return;
    }
    if (cardCvv.length !== 3) {
      alert("Please enter a valid 3-digit CVV code.");
      return;
    }

    setPaymentLoading(true);
    try {
      await payBooking(selectedPayBooking.id);
      setCardName("");
      setCardNumber("");
      setCardExpiry("");
      setCardCvv("");
      setShowPaymentModal(false);
      setTriggerConfetti(true);
      setMessage({ type: "success", text: "Congratulations! 30% Advance Deposit Paid. Stay Confirmed!" });
      
      // Fetch fresh bookings data
      const updated = await getBookings();
      setBookings(updated);
    } catch (err) {
      alert(err.message || "Payment transaction failed. Please check your credentials.");
    } finally {
      setPaymentLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 bg-white border border-slate-200 rounded-3xl text-center space-y-4 shadow-sm print:hidden">
        <AlertCircle className="w-12 h-12 text-[#0071c2] mx-auto animate-bounce" />
        <h2 className="text-2xl font-bold text-slate-800">Account Access Required</h2>
        <p className="text-slate-500 text-sm">Please sign in to view your orders and active stay reservations.</p>
      </div>
    );
  }

  // Compute metric stats
  const totalBookings = bookings.length;
  const pendingBookings = bookings.filter((b) => b.status === "pending_approval").length;
  const approvedBookings = bookings.filter((b) => b.status === "approved").length;

  const getVoucherPricing = (booking) => {
    if (!booking) return { roomRate: 0, nights: 0, roomBase: 0, roomGst: 0, servicesSub: 0, servicesGst: 0, total: 0 };
    const roomRate = booking.room?.price_per_night || 0;
    let nightsCount = 2;
    if (booking.check_in_date && booking.check_out_date) {
      const d1 = new Date(booking.check_in_date);
      const d2 = new Date(booking.check_out_date);
      const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
      if (diff > 0) nightsCount = diff;
    }
    const gstRate = roomRate <= 7500 ? 0.12 : 0.18;
    const roomBase = roomRate * nightsCount;
    const roomGst = roomBase * gstRate;
    
    // Addons
    const transferFee = booking.add_on_airport_transfer ? 3000 : 0;
    const spaFee = booking.add_on_spa_package ? 6000 : 0;
    const chefFee = booking.add_on_private_chef ? 4500 : 0;
    const bedFee = booking.add_on_extra_bed ? (1500 * nightsCount) : 0;
    
    const servicesSub = transferFee + spaFee + chefFee + bedFee;
    const servicesGst = servicesSub * 0.18;
    
    const total = booking.total_price || (roomBase + roomGst + servicesSub + servicesGst);
    
    return {
      roomRate,
      nights: nightsCount,
      roomBase,
      roomGst,
      servicesSub,
      servicesGst,
      transferFee,
      spaFee,
      chefFee,
      bedFee,
      total
    };
  };

  const voucher = getVoucherPricing(activePrintBooking);

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10 print:hidden">

        {/* Header Title */}
        <div className="space-y-2 border-b border-slate-200 pb-6">
          <span className="text-xs uppercase tracking-widest text-[#0071c2] font-bold">Your Account Portal</span>
          <h1 className="text-4xl font-bold text-slate-900">My reservations & orders</h1>
          <p className="text-slate-500 text-sm max-w-xl">
            Review your upcoming stays, pending approvals, completed orders, and billing invoices.
          </p>
        </div>

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex items-center space-x-4">
            <div className="p-3.5 bg-blue-50 text-[#0071c2] rounded-xl">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Stays</span>
              <span className="text-2xl font-bold text-slate-800">{totalBookings}</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex items-center space-x-4">
            <div className="p-3.5 bg-amber-50 text-amber-600 rounded-xl">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Confirmation</span>
              <span className="text-2xl font-bold text-slate-800">{pendingBookings}</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex items-center space-x-4">
            <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Confirmed Bookings</span>
              <span className="text-2xl font-bold text-slate-800">{approvedBookings}</span>
            </div>
          </div>
        </div>

        {/* Alert Banner */}
        {message && (
          <div
            className={`p-4 rounded-xl border text-sm flex items-center justify-between animate-in fade-in duration-200 ${
              message.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-rose-50 border-rose-200 text-rose-700"
            }`}
          >
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="text-xs font-bold underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Bookings Display Container */}
        {loading ? (
          <div className="text-center py-20 text-slate-400">Loading your stay history…</div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 text-slate-500 space-y-2">
            <p className="text-lg font-bold text-slate-700">No Reservations Found</p>
            <p className="text-xs text-slate-400">You haven't requested any hotel bookings yet. View available rooms to get started.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {bookings.map((booking) => {
              const room = booking.room;
              const price = booking.total_price || (room ? room.price_per_night * 2 * 1.18 : 0);
              return (
                <div
                  key={booking.id}
                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-[#0071c2]/50 transition-all flex flex-col md:flex-row"
                >
                  {/* Room Preview Image */}
                  <div className="w-full md:w-80 h-48 md:h-auto relative overflow-hidden bg-slate-100 flex-shrink-0">
                    <img
                      src={room?.image_url || "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b"}
                      alt={room?.title || "Luxury Accommodation"}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Booking Content Details */}
                  <div className="p-6 flex-1 flex flex-col justify-between space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <h3 className="text-xl font-bold text-slate-800">
                          {room?.title || "Luxury Stay Accommodation"}
                        </h3>
                        <p className="text-xs text-slate-400">
                          Booking Reference: #LS-2026-00{booking.id} · Room {room?.room_number || "TBD"}
                        </p>
                        {/* Selected Add-ons Badge list */}
                        {(booking.add_on_airport_transfer || booking.add_on_spa_package || booking.add_on_private_chef || booking.add_on_extra_bed) && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {booking.add_on_airport_transfer && (
                              <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-[#0071c2] border border-blue-100 text-[10px] font-bold">
                                🚗 Airport Chauffeur
                              </span>
                            )}
                            {booking.add_on_spa_package && (
                              <span className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-100 text-[10px] font-bold">
                                💆 Couples Spa
                              </span>
                            )}
                            {booking.add_on_private_chef && (
                              <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-100 text-[10px] font-bold">
                                🍽️ Private Chef
                              </span>
                            )}
                            {booking.add_on_extra_bed && (
                              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold">
                                🛏️ Extra Bed
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Status Badges */}
                      <div>
                        {booking.status === "pending_approval" && (
                          <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold uppercase tracking-wider">
                            <span className="flex h-2 w-2 relative mr-0.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                            </span>
                            <Clock className="w-3.5 h-3.5" />
                            <span>Awaiting Manager Approval</span>
                          </span>
                        )}
                        {booking.status === "approved" && (
                          <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-blue-50 text-[#0071c2] border border-blue-200 text-xs font-bold uppercase tracking-wider">
                            <span className="flex h-2 w-2 relative mr-0.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                            </span>
                            <Clock className="w-3.5 h-3.5" />
                            <span>Approved - Awaiting Deposit</span>
                          </span>
                        )}
                        {booking.status === "paid" && (
                          <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold uppercase tracking-wider">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Deposit Paid & Stay Confirmed</span>
                          </span>
                        )}
                        {booking.status === "rejected" && (
                          <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold uppercase tracking-wider">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Declined / Cancelled</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Dates & Billing breakdown info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 text-sm border-t border-b border-slate-100 py-4">
                      <div>
                        <span className="block text-xs text-slate-400 font-semibold uppercase tracking-wider">Stay Dates</span>
                        <span className="font-semibold text-slate-700">
                          📅 {booking.check_in_date || "2026-08-01"} to {booking.check_out_date || "2026-08-03"}
                        </span>
                        <span className="block text-[10px] text-slate-400 mt-0.5">
                          👥 {booking.num_guests || 2} guest{(booking.num_guests || 2) > 1 ? "s" : ""}
                        </span>
                      </div>

                      <div>
                        <span className="block text-xs text-slate-400 font-semibold uppercase tracking-wider">Tariff Summary</span>
                        <span className="font-semibold text-slate-700">
                          {room ? `₹${inr(room.price_per_night)} / night` : "N/A"}
                        </span>
                      </div>

                      <div>
                        <span className="block text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Price</span>
                        <span className="font-bold text-[#0071c2] text-base">
                          ₹{inr(price)}
                        </span>
                        <span className="block text-[10px] text-slate-400">(incl. statutory GST)</span>
                      </div>
                    </div>

                    {/* Cancel / Print Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                      <p className="text-xs text-slate-400 max-w-sm">
                        * Cancellations made up to 48 hours prior to check-in receive a 100% full refund.
                      </p>
                      <div className="flex space-x-3">
                        {booking.status === "approved" && (
                          <button
                            onClick={() => {
                              setSelectedPayBooking(booking);
                              setShowPaymentModal(true);
                            }}
                            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-[#0071c2] hover:bg-[#005ea6] text-white font-semibold text-xs transition-colors shadow-sm animate-pulse"
                          >
                            <CreditCard className="w-4 h-4" />
                            <span>Pay 30% Deposit</span>
                          </button>
                        )}

                        <button
                          onClick={() => handlePrint(booking)}
                          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 font-semibold text-xs transition-colors"
                        >
                          <Printer className="w-4 h-4" />
                          <span>Print Pass</span>
                        </button>

                        {booking.status !== "rejected" && (
                          <button
                            onClick={() => handleCancel(booking.id)}
                            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-100 font-semibold text-xs transition-colors"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Cancel Request</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* PRINT-ONLY GORGEOUS RESERVATION VOUCHER PASS */}
      {activePrintBooking && (
        <div className="hidden print:block p-8 font-sans text-slate-800 space-y-6 max-w-3xl mx-auto bg-white">
          <div className="flex justify-between items-center border-b-4 border-[#0071c2] pb-5">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
                Luxe<span className="text-[#0071c2]">Stay</span>
              </h1>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Resort & Villas</p>
            </div>
            <div className="text-right">
              <h2 className="text-lg font-black text-slate-950 uppercase tracking-wide">RESERVATION VOUCHER</h2>
              <p className="text-xs text-slate-500 font-medium">Ref No: #LS-2026-00{activePrintBooking.id}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 border-b border-slate-200 pb-6 text-sm">
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0071c2]">Guest Information</h3>
              <p className="font-semibold text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0071c2]">Accommodation</h3>
              <p className="font-semibold text-slate-900">{activePrintBooking.room?.title || "Luxury Stay Accommodation"}</p>
              <p className="text-xs text-slate-500">
                Room #{activePrintBooking.room?.room_number || "TBD"} · {activePrintBooking.room?.type || "Suite"} · {activePrintBooking.num_guests || 2} Guest{(activePrintBooking.num_guests || 2) > 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 border-b border-slate-200 pb-6 text-sm">
            <div className="space-y-1">
              <span className="block text-xs font-bold uppercase tracking-wider text-slate-400">Check-in date</span>
              <span className="font-semibold text-slate-900 text-base">📅 {activePrintBooking.check_in_date || "2026-08-01"}</span>
              <span className="block text-xs text-slate-500">From 2:00 PM (IST)</span>
            </div>
            <div className="space-y-1">
              <span className="block text-xs font-bold uppercase tracking-wider text-slate-400">Check-out date</span>
              <span className="font-semibold text-slate-900 text-base">📅 {activePrintBooking.check_out_date || "2026-08-03"}</span>
              <span className="block text-xs text-slate-500">Before 12:00 Noon (IST)</span>
            </div>
          </div>

          {/* Pricing breakdown details table */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3.5 text-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0071c2] border-b border-slate-200 pb-2">Tariff & Billing Breakdown</h3>
            <div className="flex justify-between text-slate-600">
              <span>Room Charge ({voucher.nights} night{voucher.nights > 1 ? "s" : ""})</span>
              <span>₹{inr(voucher.roomBase)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Room GST (12% / 18%)</span>
              <span>₹{inr(voucher.roomGst)}</span>
            </div>

            {/* Custom Amenities add-ons display */}
            {voucher.servicesSub > 0 && (
              <>
                <div className="border-t border-slate-200 pt-2 space-y-2">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Premium Experiences Selected</span>
                  {activePrintBooking.add_on_airport_transfer && (
                    <div className="flex justify-between text-slate-600 text-xs">
                      <span>• Chauffeur Airport Transfer</span>
                      <span>₹3,000</span>
                    </div>
                  )}
                  {activePrintBooking.add_on_spa_package && (
                    <div className="flex justify-between text-slate-600 text-xs">
                      <span>• Couples Spa & Wellness package</span>
                      <span>₹6,000</span>
                    </div>
                  )}
                  {activePrintBooking.add_on_private_chef && (
                    <div className="flex justify-between text-slate-600 text-xs">
                      <span>• Private Chef Dinner</span>
                      <span>₹4,500</span>
                    </div>
                  )}
                  {activePrintBooking.add_on_extra_bed && (
                    <div className="flex justify-between text-slate-600 text-xs">
                      <span>• Extra Rollaway Bed ({voucher.nights} night{voucher.nights > 1 ? "s" : ""})</span>
                      <span>₹{inr(voucher.bedFee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600 pt-1 font-semibold text-xs">
                    <span>Services Subtotal</span>
                    <span>₹{inr(voucher.servicesSub)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 text-xs">
                    <span>Services GST (18%)</span>
                    <span>₹{inr(voucher.servicesGst)}</span>
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-between border-t-2 border-slate-300 pt-2.5 font-bold text-sm text-slate-700">
              <span>Gross Stay Tariff</span>
              <span>₹{inr(voucher.total)}</span>
            </div>
            
            {activePrintBooking.status === "paid" ? (
              <>
                <div className="flex justify-between text-emerald-600 font-bold border-t border-slate-200 pt-2 text-xs">
                  <span className="flex items-center">
                    <CheckCircle className="w-3.5 h-3.5 inline mr-1" />
                    <span>30% Advance Deposit Paid</span>
                  </span>
                  <span>- ₹{inr(voucher.total * 0.3)}</span>
                </div>
                <div className="flex justify-between text-slate-500 font-medium text-xs">
                  <span>Transaction ID</span>
                  <span>{activePrintBooking.transaction_id || "N/A"}</span>
                </div>
                <div className="flex justify-between text-[#0071c2] font-black border-t-2 border-dashed border-[#0071c2] pt-2 text-base">
                  <span>Balance Due at Check-in (70%)</span>
                  <span>₹{inr(voucher.total * 0.7)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-[#0071c2] text-xs">
                <span>30% Advance Deposit Required</span>
                <span>₹{inr(voucher.total * 0.3)}</span>
              </div>
            )}
          </div>

          {/* Guidelines notes */}
          <div className="space-y-2 text-[10px] text-slate-500 pt-6 leading-relaxed border-t border-slate-100">
            <h4 className="font-bold text-slate-700 uppercase tracking-wider">Hotel Policy Guidelines:</h4>
            <p>• A valid Government photo ID card (Aadhaar Card, Passport, or Driving License) is mandatory for check-in under Indian law.</p>
            <p>• Guests may cancel bookings up to 48 hours prior to check-in for a 100% full refund. Cancellations within 48 hours incur a 1-night penalty fee.</p>
            <p>• Standard GST rates apply. Check-out tax invoices can be generated at the reception desk.</p>
          </div>
        </div>
      )}
      {/* Confetti Overlay */}
      {triggerConfetti && (
        <canvas
          ref={canvasRef}
          className="fixed inset-0 pointer-events-none z-[9999]"
        />
      )}

      {/* GLASSMORPHIC SECURE CHECKOUT MODAL */}
      {showPaymentModal && selectedPayBooking && (() => {
        const totalAmount = selectedPayBooking.total_price || 0;
        const depositAmount = totalAmount * 0.3;
        const balanceAmount = totalAmount * 0.7;

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4 animate-in fade-in duration-200 print:hidden">
            <div className="bg-white/95 border border-slate-200/80 rounded-3xl p-6 max-w-lg w-full shadow-2xl relative flex flex-col space-y-6 overflow-hidden">
              <div className="absolute right-0 top-0 w-32 h-32 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute left-0 bottom-0 w-32 h-32 bg-emerald-600/5 rounded-full blur-3xl pointer-events-none" />

              {/* Modal Header */}
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 flex items-center">
                    <ShieldCheck className="w-5 h-5 text-emerald-500 mr-2" />
                    Secure Checkout Portal
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Paying 30% Advance Deposit to confirm booking #LS-00{selectedPayBooking.id}
                  </p>
                </div>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Dynamic Credit Card Visual */}
              <div className="relative w-full h-44 rounded-2xl bg-gradient-to-tr from-[#0071c2] via-[#005ea6] to-slate-900 p-5 text-white flex flex-col justify-between shadow-lg overflow-hidden">
                <div className="absolute right-0 top-0 w-36 h-36 bg-white/5 rounded-full blur-xl pointer-events-none" />
                <div className="flex justify-between items-start">
                  <div>
                    <span className="block text-[8px] uppercase tracking-widest text-blue-100/70 font-semibold">LuxeStay Gold Pass</span>
                    <span className="text-sm font-bold tracking-wide mt-1 block">Luxury Resort & Villas</span>
                  </div>
                  <span className="text-lg font-black italic tracking-tight">VISA</span>
                </div>

                <div className="space-y-4">
                  <p className="text-lg font-mono tracking-widest text-slate-100 font-medium">
                    {cardNumber || "•••• •••• •••• ••••"}
                  </p>
                  <div className="flex justify-between items-center text-[10px]">
                    <div>
                      <span className="block uppercase text-blue-200/60 font-semibold tracking-wider">Cardholder</span>
                      <span className="font-semibold text-slate-50 tracking-wider text-xs uppercase">{cardName || "NAME ON CARD"}</span>
                    </div>
                    <div>
                      <span className="block uppercase text-blue-200/60 font-semibold tracking-wider">Expires</span>
                      <span className="font-semibold text-slate-50 tracking-wider text-xs">{cardExpiry || "MM/YY"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Checkout Form */}
              <form onSubmit={handlePaySubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 block">Cardholder Name</label>
                  <input
                    type="text"
                    required
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    placeholder="e.g. JOHN SMITH"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-[#0071c2] transition-colors bg-slate-50 focus:bg-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 block">Card Number</label>
                  <input
                    type="text"
                    required
                    maxLength="19"
                    placeholder="e.g. 4111 2222 3333 4444"
                    value={cardNumber}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      const matches = val.match(/\d{1,4}/g);
                      setCardNumber(matches ? matches.join(" ") : "");
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-[#0071c2] transition-colors bg-slate-50 focus:bg-white font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 block">Expiry Date</label>
                    <input
                      type="text"
                      required
                      maxLength="5"
                      placeholder="MM/YY"
                      value={cardExpiry}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        if (val.length >= 3) {
                          setCardExpiry(`${val.slice(0, 2)}/${val.slice(2, 4)}`);
                        } else {
                          setCardExpiry(val);
                        }
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-[#0071c2] transition-colors bg-slate-50 focus:bg-white text-center"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 block">CVV Code</label>
                    <input
                      type="password"
                      required
                      maxLength="3"
                      placeholder="•••"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ""))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-[#0071c2] transition-colors bg-slate-50 focus:bg-white text-center font-mono"
                    />
                  </div>
                </div>

                {/* Billing Summary Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 space-y-2">
                  <div className="flex justify-between">
                    <span>Total stay tariff (incl. taxes)</span>
                    <span className="font-semibold">₹{inr(totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 font-bold border-t border-slate-200/80 pt-1.5">
                    <span>30% Advance Deposit Due Now</span>
                    <span>₹{inr(depositAmount)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>70% Balance Due at check-in</span>
                    <span>₹{inr(balanceAmount)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex space-x-3 pt-2">
                  <button
                    type="submit"
                    disabled={paymentLoading}
                    className="flex-1 py-2.5 rounded-xl bg-[#0071c2] hover:bg-[#005ea6] disabled:bg-slate-350 disabled:text-slate-400 text-white font-bold text-sm transition-colors flex items-center justify-center space-x-1.5 shadow"
                  >
                    <Lock className="w-4 h-4" />
                    <span>{paymentLoading ? "Processing payment..." : `Pay Deposit (₹${inr(depositAmount)})`}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </>
  );
}
