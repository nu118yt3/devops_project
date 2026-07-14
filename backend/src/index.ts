import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { setupRoutes } from './routes';

// ─── IMPORTACIONES PARA S3 ──────────
import { S3Client, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import multerS3 from 'multer-s3';
// ─────────────────────────────────────────────────────────────────────────────

// 1. Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'MOCK_SECRET_AQUI';

// Configuración de Servidor
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

app.use(cors());
app.use(express.json());

// 2. Configurar el Pool de Postgres (Directo a tu Supabase DB o DB Custom)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Dependiendo de tu Supabase/Railway, podrías requerir SSL:
  // ssl: { rejectUnauthorized: false }
});

const STORAGE_TYPE: string = process.env.STORAGE_TYPE || 'local';

// ─── ALMACENAMIENTO LOCAL ─────────────────────────────────────────────────────
// Activo cuando STORAGE_TYPE=local (o no está definido).
// Los archivos se guardan en la carpeta /uploads relativa al backend.
const UPLOADS_DIR = path.join(__dirname, '../uploads');
if (STORAGE_TYPE === 'local' && !fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const localStorageEngine = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

// ─── ALMACENAMIENTO S3 (AWS) ──────────────────────────────────────────────────
let s3Client: S3Client | null = null;
let s3StorageEngine: any = null;

if (STORAGE_TYPE === 's3') {
  s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  s3StorageEngine = multerS3({
    s3: s3Client as any,
    bucket: process.env.S3_BUCKET_NAME!,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, `uploads/${uniqueSuffix}-${file.originalname}`);
    },
  });
}
// ─────────────────────────────────────────────────────────────────────────────

// Selección automática del engine según STORAGE_TYPE
const activeStorageEngine = STORAGE_TYPE === 's3'
  ? s3StorageEngine
  : localStorageEngine;

// `upload.fields(...)` es usado en los endpoints de bitácora (max 10 fotos por campo)
const upload = multer({
  storage: activeStorageEngine,
  limits: { fileSize: 10 * 1024 * 1024 } // Límite de 10 MB
});

// Función helper: devuelve la ruta (key) o la URL relativa según el storage activo
const getFileUrl = (file: Express.Multer.File): string => {
  if (STORAGE_TYPE === 's3') {
    // Almacenamos únicamente el `key` (la ruta dentro del bucket)
    // para generar URLs prefirmadas dinámicamente cuando se consulte la bitácora
    return (file as any).key;
  }
  // Local: URL relativa que Express sirve vía /uploads
  return `/uploads/${file.filename}`;
};

// 4. AuthMiddleware: Validar el JWT que llega desde el frontend
export const requireAuth = (req: Request, res: Response, next: any) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado, falta token JWT.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Validar el JWT.
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // Almacenamos el token decodificado (que incluye `sub` como UUID del usuario)
    (req as any).user = decoded;
    next();
  } catch (error) {
    console.error('JWT Error:', error);
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

// -------------------------------------------------------------
// AUTH ENDPOINTS
// -------------------------------------------------------------
app.post('/v1/auth/register', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Faltan credenciales' });
    }
    
    // Check if user exists
    const userExists = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'El usuario ya existe' });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const newUser = await client.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, passwordHash]
    );

    const user = newUser.rows[0];
    const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    return res.status(201).json({ success: true, user, token });
  } catch (error: any) {
    console.error('Error in register:', error);
    return res.status(500).json({ error: 'Error del servidor' });
  } finally {
    client.release();
  }
});

app.post('/v1/auth/login', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Faltan credenciales' });
    }

    const result = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    
    return res.status(200).json({
      success: true,
      user: { id: user.id, email: user.email },
      token
    });
  } catch (error: any) {
    console.error('Error in login:', error);
    return res.status(500).json({ error: 'Error del servidor' });
  } finally {
    client.release();
  }
});

