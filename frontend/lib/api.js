const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export async function apiFetch(endpoint, options = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("luxestay_token") : null;
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || data.message || "An error occurred");
  }
  return data;
}

export async function loginUser(email, password) {
  return apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function registerUser(email, password, full_name, role = "user") {
  return apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, full_name, role }),
  });
}

export async function getRooms(statusFilter, checkIn, checkOut) {
  const params = new URLSearchParams();
  if (statusFilter && statusFilter !== "all") params.append("status_filter", statusFilter);
  if (checkIn) params.append("check_in", checkIn);
  if (checkOut) params.append("check_out", checkOut);
  const queryString = params.toString() ? `?${params.toString()}` : "";
  return apiFetch(`/rooms${queryString}`);
}

export async function updateRoomStatus(roomId, status) {
  return apiFetch(`/rooms/${roomId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function getBookings() {
  return apiFetch("/bookings");
}

export async function handleBookingAction(bookingId, action) {
  return apiFetch(`/bookings/${bookingId}/action`, {
    method: "POST",
    body: JSON.stringify({ booking_id: bookingId, action }),
  });
}

export async function cancelBooking(bookingId) {
  return apiFetch(`/bookings/${bookingId}/cancel`, {
    method: "POST",
  });
}

export async function sendChatMessage(message, history = []) {
  return apiFetch("/chat", {
    method: "POST",
    body: JSON.stringify({ message, history }),
  });
}

export async function sendChatAction(bookingId, action, extra = {}) {
  return apiFetch("/chat/action", {
    method: "POST",
    body: JSON.stringify({ booking_id: bookingId, action, ...extra }),
  });
}

export async function uploadKnowledge(formData) {
  const token = typeof window !== "undefined" ? localStorage.getItem("luxestay_token") : null;
  const response = await fetch(`${API_BASE_URL}/knowledge/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || "Failed to upload document");
  }
  return data;
}

export async function getKnowledgeDocs() {
  return apiFetch("/knowledge");
}

export async function payBooking(bookingId) {
  return apiFetch(`/bookings/${bookingId}/pay`, {
    method: "POST",
  });
}
