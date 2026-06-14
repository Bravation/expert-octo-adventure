export type ServiceCategory = {
  group: string;
  subgroups: string[];
};

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    group: "Animal & Agricultural Services",
    subgroups: ["Agricultural Consulting", "Beekeeping Services", "Dog Training", "Farm Management", "Pet Boarding", "Pet Grooming", "Veterinary Services"],
  },
  {
    group: "Automotive Services",
    subgroups: ["Auto Body Repair", "Brake Repair", "Car Detailing", "Car Electrical Diagnostics", "Car Rentals", "Car Repair", "Car Wash", "Car Wrapping", "Ceramic Coating", "Emissions Testing", "Engine Repair", "Fleet Management", "Mobile Mechanic", "Motorcycle Repair", "Oil Change", "Paint Protection Film", "Roadside Assistance", "Tire Rotation", "Tire Services", "Towing", "Transmission Repair", "Vehicle Inspection", "Window Tinting"],
  },
  {
    group: "Beauty & Grooming",
    subgroups: ["Barber Services", "Body Piercing", "Eyelash Extensions", "Hair Coloring", "Hair Extensions", "Hair Styling", "Haircuts", "Makeup Artistry", "Manicure", "Microblading", "Nail Art", "Nail Care", "Pedicure", "Skin Facials", "Skin Waxing", "Skincare Treatments", "Spray Tanning", "Tattooing", "Teeth Whitening"],
  },
  {
    group: "Childcare & Family Services",
    subgroups: ["Babysitting", "Daycare", "Elderly Care", "Kids Tutoring", "Nanny Services", "Senior Companion Services"],
  },
  {
    group: "Content Creation",
    subgroups: ["Animation", "Blogging", "Copywriting", "Drone Videography", "Motion Graphics", "Music Production", "Photography", "Podcast Editing", "Podcast Production", "Script Writing", "Video Editing", "Videography", "Voice-over"],
  },
  {
    group: "Corporate & Administrative",
    subgroups: ["Appointment Setting", "Business Consulting", "Business Plan Writing", "Call Centers", "Data Entry", "Grant Writing", "HR Consulting", "IT Consulting", "Market Research", "Project Management", "Strategy Consulting", "Transcription", "Virtual Assistance"],
  },
  {
    group: "Creative & Performing Arts",
    subgroups: ["Art Restoration", "Calligraphy", "Custom Framing", "Dance Instruction", "Mural Painting", "Theater Production"],
  },
  {
    group: "Education & Training Services",
    subgroups: ["Art Classes", "Career Coaching", "Certifications", "Coding Bootcamps", "Corporate Training", "Language Instruction", "Life Coaching", "Music Lessons", "Online Course Creation", "Schools", "Test Prep", "Tutoring"],
  },
  {
    group: "Events",
    subgroups: ["Audio/Visual Setup", "DJ Services", "Event Planning", "Event Security", "Florist Services", "Invitation Design", "Live Streaming", "Party Equipment", "Performers", "Photo Booth Rental", "Photography", "Venue Decoration", "Venues", "Wedding Coordination", "Wedding Planning"],
  },
  {
    group: "Fashion & Textile Services",
    subgroups: ["Alterations", "Custom Clothing", "Dry Cleaning", "Leather Restoration", "Shoe Repair", "Tailoring"],
  },
  {
    group: "Financial & Legal",
    subgroups: ["Accounting", "Auditing", "Bookkeeping", "CFO Services", "Contract Drafting", "Financial Advising", "Immigration Services", "Intellectual Property", "Legal Consulting", "Litigation", "Notary Services", "Payroll Services", "Tax Preparation"],
  },
  {
    group: "Food Services",
    subgroups: ["Baking Services", "Bartending Services", "Cake Decorating", "Catering", "Cooking Classes", "Dietary Planning", "Food Photography", "Food Safety Consulting", "Food Truck Services", "Meal Prep", "Nutrition Label Consulting", "Private Chef", "Wine Consulting"],
  },
  {
    group: "Funeral & Memorial Services",
    subgroups: ["Cremation Services", "Estate Cleanout", "Funeral Planning", "Grief Counseling", "Memorial Design", "Obituary Writing"],
  },
  {
    group: "Health & Wellness",
    subgroups: ["Acupuncture", "Addiction Counseling", "Biohacking Coaching", "Chiropractic", "Counseling", "General Practice", "Group Classes", "Holistic Healing", "Massage Therapy", "Meditation Coaching", "Mental Health Counseling", "Nutrition Coaching", "Occupational Therapy", "Online Coaching", "Personal Training", "Physical Therapy", "Pilates Instruction", "Psychiatry", "Psychology", "Sleep Consulting", "Specialist Care", "Speech Therapy", "Sports Rehabilitation", "Telemedicine", "Yoga Instructions"],
  },
  {
    group: "Health, Science & Technical Services",
    subgroups: ["Architecture", "Engineering Services", "Environmental Consulting", "Laboratory Testing", "Medical Billing", "Pharmaceutical Consulting"],
  },
  {
    group: "Home Improvement",
    subgroups: ["Air Conditioning Installation", "Appliance Repair", "Cabinet Refinishing", "Carpentry", "Drywall Repair", "Electrical Work", "Fence Installation", "Flooring Installation", "Garage Door Repair", "General Construction", "Home Remodeling", "Insulation", "Masonry", "Painting", "Plumbing", "Roofing", "Window Installation"],
  },
  {
    group: "Home Maintenance",
    subgroups: ["Cleaning Services", "Commercial Cleaning", "Deep Cleaning", "Handyman Services", "House Cleaning", "HVAC Maintenance", "Irrigation Services", "Landscaping", "Lawn Care", "Move-in/out Cleaning", "Pest Control", "Pool Cleaning", "Pressure Washing", "Tree Trimming"],
  },
  {
    group: "Hospitality",
    subgroups: ["AirBNB Management", "Event Catering Coordination", "Guest Concierge", "Hotel Staffing", "Property Cleaning", "Resort Management", "Vacation Rental Cleaning"],
  },
  {
    group: "Insurance & Risk Services",
    subgroups: ["Claims Consulting", "Health Insurance Advisory", "Insurance Brokerage", "Risk Management"],
  },
  {
    group: "Lifestyle & Convenience",
    subgroups: ["Concierge Services", "Dog Walking", "Errand Running", "Gift Wrapping", "Home Organization", "House Sitting", "Personal Shopping", "Personal Styling", "Pet Sitting", "Relocation Assistance", "Travel Planning"],
  },
  {
    group: "Logistics, Delivery & Transportation",
    subgroups: ["Commercial Moving", "Courier Services", "Drone Delivery", "Freight Transport", "Last-Mile Delivery", "Moving Services", "Residential Moving", "Rideshare Driving", "Self-Storage", "Storage Solutions", "Warehousing"],
  },
  {
    group: "Maintenance & Support Services",
    subgroups: ["Guard Services", "Industrial Cleaning", "Janitorial", "Recruitment", "Surveillance", "Temp Agencies"],
  },
  {
    group: "Marine & Watercraft Services",
    subgroups: ["Boat Detailing", "Boat Storage", "Dock Building", "Marine Engine Repair", "Sailing Instruction", "Yacht Management"],
  },
  {
    group: "Marketing & Advertising",
    subgroups: ["Affiliate Marketing", "Branding Strategy", "Community Management", "Content Strategy", "Copywriting", "Email Marketing", "Influencer Marketing", "Paid Ads Management", "Podcast Marketing", "Public Relations", "SEO Optimization", "Social Media Management", "Video Marketing"],
  },
  {
    group: "Real Estate Services",
    subgroups: ["Home Inspection", "Home Staging", "Mortgage Consulting", "Property Appraisal", "Property Management", "Real Estate Agents"],
  },
  {
    group: "Security Services",
    subgroups: ["Access Control Systems", "Alarm Installation", "Bodyguard Services", "CCTV Installation", "Cybersecurity Training", "Private Security"],
  },
  {
    group: "Specialized Niches",
    subgroups: ["3D Printing Services", "Drone Inspection", "EV Charging Installation", "Home Energy Audits", "Home Theater Setup", "Prompt Engineering", "Smart Home Installation", "Smart Home Optimization", "Solar Panel Installation", "Water Filtration Systems"],
  },
  {
    group: "Sustainability & Eco Services",
    subgroups: ["Carbon Footprint Audits", "Composting Pickup", "Eco-Friendly Product Consulting", "Green Building Certification", "Recycling Services"],
  },
  {
    group: "Technology & IT",
    subgroups: ["AI Automation Consulting", "AI Automation Services", "API Development", "App Development", "Blockchain Development", "Chatbot Development", "Cloud Migration", "Cloud Services", "Compliance Audits", "Cybersecurity", "Cybersecurity Audits", "Data Analytics", "Data Visualization", "Database Management", "DevOps", "Game Development", "Helpdesk Services", "Infrastructure Management", "IoT Solutions", "IT Support", "Machine Learning Models", "Mobile Apps", "Network Setup", "Penetration Testing", "QA Testing", "Risk Assessment", "SaaS Platforms", "Security Monitoring", "Software Development", "System Administration", "Technical Writing", "Virtual Reality Experience", "Web Development"],
  },
  {
    group: "Travel & Tourism",
    subgroups: ["Adventure Tours", "Car Rentals", "Itinerary Planning", "Shuttle Services", "Tour Guides", "Travel Agencies"],
  },
  {
    group: "Visual Design",
    subgroups: ["Graphic Design", "Infographics", "Logo Design", "NFT Art Creation", "Packaging Design", "UI/UX Design"],
  },
  {
    group: "Writing & Publishing",
    subgroups: ["Editing & Proofreading", "Ghostwriting", "Resume Writing", "Scriptwriting", "Translation"],
  },
];

// Flat list of all subgroups for validation/select options
export const ALL_SUBGROUPS = SERVICE_CATEGORIES.flatMap((c) => c.subgroups);

// Map subgroup -> group
export const SUBGROUP_TO_GROUP: Record<string, string> = {};
SERVICE_CATEGORIES.forEach((c) => {
  c.subgroups.forEach((s) => {
    SUBGROUP_TO_GROUP[s] = c.group;
  });
});
