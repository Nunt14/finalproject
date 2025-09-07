-- Safe cascade and cleanup for trip-related data
-- Run in Supabase SQL editor

-- 1) Add/repair ON DELETE CASCADE constraints (schema-aware)
DO $$
BEGIN
  -- trip_member.trip_id -> trip.trip_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='trip_member' AND column_name='trip_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='trip' AND column_name='trip_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.trip_member DROP CONSTRAINT IF EXISTS trip_member_trip_id_fkey';
    EXECUTE 'ALTER TABLE public.trip_member ADD CONSTRAINT trip_member_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trip(trip_id) ON DELETE CASCADE';
  END IF;

  -- bill.trip_id -> trip.trip_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bill' AND column_name='trip_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='trip' AND column_name='trip_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.bill DROP CONSTRAINT IF EXISTS bill_trip_id_fkey';
    EXECUTE 'ALTER TABLE public.bill ADD CONSTRAINT bill_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trip(trip_id) ON DELETE CASCADE';
  END IF;

  -- bill_share.bill_id -> bill.bill_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bill_share' AND column_name='bill_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bill' AND column_name='bill_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.bill_share DROP CONSTRAINT IF EXISTS bill_share_bill_id_fkey';
    EXECUTE 'ALTER TABLE public.bill_share ADD CONSTRAINT bill_share_bill_id_fkey FOREIGN KEY (bill_id) REFERENCES public.bill(bill_id) ON DELETE CASCADE';
  END IF;

  -- payment.bill_share_id -> bill_share.bill_share_id (optional)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payment' AND column_name='bill_share_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bill_share' AND column_name='bill_share_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.payment DROP CONSTRAINT IF EXISTS payment_bill_share_id_fkey';
    EXECUTE 'ALTER TABLE public.payment ADD CONSTRAINT payment_bill_share_id_fkey FOREIGN KEY (bill_share_id) REFERENCES public.bill_share(bill_share_id) ON DELETE CASCADE';
  END IF;

  -- payment.trip_id -> trip.trip_id (optional)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payment' AND column_name='trip_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='trip' AND column_name='trip_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.payment DROP CONSTRAINT IF EXISTS payment_trip_id_fkey';
    EXECUTE 'ALTER TABLE public.payment ADD CONSTRAINT payment_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trip(trip_id) ON DELETE CASCADE';
  END IF;

  -- (payment_proof table not present in this schema) — skipped

  -- debt_summary.trip_id -> trip.trip_id (optional)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='debt_summary' AND column_name='trip_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='trip' AND column_name='trip_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.debt_summary DROP CONSTRAINT IF EXISTS debt_summary_trip_id_fkey';
    EXECUTE 'ALTER TABLE public.debt_summary ADD CONSTRAINT debt_summary_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trip(trip_id) ON DELETE CASCADE';
  END IF;

  -- debt.trip_id -> trip.trip_id (optional)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='debt' AND column_name='trip_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='trip' AND column_name='trip_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.debt DROP CONSTRAINT IF EXISTS debt_trip_id_fkey';
    EXECUTE 'ALTER TABLE public.debt ADD CONSTRAINT debt_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trip(trip_id) ON DELETE CASCADE';
  END IF;

  -- notification.trip_id -> trip.trip_id (optional)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notification' AND column_name='trip_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='trip' AND column_name='trip_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.notification DROP CONSTRAINT IF EXISTS notification_trip_id_fkey';
    EXECUTE 'ALTER TABLE public.notification ADD CONSTRAINT notification_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trip(trip_id) ON DELETE CASCADE';
  END IF;
END $$;

-- 2) Cleanup existing orphan rows (safe, schema-aware)
-- bill_share without bill
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='bill_share') AND
     EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='bill') THEN
    EXECUTE 'DELETE FROM public.bill_share bs WHERE NOT EXISTS (SELECT 1 FROM public.bill b WHERE b.bill_id = bs.bill_id)';
  END IF;
END $$;

-- payment without bill_share
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='payment') AND
     EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='bill_share') THEN
    EXECUTE 'DELETE FROM public.payment p WHERE NOT EXISTS (SELECT 1 FROM public.bill_share bs WHERE bs.bill_share_id = p.bill_share_id)';
  END IF;
END $$;

-- (payment_proof cleanup skipped — table not present)

-- debt_summary without trip (optional)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='debt_summary') AND
     EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='trip') THEN
    EXECUTE 'DELETE FROM public.debt_summary d WHERE NOT EXISTS (SELECT 1 FROM public.trip t WHERE t.trip_id = d.trip_id)';
  END IF;
END $$;

-- debt without trip (optional)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='debt') AND
     EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='trip') THEN
    EXECUTE 'DELETE FROM public.debt d WHERE NOT EXISTS (SELECT 1 FROM public.trip t WHERE t.trip_id = d.trip_id)';
  END IF;
END $$;


