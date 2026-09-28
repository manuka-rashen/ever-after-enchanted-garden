export const invitation = {
  groomName: "Kavindu Jayawardena",
  brideName: "Methmi Wickramasinghe",
  tagline: "A Tale of Love, Heritage & Forever",
  eventDate: "2027-11-28T09:41:00+05:30",
  poruwa: "09:41 AM",
  reception: "06:30 PM",
  venue: "The Grand Ballroom, Shangri-La Colombo",
  address: "No. 01, Galle Face Avenue, Colombo 02, Sri Lanka",
  mapsUrl: "https://maps.google.com/?q=Shangri-La+Hotel+Colombo",
  email: "rsvp.methmi.kavindu@example.lk",
  whatsapp: "+94771234567",
  dressCode: "Traditional (Kandyan / Saree) or Formal Evening Attire",
  story: "Under the warm golden light of paradise, two journeys intertwine into a single story of tradition, love, and eternity…",
};

export const chapters = [
  { id: "overture", label: "The overture" },
  { id: "story", label: "Our story" },
  { id: "union", label: "Forever begins" },
  { id: "celebration", label: "The celebration" },
];

export const storyPages = [
  { eyebrow: "ONCE UPON A TIME", title: "Two journeys.\nOne beautiful story.", copy: invitation.story },
  { eyebrow: "ROOTED IN HERITAGE", title: "A promise,\nblessed by tradition.", copy: "With our families beside us, we begin our next chapter with the timeless blessings of the Poruwa ceremony." },
  { eyebrow: "OUR NEXT CHAPTER", title: "And so,\nforever begins.", copy: "The most beautiful part of our story is still to come. We would be honoured to share its beginning with you." },
];

export type MotionState = { progress: number; book: number; ring: number; page: number; paused: boolean; reduced: boolean; tiltX: number; tiltY: number };
