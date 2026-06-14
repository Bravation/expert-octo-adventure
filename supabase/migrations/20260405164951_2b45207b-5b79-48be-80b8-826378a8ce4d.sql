
-- Fix 8 providers with missing avatar_url
UPDATE profiles SET avatar_url = 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150' WHERE id = 'd0000001-0000-0000-0000-000000000001' AND (avatar_url IS NULL OR avatar_url = '');
UPDATE profiles SET avatar_url = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150' WHERE id = 'd0000002-0000-0000-0000-000000000002' AND (avatar_url IS NULL OR avatar_url = '');
UPDATE profiles SET avatar_url = 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150' WHERE id = 'd0000003-0000-0000-0000-000000000003' AND (avatar_url IS NULL OR avatar_url = '');
UPDATE profiles SET avatar_url = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' WHERE id = 'd0000004-0000-0000-0000-000000000004' AND (avatar_url IS NULL OR avatar_url = '');
UPDATE profiles SET avatar_url = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150' WHERE id = 'd0000005-0000-0000-0000-000000000005' AND (avatar_url IS NULL OR avatar_url = '');
UPDATE profiles SET avatar_url = 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150' WHERE id = 'd0000006-0000-0000-0000-000000000006' AND (avatar_url IS NULL OR avatar_url = '');
UPDATE profiles SET avatar_url = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150' WHERE id = 'd0000007-0000-0000-0000-000000000007' AND (avatar_url IS NULL OR avatar_url = '');
UPDATE profiles SET avatar_url = 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150' WHERE id = 'd0000008-0000-0000-0000-000000000008' AND (avatar_url IS NULL OR avatar_url = '');

-- Fix services with broken local photo URLs
UPDATE services SET photo_url = 'https://images.unsplash.com/photo-1631545806609-05cd85c1ef1b?w=600', photo_urls = ARRAY['https://images.unsplash.com/photo-1631545806609-05cd85c1ef1b?w=600'] WHERE photo_url = '/services/ac-installation.jpg';
UPDATE services SET photo_url = 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600', photo_urls = ARRAY['https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600'] WHERE photo_url = '/services/cybersecurity-audits.jpg';
UPDATE services SET photo_url = 'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=600', photo_urls = ARRAY['https://images.unsplash.com/photo-1626785774573-4b799315345d?w=600'] WHERE photo_url = '/services/logo-design.jpg';
UPDATE services SET photo_url = 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=600', photo_urls = ARRAY['https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=600'] WHERE photo_url = '/services/nft-art-creation.jpg';
UPDATE services SET photo_url = 'https://images.unsplash.com/photo-1632935190508-1b37b8e56409?w=600', photo_urls = ARRAY['https://images.unsplash.com/photo-1632935190508-1b37b8e56409?w=600'] WHERE photo_url = '/services/pest-control.jpg';
UPDATE services SET photo_url = 'https://images.unsplash.com/photo-1562778612-e1e0cda9915c?w=600', photo_urls = ARRAY['https://images.unsplash.com/photo-1562778612-e1e0cda9915c?w=600'] WHERE photo_url = '/services/pool-cleaning.jpg';
UPDATE services SET photo_url = 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600', photo_urls = ARRAY['https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600'] WHERE photo_url = '/services/pressure-washing.jpg';
UPDATE services SET photo_url = 'https://images.unsplash.com/photo-1632823471565-1ecdf5c6da20?w=600', photo_urls = ARRAY['https://images.unsplash.com/photo-1632823471565-1ecdf5c6da20?w=600'] WHERE photo_url = '/services/roofing.jpg';
UPDATE services SET photo_url = 'https://images.unsplash.com/photo-1451226428352-cf66bf8a0317?w=600', photo_urls = ARRAY['https://images.unsplash.com/photo-1451226428352-cf66bf8a0317?w=600'] WHERE photo_url = '/services/translation.jpg';
UPDATE services SET photo_url = 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600', photo_urls = ARRAY['https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600'] WHERE photo_url IS NULL AND category = 'Business Consulting';
