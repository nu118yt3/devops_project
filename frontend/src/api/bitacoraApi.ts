import supabase from "../utils/supabase";

/**
 * URL base del backend REST propio. 
 * Idealmente definido en una variable de entorno como VITE_API_URL.
 */
//const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/v1';
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://erp-backend-2msi.onrender.com';

/**
 * Interfaz que define la estructura recomendada para el payload
 * (antes de enviarlo como multipart/form-data si se incluyen imágenes)
 */
export interface BitacoraRegistroPayload {
  fecha: string; // ISO string o YYYY-MM-DD
  horasHombre: number;
  resumen: string;
  clima: string;
  ubicacion: string;
  eventos: Array<{
    titulo: string;
    descripcion: string;
  }>;
  proyecto_id?: string;
  proyecto_nombre?: string;
}

export interface BitacoraRegistro {
  id: string;
  fecha: string;
  horas_hombre: string | number;
  resumen: string;
  clima: string;
  ubicacion: string;
  created_at: string;
  eventos: Array<{ id: string; titulo: string; descripcion: string; created_at: string; }>;
  proyecto_id?: string;
  proyecto_nombre?: string;
  fotos: Array<{ id: string; url_path: string; size: number; mime_type: string; created_at: string; tipo: string; }>;
}


/**
 * Estructura de la API para bitácora
 */
export const bitacoraApi = {
  /**
   * Envía un nuevo registro de bitácora junto con sus fotos
   * @param payload Datos estructurados de la bitácora
   * @param fotosTarea Arreglo de archivos de la tarea del día
   * @param fotosIncidente Arreglo de archivos de los incidentes
   * @returns Promesa con la respuesta del servidor
   */
  async crearRegistro(payload: BitacoraRegistroPayload, fotosTarea: File[], fotosIncidente: File[]): Promise<unknown> {
    try {
      // 1. Extraer el JWT de la sesión de Supabase actual de forma segura.
      // Así garantizamos que NO interfiere con la sesión principal, solo tomamos el token.
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        throw new Error('No hay una sesión activa. Por favor, inicia sesión de nuevo.');
      }

      const jwtToken = sessionData.session.access_token;

      // 2. Preparar el multipart/form-data
      const formData = new FormData();

      // Enviamos el payload como un JSON en un campo del form, 
      // o desglosado en campos individuales. Aquí lo enviamos serializado.
      // (Dependerá de cómo lo parsees en el backend; lo más común es mandar JSON y archivos)
      formData.append('data', JSON.stringify(payload));

      // Adjuntar archivos fotográficos clasificados
      fotosTarea.forEach((foto) => {
        formData.append('fotos_tarea', foto);
      });
      fotosIncidente.forEach((foto) => {
        formData.append('fotos_incidente', foto);
      });

      // 3. Petición POST al backend propio
      const response = await fetch(`${API_BASE_URL}/v1/bitacora`, {
        method: 'POST',
        headers: {
          // IMPORTANT: El Authorization Bearer token usa explícitamente el JWT
          'Authorization': `Bearer ${jwtToken}`,
          // Nota: No poner 'Content-Type': 'multipart/form-data' aquí,
          // fetch generará automáticamente los boundaries correctos.
        },
        body: formData,
      });

      if (!response.ok) {
        // Si hay error en la petición se puede extraer detalle
        const errorMessage = await response.text();
        throw new Error(`Error ${response.status}: ${errorMessage}`);
      }

      // Estructura de respuesta exitosa del backend
      const result = await response.json();
      return result;

    } catch (error) {
      console.error('Error al enviar la bitácora:', error);
      throw error; // Re-lanzar para manejar el UI error state (Toast, etc)
    }
  },

  /**
   * Obtiene todos los registros históricos de bitácora
   */
  async obtenerRegistros(): Promise<BitacoraRegistro[]> {
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        throw new Error('No hay sesión activa.');
      }

      const jwtToken = sessionData.session.access_token;

      const response = await fetch(`${API_BASE_URL}/v1/bitacora`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const result = await response.json();
      return result.data as BitacoraRegistro[];
    } catch (error) {
      console.error('Error al obtener el historial:', error);
      throw error;
    }
  },

  /**
   * Actualiza un registro de bitácora existente
   */
  async editarRegistro(id: string, payload: Partial<BitacoraRegistroPayload>): Promise<unknown> {
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        throw new Error('No hay sesión activa.');
      }

      const jwtToken = sessionData.session.access_token;

      const response = await fetch(`${API_BASE_URL}/v1/bitacora/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorMessage = await response.text();
        throw new Error(`Error ${response.status}: ${errorMessage}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error al editar el registro:', error);
      throw error;
    }
  },

  /**
   * Elimina un registro de bitácora
   */
  async eliminarRegistro(id: string): Promise<unknown> {
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        throw new Error('No hay sesión activa.');
      }

      const jwtToken = sessionData.session.access_token;

      const response = await fetch(`${API_BASE_URL}/v1/bitacora/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${jwtToken}`
        }
      });

      if (!response.ok) {
        const errorMessage = await response.text();
        throw new Error(`Error ${response.status}: ${errorMessage}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error al eliminar el registro:', error);
      throw error;
    }
  }
};

/**
 * -------------------------------------------------------------
 * RECOMENDACIONES DE ARQUITECTURA PARA EL BACKEND PROPIO (Node/Express)
 * -------------------------------------------------------------
 * 
 * 1. Endpoint: POST /v1/bitacora
 * 
 * 2. Middlware:
 *    - AuthMiddleware: Validar Authorization header con JWT. 
 *      Usar librería externa para verificar JWT de Supabase o hacerlo vía JWKS.
 *    - UploadMiddleware: (ej: Multer). `upload.array('photos', 10)` (max 10 fotos).
 * 
 * 3. Base de Datos (Mapeo Sugerido):
 *    - Tabla `bitacora`: id, fecha, horas_hombre, resumen, clima, ubicacion, created_by (userId del JWT).
 *    - Tabla `bitacora_eventos`: id, bitacora_id, titulo, descripcion.
 *    - Tabla `bitacora_fotos`: id, bitacora_id, s3_url / path, size, mime_type.
 * 
 * 4. Manejo de Archivos:
 *    - El backend recibe las fotos como Streams. Subir directamente a 
 *      AWS S3 / GCS / Local Storage ANTES de responder 200 OK.
 * 
 * 5. Compresión:
 *    - Si requieres comprimir las imágenes en la app, usar browser-image-compression
 *      en React antes de mandarlas, o usar un worker / microservicio en backend.
 */
