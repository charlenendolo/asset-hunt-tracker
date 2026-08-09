DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Authenticated users can view machine photos'
  ) THEN
    CREATE POLICY "Authenticated users can view machine photos"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (bucket_id = 'machine-photos');
  END IF;
END $$;