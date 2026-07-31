"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { sendChatMessage, sendChatAction } from "@/lib/api";
import { Bot, Send, X, Check, ShieldAlert, MessageCircle } from "lucide-react";

// Indian Rupee formatter (e.g. 29000 -> "₹29,000")
const inr = (n) =>
  `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(n) || 0)}`;

const parseInlineFormatting = (text) => {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index} className="bg-slate-100 border border-slate-200/80 px-1 py-0.5 rounded text-[10px] text-slate-800 font-mono">{part.slice(1, -1)}</code>;
    }
    return part;
  });
};

const parseMarkdownToReact = (text) => {
  if (!text) return null;
  const lines = text.split("\n");
  return lines.map((line, idx) => {
    if (line.trim().startsWith("- ") || line.trim().startsWith("• ")) {
      const content = line.trim().replace(/^(-\s*|•\s*)/, "");
      return (
        <li key={idx} className="ml-4 list-disc pl-1 mt-1 text-slate-700 leading-relaxed text-xs">
          {parseInlineFormatting(content)}
        </li>
      );
    }
    const numListMatch = line.trim().match(/^(\d+)\.\s+(.*)/);
    if (numListMatch) {
      const num = numListMatch[1];
      const content = numListMatch[2];
      return (
        <div key={idx} className="flex items-start space-x-2.5 mt-2.5 text-xs">
          <span className="w-5 h-5 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-[10px] font-bold text-[#0071c2] flex-shrink-0 mt-0.5">
            {num}
          </span>
          <span className="text-slate-700 leading-relaxed flex-1">
            {parseInlineFormatting(content)}
          </span>
        </div>
      );
    }
    if (line.trim() === "") {
      return <div key={idx} className="h-2" />;
    }
    return (
      <p key={idx} className="text-slate-700 leading-relaxed text-xs mt-1">
        {parseInlineFormatting(line)}
      </p>
    );
  });
};

