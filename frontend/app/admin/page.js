"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { getRooms, updateRoomStatus, getBookings, handleBookingAction, uploadKnowledge, getKnowledgeDocs } from "@/lib/api";
import { Shield, BedDouble, Database, CheckCircle, XCircle, FileText, Upload, RefreshCw, AlertCircle } from "lucide-react";

const inr = (n) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(n) || 0);

export default function AdminDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("rooms"); // "rooms" or "knowledge"

  // Rooms & Bookings State
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [bookingSearch, setBookingSearch] = useState("");
  const [bookingStatusFilter, setBookingStatusFilter] = useState("all");

  // Knowledge RAG State
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [file, setFile] = useState(null);
  const [knowledgeDocs, setKnowledgeDocs] = useState([]);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [uploading, setUploading] = useState(false);

  const refreshData = async () => {
    setRoomsLoading(true);
    try {
      const [roomsData, bookingsData, docsData] = await Promise.all([
        getRooms(),
        getBookings(),
        getKnowledgeDocs(),
      ]);
      setRooms(roomsData);
      setBookings(bookingsData);
      setKnowledgeDocs(docsData);
    } catch (err) {
      console.error("Failed to load admin data", err);
    } finally {
      setRoomsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "admin") {
      refreshData();
    }
  }, [user]);

  const handleStatusChange = async (roomId, newStatus) => {
    try {
      await updateRoomStatus(roomId, newStatus);
      refreshData();
    } catch (err) {
      alert(err.message || "Failed to update room status");
    }
  };

  const handleBookingApproveReject = async (bookingId, action) => {
    try {
      await handleBookingAction(bookingId, action);
      refreshData();
    } catch (err) {
      alert(err.message || "Action failed");
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    setUploadStatus(null);
    setUploading(true);

    const formData = new FormData();
    if (docTitle) formData.append("title", docTitle);
    if (docContent) formData.append("content", docContent);
    if (file) formData.append("file", file);

    try {
      await uploadKnowledge(formData);
      setUploadStatus({ type: "success", text: "Policy document successfully embedded and added to the knowledge base!" });
      setDocTitle("");
      setDocContent("");
      setFile(null);
      refreshData();
    } catch (err) {
      setUploadStatus({ type: "error", text: err.message || "Upload failed." });
    } finally {
      setUploading(false);
    }
  };

  if (authLoading) {
    return <div className="text-center py-20 text-slate-400">Verifying permissions…</div>;
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="max-w-md mx-auto my-20 p-8 bg-rose-50 border border-rose-200 rounded-3xl text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-400 mx-auto" />
        <h2 className="text-2xl font-bold text-rose-700">Access denied</h2>
        <p className="text-xs text-rose-500">
          This area is restricted to LuxeStay administrators only. Non-admin users are strictly blocked.
        </p>
      </div>
    );
  }

  const tabBtn = (key, Icon, label) => (
    <button
      onClick={() => setActiveTab(key)}
      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-sm font-bold transition-colors ${
        activeTab === key
          ? "bg-[#0071c2] text-white shadow-sm"
          : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );

  const filteredBookings = bookings.filter((b) => {
    // Status filter match
    if (bookingStatusFilter !== "all" && b.status !== bookingStatusFilter) return false;
    
    // Search text match (Guest name, Guest email, or Room number)
    if (bookingSearch.trim() !== "") {
      const search = bookingSearch.toLowerCase().trim();
      const nameMatch = b.user_name?.toLowerCase().includes(search);
      const emailMatch = b.user_email?.toLowerCase().includes(search);
      const roomMatch = b.room?.room_number?.toLowerCase().includes(search);
      return nameMatch || emailMatch || roomMatch;
    }
    
    return true;
  });

  const totalRoomsCount = rooms.length;
  const bookedRoomsCount = rooms.filter(r => r.status === "booked").length;
  const pendingRoomsCount = rooms.filter(r => r.status === "pending_approval").length;
  const availableRoomsCount = rooms.filter(r => r.status === "available").length;
  const occupancyRate = totalRoomsCount > 0 ? Math.round((bookedRoomsCount / totalRoomsCount) * 100) : 0;
  
  const totalRevenue = bookings
    .filter(b => b.status === "approved" || b.status === "paid")
    .reduce((sum, b) => sum + (b.total_price || 0), 0);

  const categoriesList = ["Suite", "Villa", "Executive", "Cabana"];
  const roomTypesStats = categoriesList.map(cat => {
    const catRooms = rooms.filter(r => r.type === cat);
    const total = catRooms.length;
    const avail = catRooms.filter(r => r.status === "available").length;
    return { name: cat, total, avail };
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col md:flex-row gap-8">

        {/* Protected Admin Sidebar */}
        <aside className="w-full md:w-64 bg-white border border-slate-200 rounded-3xl p-6 h-fit space-y-6 shadow-sm">
          <div className="flex items-center space-x-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0071c2]">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-base">Admin console</h2>
              <span className="text-[10px] text-[#0071c2] uppercase font-bold tracking-wider">Super administrator</span>
            </div>
          </div>

          <nav className="space-y-2">
            {tabBtn("rooms", BedDouble, "Rooms Management")}
            {tabBtn("knowledge", Database, "Knowledge Base (RAG)")}
          </nav>

          <button
            onClick={refreshData}
            className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-semibold border border-slate-200 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh data</span>
          </button>
        </aside>

        {/* Main View Panel */}
        <main className="flex-1 space-y-8">

          {/* TAB 1: ROOMS MANAGEMENT VIEW */}
          {activeTab === "rooms" && (
            <div className="space-y-8">
              {/* Agency Operations Header & Metric Cards */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded bg-blue-50 text-[#0071c2] text-[11px] font-bold uppercase tracking-wider border border-blue-100">
                      Agency Operations Center
                    </span>
                  </div>
                  <h1 className="text-2xl font-bold text-slate-900 mt-2">Agency Property Dashboard</h1>
                  <p className="text-xs text-slate-500">
                    Real-time room inventory control, batch booking approvals, and operational AI management.
                  </p>
                </div>

                {/* INTERACTIVE OPERATIONAL ANALYTICS WIDGET */}
                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 text-slate-800 grid grid-cols-1 md:grid-cols-3 gap-6 shadow-sm relative overflow-hidden">
                  
                  {/* 1. Occupancy Radial Dial */}
                  <div className="flex items-center space-x-5 border-b md:border-b-0 md:border-r border-slate-200 pb-5 md:pb-0 pr-0 md:pr-5">
                    <div className="relative w-20 h-20 flex items-center justify-center flex-shrink-0">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="40" cy="40" r="34" strokeWidth="6" stroke="#e2e8f0" fill="transparent" />
                        <circle
                          cx="40"
                          cy="40"
                          r="34"
                          strokeWidth="6"
                          stroke="#0071c2"
                          fill="transparent"
                          strokeDasharray={213.63}
                          strokeDashoffset={213.63 - (213.63 * occupancyRate) / 100}
                          strokeLinecap="round"
                          className="transition-all duration-500"
                        />
                      </svg>
                      <div className="absolute text-center">
                        <span className="text-lg font-black text-slate-800">{occupancyRate}%</span>
                        <span className="block text-[8px] uppercase tracking-wider text-slate-400 font-bold">Occupied</span>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Real-time Occupancy</h4>
                      <p className="text-xs text-slate-500 mt-1 leading-normal">
                        {bookedRoomsCount} of {totalRoomsCount} rooms are checked-in or booked today.
                      </p>
                    </div>
                  </div>

                  {/* 2. Estimated Revenue Gauge */}
                  <div className="flex items-center space-x-5 border-b md:border-b-0 md:border-r border-slate-200 pb-5 md:pb-0 pr-0 md:pr-5">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0071c2] flex-shrink-0">
                      <span className="text-xl font-bold">₹</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Approved Reservation Value</h4>
                      <p className="text-xl font-black text-emerald-600 mt-1">₹{inr(totalRevenue)}</p>
                      <p className="text-[10px] text-slate-450 mt-0.5">Estimated revenue from confirmed stays</p>
                    </div>
                  </div>

                  {/* 3. Category Stats Progress Cards */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Inventory Status</h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {roomTypesStats.map(stat => (
                        <div key={stat.name} className="bg-white border border-slate-200 rounded-xl p-2.5 space-y-1 shadow-xs">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="font-semibold text-slate-700">{stat.name}</span>
                            <span className="text-slate-400 font-bold">{stat.avail}/{stat.total}</span>
                          </div>
                          <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                            <div
                              className="bg-[#0071c2] h-full rounded-full transition-all duration-350"
                              style={{ width: `${(stat.avail / Math.max(1, stat.total)) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Rooms</span>
                    <p className="text-2xl font-bold text-slate-800">{rooms.length}</p>
                    <span className="text-[10px] text-emerald-600 font-semibold">
                      {rooms.filter((r) => r.status === "available").length} Available
                    </span>
                  </div>

                  <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Pending Requests</span>
                    <p className="text-2xl font-bold text-amber-900">
                      {bookings.filter((b) => b.status === "pending_approval").length}
                    </p>
                    <span className="text-[10px] text-amber-700 font-semibold">Requires Agency Action</span>
                  </div>

                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Confirmed Stays</span>
                    <p className="text-2xl font-bold text-emerald-900">
                      {bookings.filter((b) => b.status === "approved").length}
                    </p>
                    <span className="text-[10px] text-emerald-700 font-semibold">Approved Bookings</span>
                  </div>

                  <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#0071c2]">RAG Knowledge</span>
                    <p className="text-2xl font-bold text-slate-800">{knowledgeDocs.length}</p>
                    <span className="text-[10px] text-[#0071c2] font-semibold">Ingested Policies</span>
                  </div>
                </div>
              </div>

              {/* Pending Approval Requests Section */}
              <div className="bg-white border border-blue-200 rounded-3xl p-6 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center">
                    <span className="w-2.5 h-2.5 bg-[#0071c2] rounded-full mr-2 animate-pulse" />
                    Pending booking requests ({bookings.filter((b) => b.status === "pending_approval").length})
                  </h3>

                  {/* Batch Action Buttons for Agency Dashboard */}
                  {bookings.filter((b) => b.status === "pending_approval").length > 0 && (
                    <div className="flex space-x-2 w-full sm:w-auto">
                      <button
                        onClick={() => handleBookingApproveReject(null, "approve_all")}
                        className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors flex items-center justify-center space-x-1 shadow-sm"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Approve All</span>
                      </button>
                      <button
                        onClick={() => handleBookingApproveReject(null, "reject_all")}
                        className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors flex items-center justify-center space-x-1 shadow-sm"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject All</span>
                      </button>
                    </div>
                  )}
                </div>

                {bookings.filter((b) => b.status === "pending_approval").length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">No pending booking requests require approval at this time.</p>
                ) : (
                  <div className="space-y-3">
                    {bookings
                      .filter((b) => b.status === "pending_approval")
                      .map((b) => (
                        <div
                          key={b.id}
                          className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                        >
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-[#0071c2] text-sm">Booking #{b.id}</span>
                              <span className="text-xs text-slate-400">· Guest: {b.user_name}</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              Room: {b.room ? `${b.room.title} (#${b.room.room_number})` : `Room ID #${b.room_id}`}
                            </p>
                            {b.check_in_date && b.check_out_date && (
                              <p className="text-[11px] font-semibold text-slate-600 mt-1">
                                📅 Dates: {b.check_in_date} to {b.check_out_date} · 👥 Guests: {b.num_guests || 2} · 💰 Total Price: ₹{inr(b.total_price)}
                              </p>
                            )}
                            {/* Selected Add-ons summary */}
                            {(b.add_on_airport_transfer || b.add_on_spa_package || b.add_on_private_chef || b.add_on_extra_bed) && (() => {
                              const list = [];
                              if (b.add_on_airport_transfer) list.push("🚗 Airport Chauffeur");
                              if (b.add_on_spa_package) list.push("💆 Spa");
                              if (b.add_on_private_chef) list.push("🍽️ Chef");
                              if (b.add_on_extra_bed) list.push("🛏️ Bed");
                              return (
                                <p className="text-[10px] text-blue-600 font-semibold mt-1">
                                  ✨ Add-ons: {list.join(", ")}
                                </p>
                              );
                            })()}
                          </div>

                          <div className="flex space-x-2 w-full sm:w-auto">
                            <button
                              onClick={() => handleBookingApproveReject(b.id, "approve")}
                              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center space-x-1 shadow-sm transition-colors"
                            >
                              <CheckCircle className="w-4 h-4" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => handleBookingApproveReject(b.id, "reject")}
                              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs flex items-center justify-center space-x-1 shadow-sm transition-colors"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>Reject</span>
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Rooms Table */}
              <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-100">
                  <h3 className="text-lg font-bold text-slate-800">All hotel rooms status</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4">Room #</th>
                        <th className="px-6 py-4">Title & type</th>
                        <th className="px-6 py-4">Price / night</th>
                        <th className="px-6 py-4">Capacity</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Quick action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rooms.map((room) => (
                        <tr key={room.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 font-bold text-[#0071c2]">#{room.room_number}</td>
                          <td className="px-6 py-4">
                            <span className="font-semibold text-slate-800 block">{room.title}</span>
                            <span className="text-xs text-slate-400">{room.type}</span>
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-800">₹{inr(room.price_per_night)}</td>
                          <td className="px-6 py-4 text-xs">{room.capacity} guests</td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                                room.status === "available"
                                  ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                                  : room.status === "pending_approval"
                                  ? "bg-amber-50 text-amber-600 border-amber-200"
                                  : "bg-rose-50 text-rose-600 border-rose-200"
                              }`}
                            >
                              {room.status.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <select
                              value={room.status}
                              onChange={(e) => handleStatusChange(room.id, e.target.value)}
                              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:border-[#0071c2]"
                            >
                              <option value="available">Set available</option>
                              <option value="pending_approval">Set pending</option>
                              <option value="booked">Set booked</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Reservations Overview & Search Filters */}
              <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm space-y-4 p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">All Reservations & History</h3>
                    <p className="text-xs text-slate-400">Track and manage stay approvals, historical reservations, and guest details.</p>
                  </div>
                  
                  {/* Filter Inputs Grid */}
                  <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                    <input
                      type="text"
                      placeholder="Search guest or room..."
                      value={bookingSearch}
                      onChange={(e) => setBookingSearch(e.target.value)}
                      className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-[#0071c2] focus:bg-white w-full sm:w-48 transition-colors"
                    />
                    <select
                      value={bookingStatusFilter}
                      onChange={(e) => setBookingStatusFilter(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-600 focus:outline-none focus:border-[#0071c2] cursor-pointer"
                    >
                      <option value="all">All Statuses</option>
                      <option value="pending_approval">Pending Approval</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  {filteredBookings.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-xs italic">
                      No bookings match your current search filters.
                    </div>
                  ) : (
                    <table className="w-full text-left text-sm text-slate-600">
                      <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-4">Booking ID</th>
                          <th className="px-6 py-4">Guest Details</th>
                          <th className="px-6 py-4">Room #</th>
                          <th className="px-6 py-4">Stay Dates</th>
                          <th className="px-6 py-4">Guests</th>
                          <th className="px-6 py-4">Price</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredBookings.map((b) => (
                          <tr key={b.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4 font-bold text-[#0071c2]">#LS-{b.id}</td>
                            <td className="px-6 py-4">
                              <span className="font-semibold text-slate-800 block leading-tight">{b.user_name}</span>
                              <span className="text-[11px] text-slate-400">{b.user_email || "N/A"}</span>
                              {/* Selected Add-ons summary */}
                              {(b.add_on_airport_transfer || b.add_on_spa_package || b.add_on_private_chef || b.add_on_extra_bed) && (() => {
                                const list = [];
                                if (b.add_on_airport_transfer) list.push("🚗 Transfer");
                                if (b.add_on_spa_package) list.push("💆 Spa");
                                if (b.add_on_private_chef) list.push("🍽️ Chef");
                                if (b.add_on_extra_bed) list.push("🛏️ Bed");
                                return (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {list.map(item => (
                                      <span key={item} className="px-1.5 py-0.5 rounded bg-blue-50 text-[#0071c2] border border-blue-100 text-[8px] font-bold">
                                        {item}
                                      </span>
                                    ))}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="px-6 py-4">
                              <span className="font-semibold text-slate-800 block">Room #{b.room?.room_number || "TBD"}</span>
                              <span className="text-xs text-slate-400 truncate max-w-[120px] block">{b.room?.title}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-slate-700 block">📅 {b.check_in_date || "N/A"}</span>
                              <span className="text-[11px] text-slate-400">to {b.check_out_date || "N/A"}</span>
                            </td>
                            <td className="px-6 py-4 text-xs font-medium text-slate-700">👥 {b.num_guests || 2}</td>
                            <td className="px-6 py-4 font-bold text-slate-800">₹{inr(b.total_price)}</td>
                            <td className="px-6 py-4">
                              <span
                                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                  b.status === "paid"
                                    ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                                    : b.status === "approved"
                                    ? "bg-blue-50 text-[#0071c2] border-blue-200"
                                    : b.status === "pending_approval"
                                    ? "bg-amber-50 text-amber-600 border-amber-200"
                                    : "bg-rose-50 text-rose-600 border-rose-200"
                                }`}
                              >
                                {b.status === "pending_approval"
                                  ? "Pending"
                                  : b.status === "approved"
                                  ? "Approved"
                                  : b.status === "paid"
                                  ? "Deposit Paid"
                                  : "Cancelled"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              {b.status === "pending_approval" ? (
                                <div className="flex justify-end space-x-1.5">
                                  <button
                                    onClick={() => handleBookingApproveReject(b.id, "approve")}
                                    className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-[#10b981] hover:text-white transition-colors"
                                    title="Approve stay"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleBookingApproveReject(b.id, "reject")}
                                    className="p-1.5 rounded-lg bg-rose-50 text-rose-500 border border-rose-100 hover:bg-rose-600 hover:text-white transition-colors"
                                    title="Decline stay"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">No actions pending</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: KNOWLEDGE BASE RAG VIEW */}
          {activeTab === "knowledge" && (
            <div className="space-y-8">
              <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-2 shadow-sm">
                <h1 className="text-2xl font-bold text-slate-900">AI concierge knowledge base (RAG)</h1>
                <p className="text-xs text-slate-500">
                  Upload hotel policies, FAQs, or custom text. The backend embeds and stores them for instant RAG retrieval by the AI concierge.
                </p>
              </div>

              {/* Upload Form */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800">Ingest policy document</h3>

                {uploadStatus && (
                  <div
                    className={`p-4 rounded-2xl text-xs font-medium border ${
                      uploadStatus.type === "success"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-rose-50 border-rose-200 text-rose-600"
                    }`}
                  >
                    {uploadStatus.text}
                  </div>
                )}

                <form onSubmit={handleUploadSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Document title</label>
                    <input
                      type="text"
                      value={docTitle}
                      onChange={(e) => setDocTitle(e.target.value)}
                      placeholder="e.g. Spa & Wellness Rules 2026"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0071c2] focus:bg-white transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Policy text content</label>
                    <textarea
                      rows={5}
                      value={docContent}
                      onChange={(e) => setDocContent(e.target.value)}
                      placeholder="Paste policy rules, cancellation details, or hotel FAQs here…"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0071c2] focus:bg-white transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Or upload text file (.txt / .md)</label>
                    <input
                      type="file"
                      accept=".txt,.md"
                      onChange={(e) => setFile(e.target.files[0])}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#0071c2] file:text-white hover:file:bg-[#005ea6]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={uploading}
                    className="py-3.5 px-6 rounded-xl bg-[#0071c2] hover:bg-[#005ea6] text-white font-bold text-sm shadow-sm transition-colors flex items-center space-x-2 disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{uploading ? "Embedding document…" : "Embed into knowledge base"}</span>
                  </button>
                </form>
              </div>

              {/* Stored Knowledge Docs List */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800">Ingested documents ({knowledgeDocs.length})</h3>
                {knowledgeDocs.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No knowledge documents ingested yet.</p>
                ) : (
                  <div className="space-y-3">
                    {knowledgeDocs.map((doc) => (
                      <div key={doc.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-slate-800 text-sm flex items-center">
                            <FileText className="w-4 h-4 mr-2 text-[#0071c2]" /> {doc.title}
                          </h4>
                          <span className="text-[10px] text-slate-400">
                            {new Date(doc.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">{doc.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