// -------------------------------------------------------------
// ENDPOINT: POST /v1/bitacora
// -------------------------------------------------------------
app.post('/v1/bitacora', requireAuth, upload.fields([
  { name: 'fotos_tarea', maxCount: 10 },
  { name: 'fotos_incidente', maxCount: 10 }
]), async (req: Request, res: Response) => {
  const client = await pool.connect();

  try {
    // 1. Extraer ID del usuario que creó el registro
    const userId = (req as any).user.sub;

    // 2. Extraer datos serializados por el frontend
    const rawData = req.body.data;
    if (!rawData) {
      return res.status(400).json({ error: 'No hay field "data" en el formData' });
    }
    const payload = JSON.parse(rawData);

    // 3. Extraer archivos subidos por multer
    const files = (req.files as { [fieldname: string]: Express.Multer.File[] }) || {};

    // --- INICIAMOS TRANSACCIÓN SQL ---
    await client.query('BEGIN');

    // Mapeo #1: Insertar "bitacora"
    // Tabla: id, fecha, horas_hombre, resumen, clima, ubicacion, created_by, proyecto_id, proyecto_nombre
    const bitacoraResult = await client.query(`
      INSERT INTO bitacora (fecha, horas_hombre, resumen, clima, ubicacion, created_by, proyecto_id, proyecto_nombre)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [
      payload.fecha,
      payload.horasHombre,
      payload.resumen,
      payload.clima,
      payload.ubicacion,
      userId,
      payload.proyecto_id || null,
      payload.proyecto_nombre || null
    ]);
    const bitacoraId = bitacoraResult.rows[0].id;

    // Mapeo #2: Insertar "bitacora_eventos"
    if (payload.eventos && payload.eventos.length > 0) {
      for (const evento of payload.eventos) {
        await client.query(`
          INSERT INTO bitacora_eventos (bitacora_id, titulo, descripcion)
          VALUES ($1, $2, $3)
        `, [bitacoraId, evento.titulo, evento.descripcion]);
      }
    }

    // Mapeo #3: Insertar "bitacora_fotos" clasificadas por tipo
    // getFileUrl() devuelve la URL local o la URL pública de S3 según STORAGE_TYPE
    const insertFoto = async (file: Express.Multer.File, tipo: string) => {
      const fileUrl = getFileUrl(file);
      await client.query(`
        INSERT INTO bitacora_fotos (bitacora_id, url_path, size, mime_type, tipo)
        VALUES ($1, $2, $3, $4, $5)
      `, [bitacoraId, fileUrl, file.size, file.mimetype, tipo]);
    };

    let totalFotos = 0;
    if (files['fotos_tarea']) {
      for (const file of files['fotos_tarea']) {
        await insertFoto(file, 'tarea');
        totalFotos++;
      }
    }
    if (files['fotos_incidente']) {
      for (const file of files['fotos_incidente']) {
        await insertFoto(file, 'incidente');
        totalFotos++;
      }
    }

    // Confirmamos la transacción
    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Bitácora registrada',
      bitacoraId: bitacoraId,
      fotosGuardadas: totalFotos
    });

  } catch (error: any) {
    // Si falla, deshacemos la transacción en la DB
    await client.query('ROLLBACK');
    console.error('Error insertando la bitácora:', error);
    return res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  } finally {
    // Liberamos el cliente devuelta al Pool
    client.release();
  }
});
// -------------------------------------------------------------
// ENDPOINT: GET /v1/bitacora
// -------------------------------------------------------------
app.get('/v1/bitacora', requireAuth, async (req: Request, res: Response) => {
  const client = await pool.connect();

  try {
    // Optionally filter by userId: const userId = (req as any).user.sub;
    // Realizar un query haciendo JOIN a las otras tablas o usar consultas separadas
    const result = await client.query(`
      SELECT b.*, 
             COALESCE(
               json_agg(DISTINCT be.*) FILTER (WHERE be.id IS NOT NULL), 
               '[]'
             ) as eventos,
             COALESCE(
               json_agg(DISTINCT bf.*) FILTER (WHERE bf.id IS NOT NULL), 
               '[]'
             ) as fotos
      FROM bitacora b
      LEFT JOIN bitacora_eventos be ON b.id = be.bitacora_id
      LEFT JOIN bitacora_fotos bf ON b.id = bf.bitacora_id
      GROUP BY b.id
      ORDER BY b.created_at DESC
    `);

    const bitacoras = result.rows;

    // Generar URLs prefirmadas si se usa S3
    if (STORAGE_TYPE === 's3' && s3Client) {
      for (const b of bitacoras) {
        if (b.fotos && b.fotos.length > 0) {
          for (const f of b.fotos) {
            // Si la ruta empieza con '/uploads/' (archivo local) o 'http' (URL pública antigua), no la firmes
            if (!f.url_path.startsWith('/uploads/') && !f.url_path.startsWith('http')) {
              try {
                // f.url_path guarda el 'key' del objeto en el bucket S3
                const command = new GetObjectCommand({
                  Bucket: process.env.S3_BUCKET_NAME!,
                  Key: f.url_path
                });
                // Generar URL prefirmada válida por 1 hora (3600 segundos)
                f.url_path = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
              } catch (err) {
                console.error(`Error generando URL prefirmada para el archivo ${f.url_path}:`, err);
              }
            }
          }
        }
      }
    }

    return res.status(200).json({ success: true, data: bitacoras });
  } catch (error: any) {
    console.error('Error obteniendo bitácoras:', error);
    return res.status(500).json({ error: 'Error del servidor', details: error.message });
  } finally {
    client.release();
  }
});

// -------------------------------------------------------------
// ENDPOINT: PUT /v1/bitacora/:id
// -------------------------------------------------------------
app.put('/v1/bitacora/:id', requireAuth, async (req: Request, res: Response) => {
  const client = await pool.connect();
  const { id } = req.params;

  try {
    const rawData = req.body;
    if (!rawData) {
      return res.status(400).json({ error: 'No hay datos para actualizar' });
    }

    await client.query('BEGIN');

    // Mapeo #1: Actualizar "bitacora"
    await client.query(`
      UPDATE bitacora 
      SET fecha = $1, horas_hombre = $2, resumen = $3, clima = $4, ubicacion = $5
      WHERE id = $6
    `, [
      rawData.fecha,
      rawData.horasHombre || rawData.horas_hombre,
      rawData.resumen,
      rawData.clima,
      rawData.ubicacion,
      id
    ]);

    // Mapeo #2: Reemplazar "bitacora_eventos" (borrar y crear)
    if (rawData.eventos !== undefined) {
      await client.query('DELETE FROM bitacora_eventos WHERE bitacora_id = $1', [id]);
      for (const evento of rawData.eventos) {
        await client.query(`
          INSERT INTO bitacora_eventos (bitacora_id, titulo, descripcion)
          VALUES ($1, $2, $3)
        `, [id, evento.titulo, evento.descripcion]);
      }
    }

    await client.query('COMMIT');
    return res.status(200).json({ success: true, message: 'Bitácora actualizada' });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error actualizando la bitácora:', error);
    return res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  } finally {
    client.release();
  }
});

// -------------------------------------------------------------
// ENDPOINT: DELETE /v1/bitacora/:id
// -------------------------------------------------------------
app.delete('/v1/bitacora/:id', requireAuth, async (req: Request, res: Response) => {
  const client = await pool.connect();
  const { id } = req.params;

  try {
    await client.query('BEGIN');

    // Recuperamos las fotos antes de borrarlas para eliminarlas del storage (S3 o Local)
    const fotosResult = await client.query('SELECT url_path FROM bitacora_fotos WHERE bitacora_id = $1', [id]);
    const fotos = fotosResult.rows;

    // Primero borramos las fotos y eventos asociados de la base de datos
    await client.query('DELETE FROM bitacora_fotos WHERE bitacora_id = $1', [id]);
    await client.query('DELETE FROM bitacora_eventos WHERE bitacora_id = $1', [id]);

    // Luego borramos el registro principal
    await client.query('DELETE FROM bitacora WHERE id = $1', [id]);

    await client.query('COMMIT');

    // Proceso asíncrono en background para borrar los archivos físicos del bucket S3 o disco local
    for (const foto of fotos) {
      const urlPath = foto.url_path;
      if (!urlPath) continue;

      if (urlPath.startsWith('/uploads/')) {
        // Es un archivo local, borrar del disco
        const localPath = path.join(__dirname, '..', urlPath);
        fs.unlink(localPath, (err) => {
          if (err) console.error(`No se pudo borrar archivo local ${localPath}:`, err.message);
        });
      } else if (!urlPath.startsWith('http')) {
        // Es una llave de S3 (ej. uploads/archivo.jpg)
        if (STORAGE_TYPE === 's3' && s3Client) {
          try {
            const command = new DeleteObjectCommand({
              Bucket: process.env.S3_BUCKET_NAME!,
              Key: urlPath
            });
            await s3Client.send(command);
            console.log(`Eliminado de S3: ${urlPath}`);
          } catch (err: any) {
            console.error(`Error borrando archivo S3 ${urlPath}:`, err.message);
          }
        }
      }
    }

    return res.status(200).json({ success: true, message: 'Bitácora eliminada' });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error eliminando la bitácora:', error);
    return res.status(500).json({ error: 'Error del servidor', details: error.message });
  } finally {
    client.release();
  }
});

if (STORAGE_TYPE === 'local') {
  app.use('/uploads', express.static(UPLOADS_DIR));
}

// Configurar todas las rutas adicionales
setupRoutes(app, pool, io, upload, getFileUrl);

httpServer.listen(PORT as number, '0.0.0.0', () => {
  console.log('==============================================');
  console.log(`🚀 SERVIDOR BACKEND INICIADO`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`==============================================`);
});
