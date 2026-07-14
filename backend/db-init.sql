-- Esquema SQL Recomendado para Ejecutar en tu Base de Datos PostgreSQL (ej: Panel SQL de Supabase)

-- 1. Crear Tabla Principal de Bitácora
CREATE TABLE public.bitacora (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha date NOT NULL,
  horas_hombre numeric(10,2) DEFAULT 0,
  resumen text NOT NULL,
  clima varchar(50) NOT NULL,
  ubicacion varchar(150),
  proyecto_id uuid,
  proyecto_nombre varchar(255),
  created_by uuid NOT NULL REFERENCES auth.users(id), -- Requiere supabase auth
  created_at timestamp with time zone DEFAULT now()
);

-- 2. Crear Tabla de Eventos Asociados (Incidencias Múltiples)
CREATE TABLE public.bitacora_eventos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  bitacora_id uuid NOT NULL REFERENCES public.bitacora(id) ON DELETE CASCADE,
  titulo varchar(255) NOT NULL,
  descripcion text,
  created_at timestamp with time zone DEFAULT now()
);

-- 3. Crear Tabla de Evidencia Fotográfica (Fotos Múltiples)
CREATE TABLE public.bitacora_fotos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  bitacora_id uuid NOT NULL REFERENCES public.bitacora(id) ON DELETE CASCADE,
  url_path varchar(1024) NOT NULL, -- Path local, S3, o Supabase Storage
  size integer,
  mime_type varchar(50),
  tipo varchar(50) DEFAULT 'tarea', -- 'tarea' o 'incidente'
  created_at timestamp with time zone DEFAULT now()
);

-- Activar RLS (Row Level Security) opcional en Supabase si prefieres blindar tu DB
-- ALTER TABLE public.bitacora ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.bitacora_eventos ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.bitacora_fotos ENABLE ROW LEVEL SECURITY;
