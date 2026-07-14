-- Esquema SQL para PostgreSQL

-- 0. Crear Tabla de Usuarios (Combina auth.users y public.profiles)
CREATE TABLE public.users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email varchar(255) UNIQUE NOT NULL,
  password_hash varchar(255) NOT NULL,
  full_name varchar(255),
  avatar_url varchar(1024),
  role varchar(50) DEFAULT 'user',
  created_at timestamp with time zone DEFAULT now()
);

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
  created_by uuid NOT NULL REFERENCES public.users(id),
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
  url_path varchar(1024) NOT NULL,
  size integer,
  mime_type varchar(50),
  tipo varchar(50) DEFAULT 'tarea',
  created_at timestamp with time zone DEFAULT now()
);

-- 4. Projects
CREATE TABLE public.projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name varchar(255) NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 5. Planos
CREATE TABLE public.planos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  summary varchar(255) NOT NULL,
  objectives text,
  status varchar(50) DEFAULT 'Pendiente',
  start_date date,
  end_date date,
  budget numeric(12,2),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 6. Groups (Chats)
CREATE TABLE public.groups (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name varchar(255) NOT NULL,
  avatar_url varchar(1024),
  created_by uuid NOT NULL REFERENCES public.users(id),
  created_at timestamp with time zone DEFAULT now()
);

-- 7. Group Members
CREATE TABLE public.group_members (
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

-- 8. Messages (Chats Directos y Grupales)
CREATE TABLE public.messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  sender_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  is_read boolean DEFAULT false,
  CHECK ((receiver_id IS NOT NULL AND group_id IS NULL) OR (receiver_id IS NULL AND group_id IS NOT NULL))
);

-- 9. Pinned Conversations
CREATE TABLE public.pinned_conversations (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL,
  type varchar(20) NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (user_id, conversation_id)
);

-- 10. Project Files (Facturas y Adjuntos)
CREATE TABLE public.project_files (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  xml_file_name varchar(255),
  xml_file_url varchar(1024),
  attachment_file_name varchar(255),
  attachment_file_url varchar(1024),
  category varchar(100),
  tags jsonb DEFAULT '[]'::jsonb,
  comments text,
  invoice_date date,
  created_at timestamp with time zone DEFAULT now()
);

-- DUMMY DATA

INSERT INTO public.users (id, email, password_hash, full_name, role) VALUES 
('11111111-1111-1111-1111-111111111111', 'admin@devops.com', '$2b$10$eE.l1y41M12LgR6L81f3x.KkS29mX9u38QZ3T93Yx2.C21z2gZ2.y', 'Admin User', 'admin'),
('22222222-2222-2222-2222-222222222222', 'user@devops.com', '$2b$10$eE.l1y41M12LgR6L81f3x.KkS29mX9u38QZ3T93Yx2.C21z2gZ2.y', 'Regular User', 'user') ON CONFLICT (email) DO NOTHING;

INSERT INTO public.projects (id, name, description) VALUES 
('33333333-3333-3333-3333-333333333333', 'Proyecto Alpha', 'Construcción de edificio residencial.'),
('44444444-4444-4444-4444-444444444444', 'Proyecto Beta', 'Remodelación de oficinas.') ON CONFLICT DO NOTHING;

INSERT INTO public.planos (project_id, summary, objectives, status) VALUES 
('33333333-3333-3333-3333-333333333333', 'Plano Eléctrico', 'Diseño de red eléctrica', 'En Proceso'),
('44444444-4444-4444-4444-444444444444', 'Plano Arquitectónico', 'Distribución de espacios', 'Aprobado');

INSERT INTO public.groups (id, name, created_by) VALUES 
('55555555-5555-5555-5555-555555555555', 'Equipo Alpha', '11111111-1111-1111-1111-111111111111') ON CONFLICT DO NOTHING;

INSERT INTO public.group_members (group_id, user_id) VALUES 
('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111'),
('55555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222') ON CONFLICT DO NOTHING;

INSERT INTO public.messages (content, sender_id, group_id) VALUES 
('Hola equipo!', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555');

INSERT INTO public.project_files (project_id, xml_file_name, xml_file_url, attachment_file_name, attachment_file_url, category, invoice_date) VALUES 
('33333333-3333-3333-3333-333333333333', 'factura1.xml', '/uploads/xml/factura1.xml', 'factura1.pdf', '/uploads/attachments/factura1.pdf', 'Materiales', '2023-10-01');
