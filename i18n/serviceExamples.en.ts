const serviceExamplesEn: Record<string, { title: string; description: string }> = {
  // Corporate & Administrative
  "Business Consulting": {
    title: "Business Strategy Consulting",
    description: "Expert business strategy and growth consulting for small and medium enterprises. We analyze your operations and develop actionable plans.",
  },
  "Project Management": {
    title: "Professional Project Management",
    description: "End-to-end project management services using Agile and Waterfall methodologies. Keeping your projects on time and on budget.",
  },
  "Virtual Assistance": {
    title: "Virtual Assistant Services",
    description: "Reliable virtual assistance for administrative tasks, scheduling, email management, and customer support.",
  },
  "Data Entry": {
    title: "Accurate Data Entry Services",
    description: "Fast and accurate data entry, digitization, and database management for businesses of all sizes.",
  },
  "Market Research": {
    title: "Market Research & Analysis",
    description: "Comprehensive market research including competitor analysis, consumer trends, and industry reports to guide your decisions.",
  },
  "Business Plan Writing": {
    title: "Professional Business Plans",
    description: "Compelling business plans with financial projections, market analysis, and strategic roadmaps for investors and lenders.",
  },
  "Grant Writing": {
    title: "Grant Writing Services",
    description: "Expert grant proposal writing for nonprofits, startups, and research institutions. High success rate with federal and private grants.",
  },

  // Financial & Legal
  "Accounting": {
    title: "Full-Service Accounting",
    description: "Comprehensive accounting services including financial statements, reporting, and compliance for businesses and individuals.",
  },
  "Bookkeeping": {
    title: "Professional Bookkeeping",
    description: "Accurate bookkeeping services to keep your financial records organized. Monthly reconciliation and reporting included.",
  },
  "Tax Preparation": {
    title: "Tax Preparation & Filing",
    description: "Individual and business tax preparation with maximum deductions. E-filing and year-round tax planning available.",
  },
  "Payroll Services": {
    title: "Payroll Processing",
    description: "Complete payroll management including tax withholdings, direct deposits, and compliance with state and federal regulations.",
  },
  "Financial Advising": {
    title: "Financial Advisory Services",
    description: "Personalized financial planning, investment guidance, and retirement strategies tailored to your goals.",
  },
  "Legal Consulting": {
    title: "Legal Consulting Services",
    description: "Business law consulting covering contracts, compliance, intellectual property, and dispute resolution.",
  },
  "Contract Drafting": {
    title: "Contract Drafting & Review",
    description: "Professional contract drafting, review, and negotiation services for business agreements and partnerships.",
  },
  "Notary Services": {
    title: "Mobile Notary Public",
    description: "Licensed mobile notary services. We come to you for document notarization, loan signings, and apostille services.",
  },

  // Marketing & Advertising
  "Social Media Management": {
    title: "Social Media Management",
    description: "Full-service social media management across all platforms. Content creation, scheduling, engagement, and analytics reporting.",
  },
  "SEO Optimization": {
    title: "SEO Optimization Services",
    description: "Boost your search rankings with on-page and off-page SEO strategies, keyword research, and technical audits.",
  },
  "Paid Ads Management": {
    title: "Paid Advertising Campaigns",
    description: "Google Ads and social media advertising management with ROI-focused strategies and detailed performance reporting.",
  },
  "Branding Strategy": {
    title: "Brand Strategy & Identity",
    description: "Complete branding packages including brand positioning, messaging frameworks, visual identity, and brand guidelines.",
  },
  "Copywriting": {
    title: "Professional Copywriting",
    description: "Persuasive copy for websites, ads, emails, and marketing materials that converts readers into customers.",
  },
  "Email Marketing": {
    title: "Email Marketing Campaigns",
    description: "Email marketing strategy, template design, automation setup, and campaign management with A/B testing.",
  },
  "Influencer Marketing": {
    title: "Influencer Marketing Services",
    description: "Connect with the right influencers for your brand. Campaign strategy, influencer vetting, and performance tracking.",
  },
  "Public Relations": {
    title: "Public Relations & Media",
    description: "PR strategy, press release writing, media outreach, and crisis communications for brands and public figures.",
  },

  // Technology & IT
  "Software Development": {
    title: "Custom Software Development",
    description: "Tailored software solutions built with modern technologies. From MVPs to enterprise applications.",
  },
  "Web Development": {
    title: "Website Development",
    description: "Professional website design and development. Responsive, SEO-optimized sites using the latest technologies.",
  },
  "App Development": {
    title: "Mobile App Development",
    description: "Native and cross-platform mobile apps for iOS and Android. From concept to App Store launch.",
  },
  "Cybersecurity": {
    title: "Cybersecurity Solutions",
    description: "Protect your business with comprehensive cybersecurity services including monitoring, threat detection, and incident response.",
  },
  "Cybersecurity Audits": {
    title: "Security Audit & Assessment",
    description: "Thorough cybersecurity audits including vulnerability scanning, penetration testing, and compliance assessments.",
  },
  "Cloud Services": {
    title: "Cloud Infrastructure Services",
    description: "Cloud migration, management, and optimization across AWS, Azure, and Google Cloud platforms.",
  },
  "IT Support": {
    title: "IT Support & Help Desk",
    description: "Reliable IT support for businesses. Hardware troubleshooting, software installation, network setup, and ongoing maintenance.",
  },
  "Database Management": {
    title: "Database Administration",
    description: "Database design, optimization, migration, and management services for SQL and NoSQL systems.",
  },
  "Virtual Reality Experience": {
    title: "VR Experience Development",
    description: "Custom virtual reality experiences for training, marketing, real estate tours, and entertainment.",
  },
  "AI Automation Services": {
    title: "AI Automation Solutions",
    description: "Automate business processes with AI-powered solutions. Chatbots, workflow automation, and predictive analytics.",
  },
  "AI Automation Consulting": {
    title: "AI Strategy Consulting",
    description: "Strategic AI consulting to identify automation opportunities, select tools, and implement AI across your organization.",
  },

  // Visual Design
  "Graphic Design": {
    title: "Graphic Design Services",
    description: "Creative graphic design for print and digital media. Brochures, flyers, social media graphics, and more.",
  },
  "Logo Design": {
    title: "Logo & Brand Identity Design",
    description: "Memorable logo design with complete brand identity packages including color palettes and typography.",
  },
  "UI/UX Design": {
    title: "UI/UX Design Services",
    description: "User-centered interface design with wireframing, prototyping, and usability testing for web and mobile apps.",
  },
  "Packaging Design": {
    title: "Product Packaging Design",
    description: "Eye-catching packaging design that stands out on shelves. Retail-ready designs with print specifications.",
  },
  "Infographics": {
    title: "Infographic Design",
    description: "Data visualization and infographic design that turns complex information into engaging visual stories.",
  },
  "NFT Art Creation": {
    title: "NFT Art & Digital Collectibles",
    description: "Original NFT artwork creation, generative art collections, and smart contract deployment for digital marketplaces.",
  },

  // Content Creation
  "Photography": {
    title: "Professional Photography",
    description: "High-quality photography for events, portraits, products, and real estate. Editing and retouching included.",
  },
  "Videography": {
    title: "Professional Videography",
    description: "Cinematic video production for commercials, events, corporate videos, and social media content.",
  },
  "Drone Videography": {
    title: "Aerial Drone Filming",
    description: "FAA-licensed drone photography and videography for real estate, events, construction, and marketing.",
  },
  "Video Editing": {
    title: "Video Editing & Post-Production",
    description: "Professional video editing including color grading, sound design, motion graphics, and final delivery in all formats.",
  },
  "Animation": {
    title: "2D & 3D Animation",
    description: "Custom animation services for explainer videos, commercials, educational content, and entertainment.",
  },
  "Motion Graphics": {
    title: "Motion Graphics Design",
    description: "Dynamic motion graphics for video intros, social media, presentations, and advertising campaigns.",
  },
  "Podcast Production": {
    title: "Podcast Production Services",
    description: "Full podcast production including recording, editing, mixing, show notes, and distribution setup.",
  },

  // Writing & Publishing
  "Ghostwriting": {
    title: "Ghostwriting Services",
    description: "Professional ghostwriting for books, articles, blogs, and speeches. Confidential and tailored to your voice.",
  },
  "Editing & Proofreading": {
    title: "Editing & Proofreading",
    description: "Meticulous editing and proofreading for manuscripts, academic papers, business documents, and web content.",
  },
  "Resume Writing": {
    title: "Resume & CV Writing",
    description: "Professional resume writing that highlights your strengths. ATS-optimized formats with cover letter included.",
  },
  "Scriptwriting": {
    title: "Scriptwriting Services",
    description: "Scriptwriting for film, TV, commercials, YouTube, and corporate videos. From concept to final draft.",
  },
  "Translation": {
    title: "Translation Services",
    description: "Certified translation services for documents, websites, and marketing materials in 20+ languages.",
  },

  // Home Improvement
  "Carpentry": {
    title: "Custom Carpentry",
    description: "Skilled carpentry services including custom furniture, cabinetry, trim work, and structural framing.",
  },
  "Plumbing": {
    title: "Licensed Plumbing Services",
    description: "Licensed plumber for repairs, installations, and maintenance. Available for emergencies 24/7.",
  },
  "General Construction": {
    title: "General Construction",
    description: "Residential and commercial construction services. Renovations, additions, and new builds with licensed contractors.",
  },
  "Electrical Work": {
    title: "Electrical Services",
    description: "Licensed electrician for wiring, panel upgrades, lighting installation, and electrical troubleshooting.",
  },
  "Painting": {
    title: "Interior & Exterior Painting",
    description: "Professional painting services for homes and businesses. Surface prep, premium paints, and clean finishes.",
  },
  "Flooring Installation": {
    title: "Flooring Installation",
    description: "Expert installation of hardwood, tile, laminate, vinyl, and carpet flooring. Free in-home estimates.",
  },
  "Air Conditioning Installation": {
    title: "AC Installation & Repair",
    description: "Central and ductless AC installation, repair, and replacement. Licensed, insured, and EPA certified.",
  },
  "Roofing": {
    title: "Roofing Services",
    description: "Roof repair, replacement, and inspection. Shingle, tile, metal, and flat roofing specialists.",
  },
  "Masonry": {
    title: "Masonry & Stonework",
    description: "Expert masonry services including brick, stone, stucco, and concrete work for residential and commercial projects.",
  },

  // Home Maintenance
  "Cleaning Services": {
    title: "Home & Office Cleaning",
    description: "Professional cleaning services for homes and offices. Deep cleaning, recurring service, and move-in/move-out cleaning.",
  },
  "Pressure Washing": {
    title: "Pressure Washing",
    description: "Restore driveways, sidewalks, decks, and building exteriors with professional pressure washing services.",
  },
  "Pest Control": {
    title: "Pest Control Services",
    description: "Effective pest control for termites, rodents, ants, roaches, and mosquitoes. Eco-friendly options available.",
  },
  "HVAC Maintenance": {
    title: "HVAC Maintenance & Repair",
    description: "Regular HVAC maintenance, emergency repairs, and system tune-ups to keep your home comfortable year-round.",
  },
  "Pool Cleaning": {
    title: "Pool Cleaning & Maintenance",
    description: "Weekly pool maintenance, chemical balancing, equipment repair, and seasonal opening/closing services.",
  },
  "Landscaping": {
    title: "Landscaping Services",
    description: "Full landscaping design and maintenance. Lawn care, garden design, irrigation, and hardscape installation.",
  },
  "Handyman Services": {
    title: "Handyman Services",
    description: "Reliable handyman for home repairs, furniture assembly, drywall patching, and general maintenance tasks.",
  },

  // Specialized Niches
  "Smart Home Installation": {
    title: "Smart Home Setup",
    description: "Professional installation of smart home devices including lighting, thermostats, cameras, and voice assistants.",
  },
  "Smart Home Optimization": {
    title: "Smart Home Optimization",
    description: "Optimize your existing smart home ecosystem for seamless automation, energy savings, and enhanced security.",
  },
  "Solar Panel Installation": {
    title: "Solar Panel Installation",
    description: "Residential and commercial solar panel installation. Free energy assessment and financing options available.",
  },
  "Water Filtration Systems": {
    title: "Water Filtration Installation",
    description: "Whole-house and point-of-use water filtration system installation. Water quality testing included.",
  },
  "Prompt Engineering": {
    title: "AI Prompt Engineering",
    description: "Expert prompt engineering for ChatGPT, Midjourney, and other AI tools. Custom prompts and workflow optimization.",
  },
  "Home Energy Audits": {
    title: "Home Energy Audit",
    description: "Comprehensive home energy assessment with thermal imaging, blower door testing, and efficiency recommendations.",
  },

  // Health & Wellness
  "Personal Training": {
    title: "Personal Fitness Training",
    description: "Certified personal trainer offering customized workout programs, nutrition guidance, and accountability coaching.",
  },
  "Massage Therapy": {
    title: "Licensed Massage Therapy",
    description: "Therapeutic massage including deep tissue, Swedish, sports, and prenatal. In-home and studio sessions available.",
  },
  "Nutrition Coaching": {
    title: "Nutrition Coaching",
    description: "Personalized nutrition plans, meal prep guidance, and ongoing support for weight management and wellness goals.",
  },
  "Mental Health Counseling": {
    title: "Mental Health Counseling",
    description: "Licensed counseling for anxiety, depression, stress, and relationships. Telehealth and in-person sessions available.",
  },
  "Yoga Instructions": {
    title: "Yoga Instruction",
    description: "Private and group yoga classes for all levels. Vinyasa, Hatha, Yin, and restorative styles. In-home or outdoor.",
  },
  "Physical Therapy": {
    title: "Physical Therapy",
    description: "Licensed physical therapy for injury recovery, chronic pain, post-surgery rehabilitation, and mobility improvement.",
  },
  "Biohacking Coaching": {
    title: "Biohacking & Performance Coaching",
    description: "Optimize your biology with evidence-based biohacking strategies. Sleep, nutrition, supplements, and wearable tech guidance.",
  },

  // Beauty & Grooming
  "Hair Styling": {
    title: "Hair Styling & Coloring",
    description: "Professional hair styling, cutting, coloring, and treatments. Salon and mobile services for all hair types.",
  },
  "Barber Services": {
    title: "Professional Barber Services",
    description: "Classic and modern haircuts, beard trims, hot towel shaves, and grooming services for men.",
  },
  "Nail Care": {
    title: "Nail Care & Manicure",
    description: "Manicures, pedicures, gel nails, acrylics, and nail art. Salon and mobile services available.",
  },
  "Makeup Artistry": {
    title: "Professional Makeup Artistry",
    description: "Makeup services for weddings, events, photoshoots, and special occasions. Airbrush and traditional techniques.",
  },
  "Skincare Treatments": {
    title: "Skincare & Facial Treatments",
    description: "Professional facials, chemical peels, microdermabrasion, and customized skincare routines for all skin types.",
  },
  "Tattooing": {
    title: "Custom Tattoo Artistry",
    description: "Original custom tattoo designs in all styles. Clean, licensed studio with experienced artists.",
  },

  // Lifestyle & Convenience
  "Personal Shopping": {
    title: "Personal Shopping Services",
    description: "Curated personal shopping for fashion, gifts, and home decor. Wardrobe consultations and style makeovers.",
  },
  "Errand Running": {
    title: "Errand & Task Services",
    description: "We handle your to-do list. Grocery shopping, package delivery, dry cleaning pickup, and more.",
  },
  "Travel Planning": {
    title: "Travel Planning & Booking",
    description: "Custom travel itineraries, hotel reservations, flight bookings, and local experience recommendations.",
  },
  "Concierge Services": {
    title: "Personal Concierge",
    description: "Premium concierge services for busy professionals. Restaurant reservations, event tickets, and lifestyle management.",
  },
  "Pet Sitting": {
    title: "Pet Sitting Services",
    description: "Loving in-home pet sitting with daily updates. Feeding, walks, medication administration, and overnight stays.",
  },
  "Dog Walking": {
    title: "Professional Dog Walking",
    description: "Daily dog walking services with GPS tracking and photo updates. Individual and group walks available.",
  },
  "House Sitting": {
    title: "House Sitting Services",
    description: "Reliable house sitting with mail collection, plant watering, security checks, and property maintenance.",
  },

  // Automotive Services
  "Car Repair": {
    title: "Auto Repair Services",
    description: "Full-service auto repair including engine diagnostics, brake service, transmission, and suspension work.",
  },
  "Oil Change": {
    title: "Oil Change Service",
    description: "Quick and affordable oil changes with quality filters. Synthetic, blend, and conventional options.",
  },
  "Tire Services": {
    title: "Tire Sales & Service",
    description: "Tire installation, rotation, balancing, and alignment. New and used tires for all vehicle types.",
  },
  "Car Detailing": {
    title: "Auto Detailing",
    description: "Premium car detailing including wash, wax, interior cleaning, paint correction, and ceramic coating.",
  },
  "Car Wash": {
    title: "Mobile Car Wash",
    description: "Convenient mobile car wash that comes to your location. Exterior wash, interior vacuum, and full detail packages.",
  },
  "Auto Body Repair": {
    title: "Auto Body & Collision Repair",
    description: "Expert collision repair, dent removal, paint matching, and frame straightening. Insurance claims welcome.",
  },
  "Mobile Mechanic": {
    title: "Mobile Mechanic Services",
    description: "Certified mechanic who comes to you. Diagnostics, repairs, and maintenance at your home or office.",
  },
  "Car Wrapping": {
    title: "Vehicle Wrapping",
    description: "Custom vinyl vehicle wraps for personal style or business advertising. Full and partial wraps available.",
  },
  "Window Tinting": {
    title: "Window Tinting",
    description: "Professional window tinting for cars, trucks, and SUVs. UV protection, heat reduction, and privacy.",
  },

  // Education & Training Services
  "Tutoring": {
    title: "Academic Tutoring",
    description: "One-on-one tutoring for K-12 and college students in math, science, English, and test prep.",
  },
  "Test Prep": {
    title: "Test Preparation Courses",
    description: "Expert SAT, ACT, GRE, GMAT, and LSAT preparation with practice tests and personalized study plans.",
  },
  "Language Instruction": {
    title: "Language Lessons",
    description: "Private language instruction in Spanish, French, Mandarin, and more. Conversational and business levels.",
  },
  "Music Lessons": {
    title: "Music Lessons",
    description: "Private music lessons for piano, guitar, drums, voice, and more. All ages and skill levels welcome.",
  },
  "Art Classes": {
    title: "Art Classes & Workshops",
    description: "Drawing, painting, sculpture, and mixed media classes for beginners to advanced artists.",
  },
  "Coding Bootcamps": {
    title: "Coding Bootcamp",
    description: "Intensive coding bootcamps in web development, Python, data science, and mobile app development.",
  },
  "Corporate Training": {
    title: "Corporate Training Programs",
    description: "Custom corporate training for leadership, communication, team building, and technical skills.",
  },
  "Online Course Creation": {
    title: "Online Course Creation",
    description: "End-to-end online course development including curriculum design, video production, and LMS setup.",
  },

  // Food Services
  "Catering": {
    title: "Catering Services",
    description: "Full-service catering for weddings, corporate events, and private parties. Custom menus and dietary accommodations.",
  },
  "Meal Prep": {
    title: "Meal Prep Services",
    description: "Weekly meal preparation with customized menus. Healthy, portioned meals delivered to your door.",
  },
  "Private Chef": {
    title: "Private Chef Services",
    description: "Hire a private chef for dinner parties, weekly meal service, or special occasions. Custom menus and wine pairings.",
  },
  "Baking Services": {
    title: "Custom Baking & Pastries",
    description: "Custom cakes, pastries, cookies, and desserts for events and everyday enjoyment. Specialty diets accommodated.",
  },

  // Events
  "Event Planning": {
    title: "Event Planning & Coordination",
    description: "Full-service event planning for weddings, corporate events, galas, and private celebrations.",
  },
  "DJ Services": {
    title: "Professional DJ Services",
    description: "Experienced DJ for weddings, parties, and corporate events. Professional sound and lighting equipment included.",
  },
  "Venue Decoration": {
    title: "Venue Decoration & Design",
    description: "Transform any space with stunning event decor. Florals, lighting, draping, and custom installations.",
  },
  "Audio/Visual Setup": {
    title: "AV Equipment & Setup",
    description: "Professional audio/visual setup for conferences, weddings, and events. Sound systems, projectors, and screens.",
  },
  "Wedding Coordination": {
    title: "Wedding Coordination",
    description: "Day-of wedding coordination to ensure your special day runs smoothly. Timeline management and vendor coordination.",
  },

  // Hospitality
  "AirBNB Management": {
    title: "Airbnb Property Management",
    description: "Full-service Airbnb management including listings, pricing, guest communication, and property maintenance.",
  },
  "Property Cleaning": {
    title: "Vacation Rental Cleaning",
    description: "Professional turnover cleaning for vacation rentals. Linen service, restocking, and quality inspections.",
  },
  "Guest Concierge": {
    title: "Guest Concierge Services",
    description: "Enhance your guests' stay with local recommendations, activity bookings, grocery stocking, and welcome packages.",
  },

  // Health, Science & Technical Services
  "Laboratory Testing": {
    title: "Laboratory Testing Services",
    description: "Certified laboratory testing for water quality, soil analysis, air quality, and material testing.",
  },
  "Environmental Consulting": {
    title: "Environmental Consulting",
    description: "Environmental impact assessments, compliance consulting, remediation planning, and sustainability reporting.",
  },
  "Engineering Services": {
    title: "Engineering Consulting",
    description: "Professional engineering services including structural analysis, civil engineering, and mechanical design.",
  },
  "Architecture": {
    title: "Architectural Design",
    description: "Residential and commercial architectural design. Concept to construction drawings with 3D visualization.",
  },
  "Medical Billing": {
    title: "Medical Billing Services",
    description: "Accurate medical billing and coding services. Claims processing, denial management, and revenue cycle optimization.",
  },
  "Pharmaceutical Consulting": {
    title: "Pharmaceutical Consulting",
    description: "Regulatory consulting, drug development strategy, and compliance services for pharmaceutical companies.",
  },

  // Logistics, Delivery & Transportation
  "Courier Services": {
    title: "Courier & Delivery",
    description: "Same-day and next-day courier services for documents, packages, and fragile items. GPS-tracked deliveries.",
  },
  "Freight Transport": {
    title: "Freight Transport Services",
    description: "Commercial freight transportation for local and long-distance shipments. Full truckload and LTL options.",
  },
  "Moving Services": {
    title: "Moving & Relocation",
    description: "Full-service residential and commercial moving. Packing, loading, transport, and unpacking services.",
  },
  "Storage Solutions": {
    title: "Storage Solutions",
    description: "Secure short-term and long-term storage for household items, business inventory, and vehicles.",
  },
  "Last-Mile Delivery": {
    title: "Last-Mile Delivery",
    description: "Efficient last-mile delivery solutions for e-commerce businesses. Same-day and scheduled delivery options.",
  },
  "Rideshare Driving": {
    title: "Private Rideshare Service",
    description: "Professional and reliable private transportation. Airport transfers, city rides, and scheduled pickups.",
  },
  "Drone Delivery": {
    title: "Drone Delivery Services",
    description: "Innovative drone delivery for small packages, medical supplies, and urgent documents in approved areas.",
  },

  // Animal & Agricultural Services
  "Veterinary Services": {
    title: "Mobile Veterinary Care",
    description: "Licensed mobile vet providing wellness exams, vaccinations, dental care, and minor procedures at your home.",
  },
  "Pet Grooming": {
    title: "Pet Grooming Services",
    description: "Professional grooming for dogs and cats. Bath, haircut, nail trimming, and ear cleaning. Mobile service available.",
  },
  "Pet Boarding": {
    title: "Pet Boarding Facility",
    description: "Safe and comfortable pet boarding with spacious accommodations, daily exercise, and 24/7 supervision.",
  },
  "Dog Training": {
    title: "Dog Training & Behavior",
    description: "Professional dog training for obedience, behavior modification, puppy training, and service dog certification.",
  },
  "Farm Management": {
    title: "Farm Management Services",
    description: "Comprehensive farm management including crop planning, livestock care, equipment maintenance, and operations.",
  },
  "Agricultural Consulting": {
    title: "Agricultural Consulting",
    description: "Expert consulting for soil health, irrigation systems, sustainable farming practices, and crop optimization.",
  },
  "Beekeeping Services": {
    title: "Beekeeping & Honey Production",
    description: "Beekeeping services including hive installation, maintenance, honey harvesting, and pollination services.",
  },

  // Sustainability & Eco Services
  "Recycling Services": {
    title: "Recycling & Waste Management",
    description: "Commercial and residential recycling services. E-waste disposal, paper shredding, and zero-waste consulting.",
  },
  "Composting Pickup": {
    title: "Composting Pickup Service",
    description: "Weekly compost collection for food scraps and yard waste. Finished compost returned to you seasonally.",
  },
  "Eco-Friendly Product Consulting": {
    title: "Eco-Product Consulting",
    description: "Guidance on transitioning to eco-friendly products and suppliers for your home or business.",
  },
  "Green Building Certification": {
    title: "Green Building Certification",
    description: "LEED and Green Globe certification consulting for new construction and existing building retrofits.",
  },
  "Carbon Footprint Audits": {
    title: "Carbon Footprint Assessment",
    description: "Measure and reduce your carbon footprint with detailed audits, offset recommendations, and sustainability roadmaps.",
  },
  "3D Printing Services": {
    title: "3D Printing Services",
    description: "Custom 3D printing for prototypes and products",
  },
  "API Development": {
    title: "API Development Services",
    description: "Custom REST and GraphQL API development",
  },
  "Access Control Systems": {
    title: "Access Control Installation",
    description: "Keycard, biometric, and smart lock systems",
  },
  "Acupuncture": {
    title: "Acupuncture Therapy",
    description: "Licensed acupuncture for pain relief.",
  },
  "Addiction Counseling": {
    title: "Addiction Counseling",
    description: "Confidential counseling for substance abuse.",
  },
  "Adventure Tours": {
    title: "Adventure Tours & Excursions",
    description: "Guided hiking, kayaking, and adventure trips",
  },
  "Affiliate Marketing": {
    title: "Affiliate Marketing Strategy",
    description: "Build and manage profitable affiliate programs",
  },
  "Alarm Installation": {
    title: "Alarm System Installation",
    description: "Home and business alarm system setup",
  },
  "Alterations": {
    title: "Clothing Alterations",
    description: "Expert hemming, tapering, and alterations.",
  },
  "Appliance Repair": {
    title: "Appliance Repair Services",
    description: "Expert repair for all major home appliances",
  },
  "Appointment Setting": {
    title: "Appointment Setting",
    description: "B2B appointment setting and lead qualification.",
  },
  "Art Restoration": {
    title: "Art Restoration",
    description: "Professional restoration of paintings and antiques.",
  },
  "Auditing": {
    title: "Financial Auditing",
    description: "Internal and external auditing services.",
  },
  "Babysitting": {
    title: "Babysitting Services",
    description: "Experienced, background-checked babysitters.",
  },
  "Bartending Services": {
    title: "Bartending & Mixology",
    description: "Professional bartenders with custom cocktails.",
  },
  "Blockchain Development": {
    title: "Blockchain Development",
    description: "Smart contracts and dApp development",
  },
  "Blogging": {
    title: "Blog Writing Services",
    description: "SEO-optimized blog posts and content calendars.",
  },
  "Boat Detailing": {
    title: "Boat Detailing & Cleaning",
    description: "Interior and exterior boat detailing",
  },
  "Boat Storage": {
    title: "Boat Storage Facilities",
    description: "Indoor and outdoor boat storage options",
  },
  "Body Piercing": {
    title: "Professional Body Piercing",
    description: "Safe, sterile body piercing with premium jewelry.",
  },
  "Bodyguard Services": {
    title: "Bodyguard & Personal Protection",
    description: "Professional close protection services",
  },
  "Brake Repair": {
    title: "Brake Inspection & Repair",
    description: "Complete brake system diagnosis, pad replacement, and fluid flush.",
  },
  "CCTV Installation": {
    title: "CCTV Installation & Monitoring",
    description: "Professional security camera installation",
  },
  "CFO Services": {
    title: "Fractional CFO Services",
    description: "Part-time CFO services for businesses.",
  },
  "Cabinet Refinishing": {
    title: "Cabinet Refinishing & Restoration",
    description: "Transform your kitchen with professional cabinet work",
  },
  "Cake Decorating": {
    title: "Custom Cake Decorating",
    description: "Designer cakes for all occasions.",
  },
  "Call Centers": {
    title: "Call Center Services",
    description: "Inbound and outbound call center solutions.",
  },
  "Calligraphy": {
    title: "Calligraphy & Hand Lettering",
    description: "Custom calligraphy for invitations and art.",
  },
  "Car Electrical Diagnostics": {
    title: "Auto Electrical Diagnostics",
    description: "Computer diagnostics, wiring repair, alternator and starter testing.",
  },
  "Car Rentals": {
    title: "Vehicle Rental Service",
    description: "Daily, weekly, and monthly car rentals with insurance options.",
  },
  "Career Coaching": {
    title: "Career Coaching",
    description: "Resume strategy, interview prep, and career planning.",
  },
  "Ceramic Coating": {
    title: "Ceramic Coating Application",
    description: "Professional-grade ceramic coating for paint protection and shine.",
  },
  "Certifications": {
    title: "Certification Prep Courses",
    description: "Prep for PMP, AWS, CompTIA certifications.",
  },
  "Chatbot Development": {
    title: "Chatbot Development",
    description: "AI-powered chatbot solutions for businesses",
  },
  "Chiropractic": {
    title: "Chiropractic Care",
    description: "Spinal adjustments and pain management.",
  },
  "Claims Consulting": {
    title: "Insurance Claims Consulting",
    description: "Expert guidance navigating insurance claims",
  },
  "Cloud Migration": {
    title: "Cloud Migration Services",
    description: "Seamless migration to cloud infrastructure",
  },
  "Commercial Cleaning": {
    title: "Commercial Cleaning Services",
    description: "Professional cleaning for offices and commercial spaces",
  },
  "Commercial Moving": {
    title: "Commercial Moving Services",
    description: "Office and business relocation experts",
  },
  "Community Management": {
    title: "Community Management",
    description: "Build and engage online communities",
  },
  "Compliance Audits": {
    title: "Compliance Audit Services",
    description: "Regulatory compliance assessments and audits",
  },
  "Content Strategy": {
    title: "Content Strategy Development",
    description: "Strategic content planning and execution",
  },
  "Cooking Classes": {
    title: "Cooking Classes",
    description: "Hands-on cooking classes for all levels.",
  },
  "Counseling": {
    title: "General Counseling",
    description: "Individual and couples counseling.",
  },
  "Cremation Services": {
    title: "Cremation Services",
    description: "Dignified cremation with memorial options.",
  },
  "Custom Clothing": {
    title: "Custom Clothing Design",
    description: "Bespoke clothing design and tailoring.",
  },
  "Custom Framing": {
    title: "Custom Picture Framing",
    description: "Museum-quality framing for art and photos.",
  },
  "Cybersecurity Training": {
    title: "Cybersecurity Awareness Training",
    description: "Employee cybersecurity training programs",
  },
  "Dance Instruction": {
    title: "Dance Classes",
    description: "Salsa, ballroom, hip-hop, and contemporary dance.",
  },
  "Data Analytics": {
    title: "Data Analytics Solutions",
    description: "Business intelligence and data analytics services",
  },
  "Data Visualization": {
    title: "Data Visualization Services",
    description: "Transform data into compelling visual stories",
  },
  "Daycare": {
    title: "Daycare Services",
    description: "Licensed daycare with educational activities.",
  },
  "Deep Cleaning": {
    title: "Deep Cleaning Specialists",
    description: "Thorough deep cleaning for homes and apartments",
  },
  "DevOps": {
    title: "DevOps Engineering",
    description: "CI/CD pipelines and infrastructure automation",
  },
  "Dietary Planning": {
    title: "Dietary & Meal Planning",
    description: "Personalized meal plans for dietary needs.",
  },
  "Dock Building": {
    title: "Dock Building & Repair",
    description: "Custom dock construction and maintenance",
  },
  "Drone Inspection": {
    title: "Drone Inspection Services",
    description: "Aerial inspections for roofs, towers, and infrastructure",
  },
  "Dry Cleaning": {
    title: "Dry Cleaning Services",
    description: "Professional dry cleaning for delicates.",
  },
  "Drywall Repair": {
    title: "Drywall Repair & Patching",
    description: "Seamless drywall repairs for walls and ceilings",
  },
  "EV Charging Installation": {
    title: "EV Charging Station Installation",
    description: "Home and commercial EV charger setup",
  },
  "Elderly Care": {
    title: "Elderly Care & Assistance",
    description: "In-home elderly care and companionship.",
  },
  "Emissions Testing": {
    title: "Emissions Testing",
    description: "State-certified emissions testing and compliance reporting.",
  },
  "Engine Repair": {
    title: "Engine Repair & Rebuild",
    description: "Complete engine diagnostics, repair, and rebuild services.",
  },
  "Estate Cleanout": {
    title: "Estate Cleanout",
    description: "Compassionate estate cleanout services.",
  },
  "Event Catering Coordination": {
    title: "Event Catering Coordination",
    description: "Full-service catering management for events",
  },
  "Event Security": {
    title: "Event Security Services",
    description: "Licensed security for events.",
  },
  "Eyelash Extensions": {
    title: "Eyelash Extensions",
    description: "Classic, volume, and hybrid lash extensions.",
  },
  "Fence Installation": {
    title: "Fence Installation & Repair",
    description: "Wood, vinyl, and metal fence solutions",
  },
  "Fleet Management": {
    title: "Fleet Management Services",
    description: "Vehicle tracking, maintenance scheduling, and fleet optimization.",
  },
  "Florist Services": {
    title: "Florist & Floral Design",
    description: "Custom floral arrangements for events.",
  },
  "Food Photography": {
    title: "Food Photography",
    description: "Professional food styling and photography.",
  },
  "Food Safety Consulting": {
    title: "Food Safety Consulting",
    description: "HACCP plans and health code compliance.",
  },
  "Food Truck Services": {
    title: "Food Truck Catering",
    description: "Mobile food truck catering for events.",
  },
  "Funeral Planning": {
    title: "Funeral Planning",
    description: "Complete funeral planning and coordination.",
  },
  "Game Development": {
    title: "Game Development Studio",
    description: "Mobile and PC game design and development",
  },
  "Garage Door Repair": {
    title: "Garage Door Services",
    description: "Installation, repair, and maintenance of garage doors",
  },
  "General Practice": {
    title: "General Medical Practice",
    description: "Primary care consultations.",
  },
  "Gift Wrapping": {
    title: "Gift Wrapping Services",
    description: "Beautiful custom gift wrapping for any occasion",
  },
  "Grief Counseling": {
    title: "Grief Counseling",
    description: "Professional grief counseling for families.",
  },
  "Group Classes": {
    title: "Group Fitness Classes",
    description: "HIIT, spin, yoga, and bootcamp sessions.",
  },
  "Guard Services": {
    title: "Professional Guard Services",
    description: "Licensed security guard staffing",
  },
  "HR Consulting": {
    title: "HR Consulting",
    description: "HR policy development and compliance audits.",
  },
  "Hair Coloring": {
    title: "Hair Coloring & Highlights",
    description: "Full color, highlights, balayage, and corrective color.",
  },
  "Hair Extensions": {
    title: "Hair Extension Installation",
    description: "Tape-in, sew-in, and fusion hair extensions.",
  },
  "Haircuts": {
    title: "Professional Haircuts",
    description: "Haircuts with styling for all ages.",
  },
  "Health Insurance Advisory": {
    title: "Health Insurance Advisory",
    description: "Help choosing the right health insurance plan",
  },
  "Helpdesk Services": {
    title: "IT Helpdesk Services",
    description: "24/7 technical support and helpdesk solutions",
  },
  "Holistic Healing": {
    title: "Holistic Healing & Reiki",
    description: "Energy healing and holistic wellness.",
  },
  "Home Inspection": {
    title: "Home Inspection Services",
    description: "Thorough pre-purchase home inspections",
  },
  "Home Organization": {
    title: "Home Organization Services",
    description: "Declutter and organize your living spaces",
  },
  "Home Remodeling": {
    title: "Home Remodeling Projects",
    description: "Full-service home renovation and remodeling",
  },
  "Home Staging": {
    title: "Home Staging for Sale",
    description: "Professional staging to sell your home faster",
  },
  "Home Theater Setup": {
    title: "Home Theater Installation",
    description: "Custom home theater design and setup",
  },
  "Hotel Staffing": {
    title: "Hotel Staffing Solutions",
    description: "Temporary and permanent hospitality staffing",
  },
  "House Cleaning": {
    title: "House Cleaning Services",
    description: "Regular and one-time house cleaning",
  },
  "IT Consulting": {
    title: "IT Strategy Consulting",
    description: "IT infrastructure planning and digital transformation.",
  },
  "Immigration Services": {
    title: "Immigration Legal Services",
    description: "Visa applications and immigration consulting.",
  },
  "Industrial Cleaning": {
    title: "Industrial Cleaning Services",
    description: "Heavy-duty cleaning for industrial facilities",
  },
  "Infrastructure Management": {
    title: "IT Infrastructure Management",
    description: "Server, network, and infrastructure oversight",
  },
  "Insulation": {
    title: "Insulation Installation",
    description: "Energy-efficient insulation for attics, walls, and crawlspaces",
  },
  "Insurance Brokerage": {
    title: "Insurance Brokerage Services",
    description: "Compare and find the best insurance policies",
  },
  "Intellectual Property": {
    title: "IP & Patent Services",
    description: "Patent and trademark registration.",
  },
  "Invitation Design": {
    title: "Invitation Design",
    description: "Custom invitation design and printing.",
  },
  "IoT Solutions": {
    title: "IoT Solutions & Integration",
    description: "Internet of Things device setup and integration",
  },
  "Irrigation Services": {
    title: "Irrigation System Services",
    description: "Sprinkler and drip irrigation installation and repair",
  },
  "Itinerary Planning": {
    title: "Travel Itinerary Planning",
    description: "Custom travel itineraries and trip planning",
  },
  "Janitorial": {
    title: "Janitorial Services",
    description: "Daily janitorial maintenance for buildings",
  },
  "Kids Tutoring": {
    title: "Kids Tutoring",
    description: "Tutoring in reading, math, and science for K-8.",
  },
  "Lawn Care": {
    title: "Lawn Care & Mowing",
    description: "Professional lawn maintenance and mowing services",
  },
  "Leather Restoration": {
    title: "Leather Restoration",
    description: "Cleaning and repair of leather goods.",
  },
  "Life Coaching": {
    title: "Life Coaching Sessions",
    description: "Goal setting and personal development coaching.",
  },
  "Litigation": {
    title: "Litigation Support",
    description: "Civil and commercial litigation support.",
  },
  "Live Streaming": {
    title: "Live Streaming Services",
    description: "Professional multi-camera live streaming.",
  },
  "Machine Learning Models": {
    title: "Machine Learning Model Development",
    description: "Custom ML models for business applications",
  },
  "Manicure": {
    title: "Manicure Services",
    description: "Classic, gel, and spa manicures with nail art options.",
  },
  "Marine Engine Repair": {
    title: "Marine Engine Repair",
    description: "Outboard and inboard marine engine services",
  },
  "Meditation Coaching": {
    title: "Meditation & Mindfulness",
    description: "Guided meditation and mindfulness training.",
  },
  "Memorial Design": {
    title: "Memorial Design",
    description: "Custom memorial design and monuments.",
  },
  "Microblading": {
    title: "Microblading & Brow Design",
    description: "Semi-permanent eyebrow microblading.",
  },
  "Mobile Apps": {
    title: "Mobile App Development",
    description: "iOS and Android app design and development",
  },
  "Mortgage Consulting": {
    title: "Mortgage Consulting Services",
    description: "Expert mortgage advice and loan guidance",
  },
  "Motorcycle Repair": {
    title: "Motorcycle Repair & Service",
    description: "Full-service motorcycle maintenance and customization.",
  },
  "Move-in/out Cleaning": {
    title: "Move-in/Move-out Cleaning",
    description: "Complete cleaning for move-in or move-out transitions",
  },
  "Mural Painting": {
    title: "Mural Painting",
    description: "Custom indoor and outdoor murals.",
  },
  "Music Production": {
    title: "Music Production & Mixing",
    description: "Professional music production and mastering.",
  },
  "Nail Art": {
    title: "Custom Nail Art",
    description: "Hand-painted designs, 3D art, and specialty nail art.",
  },
  "Nanny Services": {
    title: "Professional Nanny Services",
    description: "Full-time and part-time nanny services.",
  },
  "Network Setup": {
    title: "Network Setup & Configuration",
    description: "Business and home network installation",
  },
  "Nutrition Label Consulting": {
    title: "Nutrition Label Design",
    description: "FDA-compliant nutrition labels.",
  },
  "Obituary Writing": {
    title: "Obituary Writing",
    description: "Thoughtful obituary and tribute creation.",
  },
  "Occupational Therapy": {
    title: "Occupational Therapy",
    description: "Rehabilitation for daily living activities.",
  },
  "Online Coaching": {
    title: "Online Health Coaching",
    description: "Virtual health coaching sessions tailored to your goals",
  },
  "Paint Protection Film": {
    title: "PPF Installation",
    description: "Clear bra and PPF to protect against chips and scratches.",
  },
  "Party Equipment": {
    title: "Party Equipment Rental",
    description: "Tables, chairs, tents, and entertainment rental.",
  },
  "Pedicure": {
    title: "Pedicure Services",
    description: "Relaxing pedicures with exfoliation and massage.",
  },
  "Penetration Testing": {
    title: "Penetration Testing",
    description: "Ethical hacking and security vulnerability assessments",
  },
  "Performers": {
    title: "Live Performers",
    description: "Musicians, magicians, and entertainers for events.",
  },
  "Personal Styling": {
    title: "Personal Styling Consultation",
    description: "Wardrobe makeovers and personal style advice",
  },
  "Photo Booth Rental": {
    title: "Photo Booth Rental",
    description: "Photo booths with props and instant prints.",
  },
  "Pilates Instruction": {
    title: "Pilates Group & Private Classes",
    description: "Mat and reformer Pilates for all levels",
  },
  "Podcast Editing": {
    title: "Podcast Editing",
    description: "Audio editing, noise removal, and show notes.",
  },
  "Podcast Marketing": {
    title: "Podcast Marketing & Growth",
    description: "Grow your podcast audience with targeted marketing",
  },
  "Private Security": {
    title: "Private Security Services",
    description: "Licensed private security for events and properties",
  },
  "Property Appraisal": {
    title: "Property Appraisal Services",
    description: "Certified property valuations and appraisals",
  },
  "Property Management": {
    title: "Property Management",
    description: "Full-service rental property management",
  },
  "Psychiatry": {
    title: "Psychiatry Consultations",
    description: "Licensed psychiatric evaluations and medication management",
  },
  "Psychology": {
    title: "Psychology & Therapy Sessions",
    description: "Individual and couples therapy with licensed psychologist",
  },
  "QA Testing": {
    title: "QA & Software Testing",
    description: "Manual and automated software quality assurance",
  },
  "Real Estate Agents": {
    title: "Real Estate Agent Services",
    description: "Licensed agents for buying and selling homes",
  },
  "Recruitment": {
    title: "Recruitment & Staffing",
    description: "Talent acquisition and recruitment services",
  },
  "Relocation Assistance": {
    title: "Relocation Assistance",
    description: "End-to-end support for relocating to a new city",
  },
  "Residential Moving": {
    title: "Residential Moving Services",
    description: "Full-service home moving and packing",
  },
  "Resort Management": {
    title: "Resort Management Services",
    description: "Comprehensive resort operations management",
  },
  "Risk Assessment": {
    title: "Risk Assessment Services",
    description: "Comprehensive IT and business risk assessments",
  },
  "Risk Management": {
    title: "Risk Management Consulting",
    description: "Identify and mitigate business and personal risks",
  },
  "Roadside Assistance": {
    title: "24/7 Roadside Assistance",
    description: "Jump starts, tire changes, lockouts, and towing coordination.",
  },
  "SaaS Platforms": {
    title: "SaaS Platform Development",
    description: "End-to-end SaaS product development",
  },
  "Sailing Instruction": {
    title: "Sailing Lessons & Instruction",
    description: "Learn to sail with certified instructors",
  },
  "Schools": {
    title: "Private School Tutoring",
    description: "Supplementary education and enrichment.",
  },
  "Script Writing": {
    title: "Script Writing",
    description: "Scripts for commercials and short films.",
  },
  "Security Monitoring": {
    title: "Security Monitoring Services",
    description: "24/7 cybersecurity monitoring and incident response",
  },
  "Self-Storage": {
    title: "Self-Storage Solutions",
    description: "Secure and climate-controlled storage units",
  },
  "Senior Companion Services": {
    title: "Senior Companion Care",
    description: "Companionship and light housekeeping for seniors.",
  },
  "Shoe Repair": {
    title: "Shoe Repair & Restoration",
    description: "Resoling and restoration of shoes.",
  },
  "Shuttle Services": {
    title: "Shuttle & Transport Services",
    description: "Airport and event shuttle services",
  },
  "Skin Facials": {
    title: "Facial Treatments",
    description: "Deep cleansing facials and microdermabrasion.",
  },
  "Skin Waxing": {
    title: "Body Waxing Services",
    description: "Full body waxing including Brazilian and facial.",
  },
  "Sleep Consulting": {
    title: "Sleep Wellness Consulting",
    description: "Expert guidance for better sleep habits and routines",
  },
  "Specialist Care": {
    title: "Specialist Medical Care",
    description: "Referral-based specialist consultations",
  },
  "Speech Therapy": {
    title: "Speech & Language Therapy",
    description: "Certified speech-language pathology services",
  },
  "Sports Rehabilitation": {
    title: "Sports Injury Rehabilitation",
    description: "Recovery programs for athletic injuries",
  },
  "Spray Tanning": {
    title: "Spray Tan Application",
    description: "Custom airbrush spray tanning for a natural glow.",
  },
  "Strategy Consulting": {
    title: "Business Strategy Consulting",
    description: "Growth strategy and competitive analysis.",
  },
  "Surveillance": {
    title: "Surveillance System Setup",
    description: "Professional surveillance and monitoring installation",
  },
  "System Administration": {
    title: "System Administration",
    description: "Server and system management services",
  },
  "Tailoring": {
    title: "Custom Tailoring",
    description: "Professional suit tailoring and adjustments.",
  },
  "Technical Writing": {
    title: "Technical Writing Services",
    description: "Documentation, manuals, and technical content",
  },
  "Teeth Whitening": {
    title: "Professional Teeth Whitening",
    description: "In-office and take-home whitening treatments.",
  },
  "Telemedicine": {
    title: "Telemedicine Appointments",
    description: "Virtual doctor visits from the comfort of home",
  },
  "Temp Agencies": {
    title: "Temp Agency Staffing",
    description: "Temporary workforce placement services",
  },
  "Theater Production": {
    title: "Theater Production",
    description: "Stage management and production coordination.",
  },
  "Tire Rotation": {
    title: "Tire Rotation & Balancing",
    description: "Professional tire rotation, balancing, and alignment check.",
  },
  "Tour Guides": {
    title: "Professional Tour Guides",
    description: "Certified local and cultural tour guides",
  },
  "Towing": {
    title: "Towing Service",
    description: "Local and long-distance towing for all vehicles.",
  },
  "Transcription": {
    title: "Transcription Services",
    description: "Accurate transcription for meetings and legal proceedings.",
  },
  "Transmission Repair": {
    title: "Transmission Service",
    description: "Transmission diagnostics, fluid change, rebuild, and replacement.",
  },
  "Travel Agencies": {
    title: "Travel Agency Services",
    description: "Full-service travel booking and packages",
  },
  "Tree Trimming": {
    title: "Tree Trimming & Removal",
    description: "Professional tree care, trimming, and safe removal",
  },
  "Vacation Rental Cleaning": {
    title: "Vacation Rental Cleaning",
    description: "Turnover cleaning for short-term rentals",
  },
  "Vehicle Inspection": {
    title: "Pre-Purchase Inspection",
    description: "Comprehensive multi-point inspection before buying a vehicle.",
  },
  "Venues": {
    title: "Venue Booking",
    description: "Event venue sourcing and coordination.",
  },
  "Video Marketing": {
    title: "Video Marketing Campaigns",
    description: "Create compelling video marketing content",
  },
  "Voice-over": {
    title: "Professional Voice-over",
    description: "Voice-over for commercials and audiobooks.",
  },
  "Warehousing": {
    title: "Warehousing & Distribution",
    description: "Commercial warehousing and inventory management",
  },
  "Wedding Planning": {
    title: "Full Wedding Planning",
    description: "Complete wedding planning from concept to execution.",
  },
  "Window Installation": {
    title: "Window Installation & Replacement",
    description: "Energy-efficient window upgrades and new installations",
  },
  "Wine Consulting": {
    title: "Wine Consulting",
    description: "Wine selection and cellar management.",
  },
  "Yacht Management": {
    title: "Yacht Management Services",
    description: "Full-service yacht operations and maintenance",
  },
};

export default serviceExamplesEn;