function RoomCardItem({ room, onBook }) {
  const [checkIn, setCheckIn] = useState("2026-08-01");
  const [checkOut, setCheckOut] = useState("2026-08-03");

  const nights = Math.max(
    1,
    Math.round(
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) /
        (1000 * 60 * 60 * 24)
    ) || 2
  );

  const pricePerNight = room.price_per_night || 0;
  const gstRate = pricePerNight <= 7500 ? 0.12 : 0.18;
  const baseTotal = pricePerNight * nights;
  const totalEst = baseTotal * (1 + gstRate);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 hover:border-[#0071c2]/50 transition-all shadow-sm">
      {room.image_url && (
        <img
          src={room.image_url}
          alt={room.title}
          className="w-full h-28 object-cover rounded-lg"
        />
      )}
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-semibold text-slate-800 text-sm">{room.title}</h4>
          <p className="text-xs text-slate-500">
            Room #{room.room_number} · {room.capacity} guests
          </p>
        </div>
        <div className="text-right">
          <span className="font-bold text-[#0071c2] text-sm">
            {inr(pricePerNight)}
          </span>
          <p className="text-[10px] text-slate-400">per night</p>
        </div>
      </div>
      <p className="text-xs text-slate-500 line-clamp-2">{room.description}</p>

      {/* Date Pickers & Tariff Calculation */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2 space-y-1.5 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Check-in</label>
            <input
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-[11px] text-slate-700 focus:outline-none focus:border-[#0071c2]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Check-out</label>
            <input
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-[11px] text-slate-700 focus:outline-none focus:border-[#0071c2]"
            />
          </div>
        </div>
        <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1 border-t border-slate-200/60">
          <span>{nights} night{nights > 1 ? "s" : ""} · GST {Math.round(gstRate * 100)}%</span>
          <span className="font-bold text-[#0071c2]">Est. Total: {inr(totalEst)}</span>
        </div>
      </div>

      <button
        onClick={() => onBook(checkIn, checkOut)}
        className="w-full py-2 mt-1 rounded-lg bg-[#0071c2] hover:bg-[#005ea6] text-white font-semibold text-xs transition-colors shadow-sm"
      >
        Book for {checkIn} → {checkOut}
      </button>
    </div>
  );
}

export default function ChatWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const isAgencyAdmin = user?.role === "admin";

  const [messages, setMessages] = useState([
    {
      sender: "bot",
      payload: {
        type: "text",
        message: isAgencyAdmin
          ? "Welcome, Agency Administrator! I am LuxeStay's Agency Operations Assistant. Ask me to review pending booking requests ('Show me booking requests'), check property occupancy, or manage room inventory."
          : "Namaste! I'm the LuxeStay concierge. Ask me about available rooms, request a booking, or check our hotel policies — tariffs, GST, check-in and more."
      }
    }
  ]);

  // Update initial message if user switches role/logs in
  useEffect(() => {
    if (messages.length === 1 && messages[0].sender === "bot") {
      setMessages([
        {
          sender: "bot",
          payload: {
            type: "text",
            message: isAgencyAdmin
              ? "Welcome, Agency Administrator! I am LuxeStay's Agency Operations Assistant. Ask me to review pending booking requests ('Show me booking requests'), check property occupancy, or manage room inventory."
              : "Namaste! I'm the LuxeStay concierge. Ask me about available rooms, request a booking, or check our hotel policies — tariffs, GST, check-in and more."
          }
        }
      ]);
    }
  }, [user]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const [addOnTransfer, setAddOnTransfer] = useState(false);
  const [addOnSpa, setAddOnSpa] = useState(false);
  const [addOnChef, setAddOnChef] = useState(false);
  const [addOnExtraBed, setAddOnExtraBed] = useState(false);
  const [confirmedBookingIndices, setConfirmedBookingIndices] = useState([]);
  const [submittedCardsData, setSubmittedCardsData] = useState({});
  const [toast, setToast] = useState(null);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    setAddOnTransfer(false);
    setAddOnSpa(false);
    setAddOnChef(false);
    setAddOnExtraBed(false);
    setConfirmedBookingIndices([]);
    setSubmittedCardsData({});
  }, [isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  // Listen for public rooms page booking trigger event to start conversational booking
  useEffect(() => {
    const handleOpenChatBooking = async (e) => {
      const room = e.detail;
      setIsOpen(true);
      
      const bookText = `I want to book the ${room.title} (Room #${room.room_number})`;
      setMessages((prev) => [...prev, { sender: "user", text: bookText }]);
      setLoading(true);
      try {
        const history = getChatHistory();
        const response = await sendChatMessage(`I want to book ${room.title} Room #${room.room_number}`, history);
        setMessages((prev) => [...prev, { sender: "bot", payload: response }]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            sender: "bot",
            payload: {
              type: "error",
              message: err.message || "Failed to start booking conversation."
            }
          }
        ]);
      } finally {
        setLoading(false);
      }
    };
    window.addEventListener("open-chat-booking", handleOpenChatBooking);
    return () => {
      window.removeEventListener("open-chat-booking", handleOpenChatBooking);
    };
  }, [messages]);

  const getChatHistory = () => {
    return messages
      .slice(-10)
      .map((msg) => ({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.sender === "user" ? (msg.text || "") : (msg.payload?.message || "")
      }))
      .filter((item) => item.content.trim() !== "");
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    const currentHistory = getChatHistory();
    setMessages((prev) => [...prev, { sender: "user", text: userMessage }]);
    setLoading(true);

    try {
      const response = await sendChatMessage(userMessage, currentHistory);
      setMessages((prev) => [...prev, { sender: "bot", payload: response }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          payload: {
            type: "error",
            message: err.message || "Failed to reach AI assistant server."
          }
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmBooking = async (confirmItem, msgIndex) => {
    if (!user) {
      showToast("Please log in to confirm a booking.");
      return;
    }
    setLoading(true);
    setMessages((prev) => [...prev, { sender: "user", text: `Confirm booking for Room #${confirmItem.room_number}` }]);
    try {
      const response = await sendChatAction(null, "confirm_booking", {
        room_number: confirmItem.room_number,
        check_in_date: confirmItem.check_in_date,
        check_out_date: confirmItem.check_out_date,
        num_guests: confirmItem.num_guests,
        add_on_airport_transfer: addOnTransfer,
        add_on_spa_package: addOnSpa,
        add_on_private_chef: addOnChef,
        add_on_extra_bed: addOnExtraBed
      });
      setMessages((prev) => [...prev, { sender: "bot", payload: response }]);
      setConfirmedBookingIndices((prev) => [...prev, msgIndex]);
      
      const pricePerNight = confirmItem.price_per_night || 0;
      const nights = confirmItem.nights || 2;
      const gstRate = pricePerNight <= 7500 ? 0.12 : 0.18;
      const baseTotal = pricePerNight * nights;
      const roomGst = baseTotal * gstRate;
      const transferFee = addOnTransfer ? 3000 : 0;
      const spaFee = addOnSpa ? 6000 : 0;
      const chefFee = addOnChef ? 4500 : 0;
      const bedFee = addOnExtraBed ? (1500 * nights) : 0;
      const servicesSubtotal = transferFee + spaFee + chefFee + bedFee;
      const servicesGst = servicesSubtotal * 0.18;
      const finalPrice = baseTotal + roomGst + servicesSubtotal + servicesGst;

      setSubmittedCardsData((prev) => ({
        ...prev,
        [msgIndex]: {
          transfer: addOnTransfer,
          spa: addOnSpa,
          chef: addOnChef,
          extraBed: addOnExtraBed,
          totalPrice: finalPrice
        }
      }));

      setAddOnTransfer(false);
      setAddOnSpa(false);
      setAddOnChef(false);
      setAddOnExtraBed(false);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          payload: {
            type: "error",
            message: err.message || "Failed to confirm reservation."
          }
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (bookingId, actionType) => {
    setLoading(true);
    try {
      const response = await sendChatAction(bookingId, actionType);
      setMessages((prev) => [...prev, { sender: "bot", payload: response }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          payload: {
            type: "error",
            message: err.message || "Failed to process chat action."
          }
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleBookFromCard = async (room, checkIn, checkOut) => {
    if (!user) {
      showToast("Please log in to book a room.");
      return;
    }
    setLoading(true);
    const inDate = checkIn || "2026-08-01";
    const outDate = checkOut || "2026-08-03";
    const bookMsg = `Book room ${room.room_number} checkin ${inDate} checkout ${outDate}`;
    const currentHistory = getChatHistory();
    setMessages((prev) => [...prev, { sender: "user", text: `Book Room #${room.room_number} (${room.title}) from ${inDate} to ${outDate}` }]);
    try {
      const response = await sendChatMessage(bookMsg, currentHistory);
      setMessages((prev) => [...prev, { sender: "bot", payload: response }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          payload: {
            type: "error",
            message: err.message || "Failed to submit booking request."
          }
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center space-x-2.5 pl-4 pr-5 py-3 rounded-full text-white font-semibold shadow-lg transition-colors duration-200 bg-[#0071c2] hover:bg-[#005ea6] shadow-blue-900/20"
        >
          <MessageCircle className="w-5 h-5 text-white" />
          <span>{isAgencyAdmin ? "Agency AI Assistant" : "Chat with concierge"}</span>
        </button>
      )}

      {/* Chat Window Drawer */}
      {isOpen && (
        <div className="w-[380px] sm:w-[420px] h-[600px] max-h-[85vh] bg-white border border-slate-200 rounded-2xl shadow-2xl shadow-slate-900/20 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

          {/* Header */}
          <div className="px-5 py-4 flex items-center justify-between bg-[#0071c2]">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white/15 text-white">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-[15px] leading-tight">
                  {isAgencyAdmin ? "Agency Operations AI" : "LuxeStay Concierge"}
                </h3>
                <span className="flex items-center text-[11px] text-blue-100/90">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full mr-1.5 animate-pulse" />
                  {isAgencyAdmin ? "Agency Portal Active (Admin)" : "Online · Guest Mode"}
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-full text-slate-300 hover:text-white hover:bg-white/15 transition-colors"
              aria-label="Close chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Prompts Bar */}
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center space-x-2 overflow-x-auto text-xs scrollbar-none">
            {isAgencyAdmin ? (
              <>
                <button
                  onClick={() => { setInput("Show me booking requests"); }}
                  className="whitespace-nowrap px-3 py-1.5 rounded-full bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 transition-colors font-medium"
                >
                  ⚡ Booking requests
                </button>
                <button
                  onClick={() => { setInput("Give me an occupancy and room status summary"); }}
                  className="whitespace-nowrap px-3 py-1.5 rounded-full bg-white text-slate-700 hover:border-slate-400 border border-slate-200 transition-colors"
                >
                  📊 Room inventory status
                </button>
                <button
                  onClick={() => { setInput("What are the agency approval rules?"); }}
                  className="whitespace-nowrap px-3 py-1.5 rounded-full bg-white text-slate-700 hover:border-slate-400 border border-slate-200 transition-colors"
                >
                  💼 Agency guidelines
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { setInput("What rooms are available?"); }}
                  className="whitespace-nowrap px-3 py-1.5 rounded-full bg-white text-slate-600 hover:border-[#0071c2] hover:text-[#0071c2] border border-slate-200 transition-colors"
                >
                  🏨 Available rooms
                </button>
                <button
                  onClick={() => { setInput("What is the cancellation policy?"); }}
                  className="whitespace-nowrap px-3 py-1.5 rounded-full bg-white text-slate-600 hover:border-[#0071c2] hover:text-[#0071c2] border border-slate-200 transition-colors"
                >
                  📜 Cancellation policy
                </button>
              </>
            )}
          </div>

          {/* Chat Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/60">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm ${
                    msg.sender === "user"
                      ? "bg-[#0071c2] text-white rounded-br-sm shadow-sm"
                      : "bg-white border border-slate-200 text-slate-700 rounded-bl-sm shadow-sm"
                  }`}
                >
                  {/* User Text Message */}
                  {msg.sender === "user" && <p className="leading-relaxed">{msg.text}</p>}

                  {/* Bot Dynamic JSON Payload Components */}
                  {msg.sender === "bot" && (
                    <div className="space-y-3">
                      {/* Message Context Header */}
                      {msg.payload.message && (
                        <div className="space-y-0.5">
                          {parseMarkdownToReact(msg.payload.message)}
                        </div>
                      )}

                      {/* CONTRACT TYPE 1: ROOM CARDS WITH DATE PICKER */}
                      {msg.payload.type === "room_cards" && msg.payload.data && (
                        <div className="space-y-3 mt-1">
                          {msg.payload.data.map((room) => (
                            <RoomCardItem
                              key={room.id}
                              room={room}
                              onBook={(inD, outD) => handleBookFromCard(room, inD, outD)}
                            />
                          ))}
                        </div>
                      )}

                      {/* CONTRACT TYPE 2: ACTION CARD (Admin Pending Approvals) */}
                      {msg.payload.type === "action_card" && msg.payload.actions && (
                        <div className="space-y-3 mt-1">
                          {/* Batch Actions Toolbar for Admin */}
                          {msg.payload.actions.length > 0 && (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-sm">
                              <span className="text-[11px] font-bold text-slate-700">
                                Batch ({msg.payload.actions.length} pending):
                              </span>
                              <div className="flex space-x-1.5">
                                <button
                                  onClick={() => handleAction(null, "approve_all")}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-colors flex items-center space-x-1 shadow"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Approve All</span>
                                </button>
                                <button
                                  onClick={() => handleAction(null, "reject_all")}
                                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] transition-colors flex items-center space-x-1 shadow"
                                >
                                  <X className="w-3 h-3" />
                                  <span>Reject All</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {msg.payload.actions.map((act) => (
                            <div
                              key={act.booking_id}
                              className="bg-white border border-slate-200 rounded-xl p-3 space-y-2"
                            >
                              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                <span className="font-semibold text-slate-700 text-xs">
                                  Booking #{act.booking_id}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-600 text-[10px] uppercase font-semibold border border-amber-200">
                                  Pending Approval
                                </span>
                              </div>
                              <div className="text-xs text-slate-600 space-y-1">
                                <p><strong className="text-slate-500 font-medium">Guest:</strong> {act.user_name} ({act.user_email})</p>
                                <p><strong className="text-slate-500 font-medium">Room:</strong> #{act.room_number} — {act.room_title}</p>
                                <p><strong className="text-slate-500 font-medium">Dates:</strong> 📅 {act.check_in_date || "2026-08-01"} to {act.check_out_date || "2026-08-03"}</p>
                                {act.total_price && (
                                  <p><strong className="text-slate-500 font-medium">Total Tariff:</strong> <span className="font-bold text-[#0071c2]">{inr(act.total_price)}</span> (incl. GST)</p>
                                )}
                              </div>
                              <div className="flex space-x-2 pt-1">
                                <button
                                  onClick={() => handleAction(act.booking_id, "approve")}
                                  className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors flex items-center justify-center space-x-1"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Approve</span>
                                </button>
                                <button
                                  onClick={() => handleAction(act.booking_id, "reject")}
                                  className="flex-1 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-semibold text-xs transition-colors flex items-center justify-center space-x-1"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>Reject</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* CONTRACT TYPE 3: GUEST BOOKING CONFIRMATION CARD */}
                      {/* CONTRACT TYPE 3: GUEST BOOKING CONFIRMATION CARD */}
                      {/* CONTRACT TYPE 3: GUEST BOOKING CONFIRMATION CARD */}
                      {msg.payload.type === "book_room" && msg.payload.data && msg.payload.data[0] && (() => {
                        const confirmItem = msg.payload.data[0];
                        const pricePerNight = confirmItem.price_per_night || 0;
                        const nights = confirmItem.nights || 2;
                        const gstRate = pricePerNight <= 7500 ? 0.12 : 0.18;
                        const baseTotal = pricePerNight * nights;
                        const roomGst = baseTotal * gstRate;

                        const transferFee = addOnTransfer ? 3000 : 0;
                        const spaFee = addOnSpa ? 6000 : 0;
                        const chefFee = addOnChef ? 4500 : 0;
                        const bedFee = addOnExtraBed ? (1500 * nights) : 0;

                        const servicesSubtotal = transferFee + spaFee + chefFee + bedFee;
                        const servicesGst = servicesSubtotal * 0.18;
                        const totalEst = baseTotal + roomGst + servicesSubtotal + servicesGst;

                        const submittedData = submittedCardsData[index];
                        const isLocked = !!submittedData || loading;
                        const isTransferChecked = submittedData ? submittedData.transfer : addOnTransfer;
                        const isSpaChecked = submittedData ? submittedData.spa : addOnSpa;
                        const isChefChecked = submittedData ? submittedData.chef : addOnChef;
                        const isExtraBedChecked = submittedData ? submittedData.extraBed : addOnExtraBed;
                        const liveTotalPrice = submittedData ? submittedData.totalPrice : totalEst;

                        return (
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3.5 mt-1">
                            <div className="flex justify-between items-center border-b border-slate-200/80 pb-2">
                              <span className="font-bold text-slate-800 text-xs uppercase tracking-wide">
                                Confirm Reservation
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                                isLocked && submittedData
                                  ? "bg-slate-100 text-slate-500 border-slate-200"
                                  : "bg-blue-50 text-[#0071c2] border-blue-100 animate-pulse"
                              }`}>
                                {isLocked && submittedData ? "Submitted" : "Review Pass"}
                              </span>
                            </div>
                            
                            <div className="text-xs text-slate-600 space-y-1">
                              <p><strong className="text-slate-500 font-medium">Accommodation:</strong> {confirmItem.title} (Room #{confirmItem.room_number})</p>
                              <p><strong className="text-slate-500 font-medium">Dates:</strong> 📅 {confirmItem.check_in_date} to {confirmItem.check_out_date} ({confirmItem.nights} nights)</p>
                              <p><strong className="text-slate-500 font-medium">Guests:</strong> 👥 {confirmItem.num_guests || 2} guest{(confirmItem.num_guests || 2) > 1 ? "s" : ""}</p>
                            </div>

                            {/* Premium Add-ons Section */}
                            <div className="space-y-1.5 pt-2 border-t border-slate-200/60">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                Customize Your Luxury Stay
                              </span>
                              <div className="grid grid-cols-1 gap-1.5 text-xs text-slate-700">
                                <label className={`flex items-center space-x-2.5 bg-white border border-slate-100 p-2 rounded-lg transition-colors shadow-2xs ${
                                  isLocked ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-[#0071c2]/30"
                                }`}>
                                  <input
                                    type="checkbox"
                                    checked={isTransferChecked}
                                    disabled={isLocked}
                                    onChange={(e) => setAddOnTransfer(e.target.checked)}
                                    className="rounded border-slate-300 text-[#0071c2] focus:ring-[#0071c2] w-3.5 h-3.5 cursor-pointer disabled:cursor-not-allowed"
                                  />
                                  <div className="flex-1 flex justify-between leading-none">
                                    <span>🚗 Airport Chauffeur Transfer</span>
                                    <span className="font-bold text-[#0071c2]">₹3,000</span>
                                  </div>
                                </label>
                                <label className={`flex items-center space-x-2.5 bg-white border border-slate-100 p-2 rounded-lg transition-colors shadow-2xs ${
                                  isLocked ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-[#0071c2]/30"
                                }`}>
                                  <input
                                    type="checkbox"
                                    checked={isSpaChecked}
                                    disabled={isLocked}
                                    onChange={(e) => setAddOnSpa(e.target.checked)}
                                    className="rounded border-slate-300 text-[#0071c2] focus:ring-[#0071c2] w-3.5 h-3.5 cursor-pointer disabled:cursor-not-allowed"
                                  />
                                  <div className="flex-1 flex justify-between leading-none">
                                    <span>💆 Couples Spa Session</span>
                                    <span className="font-bold text-[#0071c2]">₹6,000</span>
                                  </div>
                                </label>
                                <label className={`flex items-center space-x-2.5 bg-white border border-slate-100 p-2 rounded-lg transition-colors shadow-2xs ${
                                  isLocked ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-[#0071c2]/30"
                                }`}>
                                  <input
                                    type="checkbox"
                                    checked={isChefChecked}
                                    disabled={isLocked}
                                    onChange={(e) => setAddOnChef(e.target.checked)}
                                    className="rounded border-slate-300 text-[#0071c2] focus:ring-[#0071c2] w-3.5 h-3.5 cursor-pointer disabled:cursor-not-allowed"
                                  />
                                  <div className="flex-1 flex justify-between leading-none">
                                    <span>🍽️ Private Chef Dinner</span>
                                    <span className="font-bold text-[#0071c2]">₹4,500</span>
                                  </div>
                                </label>
                                <label className={`flex items-center space-x-2.5 bg-white border border-slate-100 p-2 rounded-lg transition-colors shadow-2xs ${
                                  isLocked ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-[#0071c2]/30"
                                }`}>
                                  <input
                                    type="checkbox"
                                    checked={isExtraBedChecked}
                                    disabled={isLocked}
                                    onChange={(e) => setAddOnExtraBed(e.target.checked)}
                                    className="rounded border-slate-300 text-[#0071c2] focus:ring-[#0071c2] w-3.5 h-3.5 cursor-pointer disabled:cursor-not-allowed"
                                  />
                                  <div className="flex-1 flex justify-between leading-none">
                                    <span>🛏️ Extra Rollaway Bed</span>
                                    <span className="font-bold text-[#0071c2]">₹1,500/night</span>
                                  </div>
                                </label>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-slate-200/60 flex justify-between items-center text-xs">
                              <span className="font-bold text-slate-700">Estimated Total (incl. GST):</span>
                              <span className="font-black text-[#0071c2] text-sm transition-all duration-200">
                                ₹{inr(liveTotalPrice)}
                              </span>
                            </div>

                            <div className="flex space-x-2 pt-1">
                              <button
                                onClick={() => handleConfirmBooking(confirmItem, index)}
                                disabled={isLocked}
                                className={`flex-1 py-2 rounded-lg font-semibold text-xs transition-colors flex items-center justify-center space-x-1 shadow-sm ${
                                  isLocked && confirmedBookingIndices.includes(index)
                                    ? "bg-slate-200 text-slate-450 cursor-not-allowed"
                                    : "bg-emerald-600 hover:bg-emerald-500 text-white"
                                }`}
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>{isLocked && confirmedBookingIndices.includes(index) ? "Request Submitted ✓" : "Confirm Booking"}</span>
                              </button>
                              <button
                                onClick={() => {
                                  setMessages((prev) => [...prev, { sender: "bot", payload: { type: "text", message: "Booking request cancelled. Let me know if you would like to look at other rooms!" } }]);
                                }}
                                disabled={isLocked}
                                className={`px-3 py-2 rounded-lg font-semibold text-xs transition-colors ${
                                  isLocked
                                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                    : "bg-slate-200 hover:bg-slate-300 text-slate-700"
                                }`}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                      {/* CONTRACT TYPE 4: OCCUPANCY WIDGET */}
                      {msg.payload.type === "occupancy_widget" && msg.payload.data && msg.payload.data[0] && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-800 space-y-4 shadow-sm mt-1 w-full max-w-sm">
                          <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#0071c2]">
                              Occupancy Dashboard
                            </span>
                            <span className="text-[10px] font-semibold text-slate-400">
                              Today
                            </span>
                          </div>
                          
                          {/* Radial Progress Ring & Overview */}
                          <div className="flex items-center space-x-4">
                            <div className="relative w-16 h-16 flex items-center justify-center">
                              <svg className="w-full h-full transform -rotate-90">
                                <circle
                                  cx="32"
                                  cy="32"
                                  r="26"
                                  strokeWidth="5"
                                  stroke="#e2e8f0"
                                  fill="transparent"
                                />
                                <circle
                                  cx="32"
                                  cy="32"
                                  r="26"
                                  strokeWidth="5"
                                  stroke="#0071c2"
                                  fill="transparent"
                                  strokeDasharray={163.36}
                                  strokeDashoffset={163.36 - (163.36 * (msg.payload.data[0].booked_rooms / msg.payload.data[0].total_rooms))}
                                  strokeLinecap="round"
                                />
                              </svg>
                              <span className="absolute text-xs font-bold text-slate-800">
                                {Math.round((msg.payload.data[0].booked_rooms / msg.payload.data[0].total_rooms) * 100)}%
                              </span>
                            </div>
                            
                            <div className="flex-1 space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-slate-500 font-medium">Total Rooms:</span>
                                <span className="font-bold text-slate-800">{msg.payload.data[0].total_rooms}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-emerald-600 font-medium">Available:</span>
                                <span className="font-bold text-emerald-700">{msg.payload.data[0].available_rooms}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[#0071c2] font-medium">Occupied:</span>
                                <span className="font-bold text-[#0071c2]">{msg.payload.data[0].booked_rooms}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-amber-600 font-medium">Pending:</span>
                                <span className="font-bold text-amber-700">{msg.payload.data[0].pending_rooms}</span>
                              </div>
                            </div>
                          </div>

                          {/* Breakdown Progress Bars */}
                          <div className="space-y-2.5 pt-2 border-t border-slate-200">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                              Category Availability
                            </span>
                            {Object.entries(msg.payload.data[0].breakdown).map(([category, stats]) => (
                              <div key={category} className="space-y-1">
                                <div className="flex justify-between text-[10px]">
                                  <span className="font-medium text-slate-655">{category}</span>
                                  <span className="text-slate-400">
                                    {stats.available} / {stats.total} avail
                                  </span>
                                </div>
                                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                  <div
                                    className="bg-[#0071c2] h-full rounded-full transition-all duration-300"
                                    style={{
                                      width: `${(stats.available / Math.max(1, stats.total)) * 100}%`
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* CONTRACT TYPE 5: ERROR / GUARDRAIL ALERT */}
                      {msg.payload.type === "error" && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start space-x-2 text-rose-600">
                          <ShieldAlert className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                          <div className="text-xs leading-relaxed">
                            <strong className="block text-rose-700 font-semibold mb-0.5">Security guardrail triggered</strong>
                            {msg.payload.message}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 text-slate-500 px-4 py-3 rounded-2xl rounded-bl-sm text-xs flex items-center space-x-2 shadow-sm">
                  <div className="w-2 h-2 bg-[#0071c2] rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-[#0071c2] rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-2 h-2 bg-[#0071c2] rounded-full animate-bounce [animation-delay:0.4s]" />
                  <span className="ml-1 text-slate-400">Concierge is typing…</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Footer Input Form */}
          <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-100 flex items-center space-x-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={user?.role === "admin" ? "Ask, or type 'Show me booking requests'…" : "Ask about rooms, tariffs or policies…"}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0071c2] focus:bg-white transition-colors"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="p-2.5 rounded-xl bg-[#0071c2] text-white hover:bg-[#005ea6] disabled:opacity-40 disabled:hover:bg-[#0071c2] transition-colors"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="absolute bottom-20 right-0 mb-4 mr-4 bg-slate-800 text-white text-sm px-4 py-2 rounded shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
          {toast}
        </div>
      )}
    </div>
  );
}
