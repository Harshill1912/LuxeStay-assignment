import { UtensilsCrossed, Waves, Sparkles, Dumbbell, Car, HeartHandshake } from "lucide-react";

export default function AmenitiesPage() {
  const amenitiesList = [
    {
      title: "Azure Lounge & Multi-Cuisine Dining",
      icon: UtensilsCrossed,
      image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80",
      description: "Authentic Indian thalis, regional specialities, and continental fare. Complimentary buffet breakfast with veg & Jain options, 7:00 AM to 10:30 AM daily."
    },
    {
      title: "Infinity Pool & Cabanas",
      icon: Waves,
      image: "https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?auto=format&fit=crop&w=800&q=80",
      description: "Relax by our heated infinity pool with signature mocktails and complimentary private daybeds."
    },
    {
      title: "Ayurvedic Serenity Spa",
      icon: Sparkles,
      image: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80",
      description: "Rejuvenate with traditional Ayurvedic therapies, abhyanga massage, herbal steam, and organic aromatherapy rituals."
    },
    {
      title: "24/7 Fitness Centre & Yoga",
      icon: Dumbbell,
      image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80",
      description: "State-of-the-art equipment, sunrise garden yoga at 6:30 AM, and personal training on request."
    },
    {
      title: "Airport Transfer & Chauffeur",
      icon: Car,
      image: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=800&q=80",
      description: "Complimentary airport pick-up for suite & villa guests. Chauffeur-driven cabs and local sightseeing arranged by the concierge."
    },
    {
      title: "24/7 AI & Human Concierge",
      icon: HeartHandshake,
      image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80",
      description: "Round-the-clock room service, instant chat assistance, and customised itinerary planning across India."
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      <div className="space-y-4 border-b border-slate-200 pb-8 text-center max-w-3xl mx-auto">
        <span className="text-xs uppercase tracking-widest text-[#0071c2] font-bold">World-class experiences</span>
        <h1 className="text-4xl sm:text-5xl font-bold text-slate-900">Hotel amenities & services</h1>
        <p className="text-slate-500 text-sm sm:text-base">
          Every detail at LuxeStay is crafted to elevate your stay — seamless luxury from arrival to departure.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {amenitiesList.map((item, index) => {
          const IconComp = item.icon;
          return (
            <div
              key={index}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-md transition-all duration-300 group"
            >
              <div className="relative h-56 overflow-hidden">
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-4 left-4 w-10 h-10 rounded-xl bg-white/95 backdrop-blur shadow-sm flex items-center justify-center text-[#0071c2]">
                  <IconComp className="w-5 h-5" />
                </div>
              </div>
              <div className="p-6 space-y-3">
                <h3 className="text-lg font-bold text-slate-800">{item.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{item.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
