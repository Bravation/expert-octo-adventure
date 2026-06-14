
-- Drop FK constraint temporarily
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;

-- Insert dummy provider profiles
INSERT INTO public.profiles (id, user_id, full_name, email, role, bio, city, state, zip_code, latitude, longitude, average_rating, total_reviews, total_services_completed, avatar_url) VALUES
('d0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', 'Carlos Mendoza', 'carlos@demo.com', 'service_provider', 'Expert plumber with 15 years of experience.', 'Miami', 'FL', '33101', 25.7617, -80.1918, 4.8, 124, 310, ''),
('d0000002-0000-0000-0000-000000000002', 'a0000002-0000-0000-0000-000000000002', 'Sofia Rivera', 'sofia@demo.com', 'service_provider', 'Professional graphic designer and branding specialist.', 'Orlando', 'FL', '32801', 28.5383, -81.3792, 4.9, 87, 215, ''),
('d0000003-0000-0000-0000-000000000003', 'a0000003-0000-0000-0000-000000000003', 'James Wilson', 'james@demo.com', 'service_provider', 'Certified personal trainer and nutrition coach.', 'Tampa', 'FL', '33602', 27.9506, -82.4572, 4.7, 65, 180, ''),
('d0000004-0000-0000-0000-000000000004', 'a0000004-0000-0000-0000-000000000004', 'Maria Santos', 'maria@demo.com', 'service_provider', 'Licensed cosmetologist with expertise in hair and makeup.', 'Fort Lauderdale', 'FL', '33301', 26.1224, -80.1373, 4.6, 98, 275, ''),
('d0000005-0000-0000-0000-000000000005', 'a0000005-0000-0000-0000-000000000005', 'David Chen', 'david@demo.com', 'service_provider', 'Full-stack developer and IT consultant.', 'Jacksonville', 'FL', '32202', 30.3322, -81.6557, 5.0, 42, 95, ''),
('d0000006-0000-0000-0000-000000000006', 'a0000006-0000-0000-0000-000000000006', 'Ana Garcia', 'ana@demo.com', 'service_provider', 'Professional chef and catering expert.', 'Miami Beach', 'FL', '33139', 25.7907, -80.1300, 4.9, 156, 420, ''),
('d0000007-0000-0000-0000-000000000007', 'a0000007-0000-0000-0000-000000000007', 'Robert Taylor', 'robert@demo.com', 'service_provider', 'Experienced accountant and tax advisor.', 'Naples', 'FL', '34102', 26.1420, -81.7948, 4.5, 33, 88, ''),
('d0000008-0000-0000-0000-000000000008', 'a0000008-0000-0000-0000-000000000008', 'Laura Martinez', 'laura@demo.com', 'service_provider', 'Bilingual tutor and education consultant.', 'Hialeah', 'FL', '33012', 25.8576, -80.2781, 4.8, 71, 190, '');

-- Re-add FK constraint (but NOT VALID so existing orphan rows don't break it)
ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) NOT VALID;

