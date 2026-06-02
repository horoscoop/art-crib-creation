
-- 1. NFC identifier on artworks
ALTER TABLE public.artworks
  ADD COLUMN IF NOT EXISTS nfc_id text UNIQUE;

-- Backfill existing rows
UPDATE public.artworks
SET nfc_id = encode(extensions.gen_random_bytes(8), 'hex')
WHERE nfc_id IS NULL;

ALTER TABLE public.artworks ALTER COLUMN nfc_id SET NOT NULL;
ALTER TABLE public.artworks ALTER COLUMN nfc_id SET DEFAULT encode(extensions.gen_random_bytes(8), 'hex');

-- 2. Append-only chained-hash trace registry
CREATE TABLE IF NOT EXISTS public.trace_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id uuid NOT NULL REFERENCES public.artworks(id) ON DELETE CASCADE,
  seq bigint NOT NULL,
  event_type text NOT NULL, -- install, maintenance, expertise, inspection, transfer, certificate
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid,
  prev_hash text,
  hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (artwork_id, seq)
);

CREATE INDEX IF NOT EXISTS trace_events_artwork_idx ON public.trace_events(artwork_id, seq);

GRANT SELECT, INSERT ON public.trace_events TO authenticated;
GRANT SELECT ON public.trace_events TO anon;
GRANT ALL ON public.trace_events TO service_role;

ALTER TABLE public.trace_events ENABLE ROW LEVEL SECURITY;

-- Anyone (even anon) can read trace events: registry is public + verifiable
CREATE POLICY "public read trace_events"
ON public.trace_events FOR SELECT
TO anon, authenticated
USING (true);

-- Only authenticated owners/admins/experts can append events
CREATE POLICY "write trace_events"
ON public.trace_events FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.artworks a
    WHERE a.id = trace_events.artwork_id
      AND (a.owner_id = auth.uid()
           OR public.has_role(auth.uid(), 'admin'::app_role)
           OR public.has_role(auth.uid(), 'expert_koa'::app_role))
  )
);

-- 3. Public read-only function for trace passport (no PII)
CREATE OR REPLACE FUNCTION public.get_trace_passport(_nfc_id text)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'nfc_id', a.nfc_id,
    'title', a.title,
    'artist', a.artist,
    'install_date', a.install_date,
    'koa_system', a.koa_system,
    'location', a.location,
    'events', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'seq', e.seq,
        'event_type', e.event_type,
        'created_at', e.created_at,
        'hash', e.hash,
        'prev_hash', e.prev_hash,
        'payload', e.payload
      ) ORDER BY e.seq)
      FROM public.trace_events e WHERE e.artwork_id = a.id
    ), '[]'::jsonb)
  )
  FROM public.artworks a
  WHERE a.nfc_id = _nfc_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_trace_passport(text) TO anon, authenticated;
