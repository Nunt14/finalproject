-- Create storage buckets for images
-- This script creates the necessary storage buckets for the application

-- Create profile-images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-images',
  'profile-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Create payment-proofs bucket (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-proofs',
  'payment-proofs',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Create qr-codes bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'qr-codes',
  'qr-codes',
  true,
  2097152, -- 2MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for profile-images bucket
CREATE POLICY "Users can upload their own profile images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'profile-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own profile images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'profile-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own profile images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'profile-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Anyone can view profile images" ON storage.objects
  FOR SELECT USING (bucket_id = 'profile-images');

-- Create RLS policies for payment-proofs bucket
CREATE POLICY "Users can upload payment proofs" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'payment-proofs');

CREATE POLICY "Users can update payment proofs" ON storage.objects
  FOR UPDATE USING (bucket_id = 'payment-proofs');

CREATE POLICY "Users can delete payment proofs" ON storage.objects
  FOR DELETE USING (bucket_id = 'payment-proofs');

CREATE POLICY "Anyone can view payment proofs" ON storage.objects
  FOR SELECT USING (bucket_id = 'payment-proofs');

-- Create RLS policies for qr-codes bucket
CREATE POLICY "Users can upload their own QR codes" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'qr-codes' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own QR codes" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'qr-codes' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own QR codes" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'qr-codes' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Anyone can view QR codes" ON storage.objects
  FOR SELECT USING (bucket_id = 'qr-codes');

-- Verify buckets are created
SELECT id, name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE id IN ('profile-images', 'payment-proofs', 'qr-codes')
ORDER BY id;