-- Insert dummy services across ALL categories
INSERT INTO public.services (title, description, price, category, provider_id, status, photo_url) VALUES
-- Corporate & Administrative
('Virtual Assistant Services', 'Professional virtual assistant for scheduling, email management, and data entry.', 25.00, 'Virtual Assistance', 'd0000002-0000-0000-0000-000000000002', 'available', 'https://images.unsplash.com/photo-1552581234-26160f608093?w=600'),
('Office Organization', 'Complete office setup, filing systems, and workspace optimization.', 45.00, 'Office Support', 'd0000007-0000-0000-0000-000000000007', 'available', 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600'),
('Customer Service Representative', 'Bilingual customer support via phone, email, and chat.', 20.00, 'Customer Service', 'd0000008-0000-0000-0000-000000000008', 'available', 'https://images.unsplash.com/photo-1556745757-8d76bdb6984b?w=600'),
-- Financial & Legal
('Tax Preparation', 'Personal and small business tax filing with maximized deductions.', 150.00, 'Tax Preparation', 'd0000007-0000-0000-0000-000000000007', 'available', 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600'),
('Bookkeeping Services', 'Monthly bookkeeping, reconciliation, and financial reports.', 75.00, 'Bookkeeping', 'd0000007-0000-0000-0000-000000000007', 'available', 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600'),
('Legal Document Review', 'Contract review, notarization, and legal document preparation.', 120.00, 'Legal Consulting', 'd0000007-0000-0000-0000-000000000007', 'available', 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600'),
-- Marketing & Advertising
('Social Media Management', 'Content creation, scheduling, and engagement for all platforms.', 60.00, 'Social Media Management', 'd0000002-0000-0000-0000-000000000002', 'available', 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=600'),
('SEO Optimization', 'Website audit, keyword research, and on-page SEO improvements.', 85.00, 'SEO Services', 'd0000005-0000-0000-0000-000000000005', 'available', 'https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?w=600'),
('Brand Strategy Session', 'Comprehensive branding consultation with market positioning.', 200.00, 'Branding', 'd0000002-0000-0000-0000-000000000002', 'available', 'https://images.unsplash.com/photo-1542744094-3a31f272c490?w=600'),
-- Technology & IT
('Website Development', 'Custom responsive websites with modern frameworks and CMS.', 500.00, 'Web Development', 'd0000005-0000-0000-0000-000000000005', 'available', 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=600'),
('Mobile App Development', 'iOS and Android apps with React Native or Flutter.', 800.00, 'App Development', 'd0000005-0000-0000-0000-000000000005', 'available', 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=600'),
('IT Support & Troubleshooting', 'Remote and on-site tech support for hardware and software.', 40.00, 'IT Support', 'd0000005-0000-0000-0000-000000000005', 'available', 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=600'),
('Cybersecurity Audit', 'Network vulnerability assessment and security hardening.', 350.00, 'Cybersecurity', 'd0000005-0000-0000-0000-000000000005', 'available', 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600'),
-- Visual Design
('Logo Design', 'Custom logo with 3 concepts, revisions, and brand guidelines.', 180.00, 'Logo Design', 'd0000002-0000-0000-0000-000000000002', 'available', 'https://images.unsplash.com/photo-1626785774625-0b1c2c4eab67?w=600'),
('UI/UX Design', 'User interface design for web and mobile applications.', 250.00, 'UI/UX Design', 'd0000002-0000-0000-0000-000000000002', 'available', 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=600'),
('Product Photography', 'Professional product photos for e-commerce and marketing.', 95.00, 'Photography', 'd0000002-0000-0000-0000-000000000002', 'available', 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600'),
-- Content Creation
('Video Editing', 'Professional video editing with effects, color grading, and sound.', 70.00, 'Video Production', 'd0000002-0000-0000-0000-000000000002', 'available', 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=600'),
('Podcast Production', 'Recording, editing, mixing, and publishing your podcast.', 55.00, 'Podcast Production', 'd0000005-0000-0000-0000-000000000005', 'available', 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=600'),
-- Writing & Publishing
('Blog Writing', 'SEO-optimized blog posts and articles in English or Spanish.', 35.00, 'Blog Writing', 'd0000008-0000-0000-0000-000000000008', 'available', 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=600'),
('Resume & Cover Letter', 'Professional resume writing and LinkedIn profile optimization.', 50.00, 'Resume Writing', 'd0000008-0000-0000-0000-000000000008', 'available', 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600'),
('Translation Services', 'English-Spanish professional translation for documents and websites.', 30.00, 'Translation', 'd0000008-0000-0000-0000-000000000008', 'available', 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=600'),
-- Home Improvement
('Kitchen Renovation', 'Complete kitchen remodeling including cabinets and countertops.', 2500.00, 'Kitchen Remodeling', 'd0000001-0000-0000-0000-000000000001', 'available', 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600'),
('Bathroom Remodel', 'Full bathroom renovation with modern fixtures and tiling.', 1800.00, 'Bathroom Remodeling', 'd0000001-0000-0000-0000-000000000001', 'available', 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=600'),
('Interior Painting', 'Professional interior painting with premium paints and clean finish.', 300.00, 'Painting', 'd0000001-0000-0000-0000-000000000001', 'available', 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=600'),
('Flooring Installation', 'Hardwood, laminate, tile, and vinyl flooring installation.', 450.00, 'Flooring', 'd0000001-0000-0000-0000-000000000001', 'available', 'https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?w=600'),
-- Home Maintenance
('Plumbing Repair', 'Leak fixes, pipe replacement, drain cleaning, and water heater service.', 85.00, 'Plumbing', 'd0000001-0000-0000-0000-000000000001', 'available', 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=600'),
('Electrical Repair', 'Wiring, outlet installation, panel upgrades, and lighting.', 90.00, 'Electrical', 'd0000001-0000-0000-0000-000000000001', 'available', 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600'),
('AC Maintenance', 'Air conditioning tune-up, filter replacement, and repair.', 120.00, 'HVAC', 'd0000001-0000-0000-0000-000000000001', 'available', 'https://images.unsplash.com/photo-1631545806609-f7d0fb36f0ac?w=600'),
('Lawn Care & Landscaping', 'Mowing, trimming, fertilization, and garden design.', 55.00, 'Landscaping', 'd0000001-0000-0000-0000-000000000001', 'available', 'https://images.unsplash.com/photo-1558904541-efa843a96f01?w=600'),
('Pest Control', 'Safe and effective pest elimination for homes and businesses.', 75.00, 'Pest Control', 'd0000001-0000-0000-0000-000000000001', 'available', 'https://images.unsplash.com/photo-1632935198498-fc07cb5b8f06?w=600'),
-- Specialized Niches
('Home Security Installation', 'Camera systems, smart locks, and alarm setup.', 250.00, 'Home Security', 'd0000005-0000-0000-0000-000000000005', 'available', 'https://images.unsplash.com/photo-1558002038-1055907df827?w=600'),
('Pool Cleaning & Maintenance', 'Weekly pool service, chemical balancing, and equipment repair.', 65.00, 'Pool Services', 'd0000001-0000-0000-0000-000000000001', 'available', 'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?w=600'),
-- Health & Wellness
('Personal Training Session', 'One-on-one fitness training with customized workout plan.', 60.00, 'Personal Training', 'd0000003-0000-0000-0000-000000000003', 'available', 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600'),
('Yoga Classes', 'Private or group yoga sessions for all levels.', 35.00, 'Yoga', 'd0000003-0000-0000-0000-000000000003', 'available', 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600'),
('Sports Massage', 'Deep tissue massage for muscle recovery and relaxation.', 80.00, 'Massage Therapy', 'd0000003-0000-0000-0000-000000000003', 'available', 'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?w=600'),
('Nutrition Coaching', 'Personalized meal plans and dietary guidance.', 45.00, 'Nutrition Coaching', 'd0000003-0000-0000-0000-000000000003', 'available', 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600'),
-- Beauty & Grooming
('Hair Styling & Color', 'Cuts, coloring, highlights, and special occasion styling.', 65.00, 'Hair Styling', 'd0000004-0000-0000-0000-000000000004', 'available', 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600'),
('Makeup Artistry', 'Professional makeup for weddings, events, and photoshoots.', 85.00, 'Makeup', 'd0000004-0000-0000-0000-000000000004', 'available', 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=600'),
('Nail Art & Manicure', 'Gel, acrylic, and artistic nail designs.', 40.00, 'Nail Care', 'd0000004-0000-0000-0000-000000000004', 'available', 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=600'),
('Facial Treatment', 'Deep cleansing, hydration, and anti-aging skincare treatments.', 70.00, 'Skincare', 'd0000004-0000-0000-0000-000000000004', 'available', 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600'),
('Barbershop Services', 'Classic cuts, beard grooming, and hot towel shaves.', 30.00, 'Barbering', 'd0000004-0000-0000-0000-000000000004', 'available', 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600'),
-- Lifestyle & Convenience
('House Cleaning', 'Deep cleaning, regular maintenance, and move-in/out cleaning.', 50.00, 'House Cleaning', 'd0000004-0000-0000-0000-000000000004', 'available', 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600'),
('Laundry & Dry Cleaning', 'Wash, fold, and dry cleaning pickup and delivery.', 25.00, 'Laundry Services', 'd0000004-0000-0000-0000-000000000004', 'available', 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=600'),
('Personal Shopping', 'Wardrobe consulting and personal shopping assistance.', 55.00, 'Personal Shopping', 'd0000004-0000-0000-0000-000000000004', 'available', 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600'),
('Errand Running', 'Grocery shopping, package delivery, and daily errands.', 20.00, 'Errand Services', 'd0000006-0000-0000-0000-000000000006', 'available', 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=600'),
-- Automotive
('Auto Detailing', 'Interior and exterior car detailing with ceramic coating.', 120.00, 'Auto Detailing', 'd0000001-0000-0000-0000-000000000001', 'available', 'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=600'),
('Mobile Mechanic', 'On-site car repair, oil changes, and brake service.', 95.00, 'General Mechanics', 'd0000001-0000-0000-0000-000000000001', 'available', 'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=600'),
-- Education
('Math Tutoring', 'K-12 and college math tutoring including calculus.', 40.00, 'Academic Tutoring', 'd0000008-0000-0000-0000-000000000008', 'available', 'https://images.unsplash.com/photo-1596496050827-8299e0220de1?w=600'),
('English/ESL Lessons', 'Conversational English and academic ESL for all levels.', 35.00, 'Language Lessons', 'd0000008-0000-0000-0000-000000000008', 'available', 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600'),
('Music Lessons', 'Guitar, piano, and vocal lessons for all levels.', 45.00, 'Music Lessons', 'd0000008-0000-0000-0000-000000000008', 'available', 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=600'),
('SAT/ACT Prep', 'Test preparation with practice exams and strategies.', 55.00, 'Test Preparation', 'd0000008-0000-0000-0000-000000000008', 'available', 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600'),
-- Food
('Personal Chef', 'In-home meal preparation for families and special diets.', 100.00, 'Personal Chef', 'd0000006-0000-0000-0000-000000000006', 'available', 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=600'),
('Catering Service', 'Full-service catering for parties and corporate events.', 500.00, 'Catering', 'd0000006-0000-0000-0000-000000000006', 'available', 'https://images.unsplash.com/photo-1555244162-803834f70033?w=600'),
('Meal Prep Delivery', 'Weekly meal prep with balanced macros and fresh ingredients.', 75.00, 'Meal Prep', 'd0000006-0000-0000-0000-000000000006', 'available', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600'),
('Cake & Pastry Design', 'Custom cakes, cupcakes, and pastries for any occasion.', 85.00, 'Baking', 'd0000006-0000-0000-0000-000000000006', 'available', 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600'),
-- Events
('Wedding Planning', 'Full-service wedding coordination from venue to reception.', 1500.00, 'Wedding Planning', 'd0000006-0000-0000-0000-000000000006', 'available', 'https://images.unsplash.com/photo-1519741497674-611481863552?w=600'),
('DJ & Music Entertainment', 'Professional DJ for parties, weddings, and events.', 200.00, 'DJ Services', 'd0000003-0000-0000-0000-000000000003', 'available', 'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=600'),
('Event Photography', 'Professional photography for weddings and events.', 150.00, 'Event Photography', 'd0000002-0000-0000-0000-000000000002', 'available', 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600'),
('Party Decorating', 'Custom decorations, balloon art, and venue styling.', 180.00, 'Event Decorating', 'd0000006-0000-0000-0000-000000000006', 'available', 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=600'),
-- Hospitality
('Airbnb Management', 'Complete vacation rental management and guest communication.', 150.00, 'Vacation Rental Management', 'd0000007-0000-0000-0000-000000000007', 'available', 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600'),
-- Health & Science
('Lab Sample Collection', 'Mobile phlebotomy and lab sample collection.', 45.00, 'Lab Services', 'd0000003-0000-0000-0000-000000000003', 'available', 'https://images.unsplash.com/photo-1579165466741-7f35e4755660?w=600'),
('Mental Health Counseling', 'Licensed therapy sessions via telehealth or in-person.', 90.00, 'Mental Health', 'd0000003-0000-0000-0000-000000000003', 'available', 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=600'),
-- Logistics
('Moving Services', 'Local and long-distance moving with packing.', 200.00, 'Moving Services', 'd0000001-0000-0000-0000-000000000001', 'available', 'https://images.unsplash.com/photo-1600518464441-9154a4dea21b?w=600'),
('Courier & Delivery', 'Same-day local delivery for packages and documents.', 15.00, 'Courier Services', 'd0000006-0000-0000-0000-000000000006', 'available', 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=600'),
-- Animal & Agricultural
('Dog Walking', 'Daily dog walking and pet sitting services.', 20.00, 'Pet Sitting', 'd0000003-0000-0000-0000-000000000003', 'available', 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=600'),
('Pet Grooming', 'Full grooming: bath, haircut, and nail trim.', 50.00, 'Pet Grooming', 'd0000004-0000-0000-0000-000000000004', 'available', 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?w=600'),
('Veterinary House Calls', 'Mobile vet visits for checkups and vaccines.', 85.00, 'Veterinary Services', 'd0000003-0000-0000-0000-000000000003', 'available', 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=600'),
-- Sustainability
('Solar Panel Installation', 'Residential solar panel setup with permits.', 3000.00, 'Solar Energy', 'd0000001-0000-0000-0000-000000000001', 'available', 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=600'),
('Eco-Friendly Cleaning', 'Green cleaning with non-toxic, biodegradable products.', 55.00, 'Green Cleaning', 'd0000004-0000-0000-0000-000000000004', 'available', 'https://images.unsplash.com/photo-1528740561666-dc2479dc08ab?w=600');
