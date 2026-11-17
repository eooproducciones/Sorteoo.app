-- ============================================================================
-- sorteoo.app — Esquema de Producción para Supabase (PostgreSQL + Storage)
-- Ejecuta este script completo en el SQL Editor de tu proyecto en Supabase.
-- ============================================================================

-- 1. Tabla de Usuarios
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  avatar TEXT NOT NULL DEFAULT '',
  instagram_config JSONB NOT NULL DEFAULT '{"isConnected": false}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email_lower
  ON public.users (LOWER(email));

-- 2. Tabla de Sorteos Realizados y Certificados Públicos
CREATE TABLE IF NOT EXISTS public.giveaways (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'guest_user',
  post_url TEXT NOT NULL,
  post_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'draft')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_participants_detected INTEGER NOT NULL DEFAULT 0,
  valid_participants_count INTEGER NOT NULL DEFAULT 0,
  filters_applied JSONB NOT NULL DEFAULT '{}'::jsonb,
  winners_count INTEGER NOT NULL DEFAULT 1,
  substitutes_count INTEGER NOT NULL DEFAULT 0,
  winners JSONB NOT NULL DEFAULT '[]'::jsonb,
  substitutes JSONB NOT NULL DEFAULT '[]'::jsonb,
  audit JSONB NOT NULL DEFAULT '{}'::jsonb,
  verification_code TEXT GENERATED ALWAYS AS (audit->>'verificationCode') STORED,
  video JSONB NOT NULL DEFAULT '{"hasVideo": false}'::jsonb,
  multibrand_meta JSONB
);

CREATE INDEX IF NOT EXISTS idx_giveaways_user_created
  ON public.giveaways (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_giveaways_verification_code_lower
  ON public.giveaways (LOWER(verification_code));

-- 3. Tabla de Historias Multimarcas (para sorteos con respuestas "PARTICIPO")
CREATE TABLE IF NOT EXISTS public.multibrand_stories (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  username TEXT NOT NULL,
  media_url TEXT NOT NULL DEFAULT '',
  thumbnail_url TEXT,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  brand_name TEXT NOT NULL,
  prize TEXT,
  replies_count INTEGER NOT NULL DEFAULT 0,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_multibrand_stories_published
  ON public.multibrand_stories (published_at DESC);

-- 4. Tabla de Respuestas a Historias Multimarcas
CREATE TABLE IF NOT EXISTS public.multibrand_story_replies (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES public.multibrand_stories(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  text TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_valid_participo BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_multibrand_replies_story
  ON public.multibrand_story_replies (story_id, is_valid_participo);

-- 5. Seguridad Row Level Security (RLS)
-- El servidor backend usa SUPABASE_SERVICE_ROLE_KEY (omite RLS de forma segura).
-- Bloqueamos el acceso anónimo directo desde el cliente por defecto.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.giveaways ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.multibrand_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.multibrand_story_replies ENABLE ROW LEVEL SECURITY;

-- Lectura pública exclusiva para verificación de certificados por código
DROP POLICY IF EXISTS "Public verify giveaway certificate" ON public.giveaways;
CREATE POLICY "Public verify giveaway certificate"
  ON public.giveaways
  FOR SELECT
  TO anon, authenticated
  USING (status = 'completed' AND verification_code IS NOT NULL);

-- 6. Bucket de Storage privado para almacenar los videos de los sorteos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'giveaway-videos',
  'giveaway-videos',
  FALSE,
  104857600, -- 100 MB máximo por video
  ARRAY['video/mp4', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;
