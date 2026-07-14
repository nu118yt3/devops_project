import React, { useState, useRef, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Calendar,
  UploadCloud,
  Camera,
  X,
  Plus,
  AlertTriangle,
  Save,
  Trash2,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

import { toast } from 'sonner';
import { bitacoraApi } from '../../../api/bitacoraApi';
import { format } from 'date-fns';
import BitacoraHistorial from './BitacoraHistorial';
import { useProject } from '../../../contexts/ProjectContext';

// ----------------------------------------------------------------------
// ESQUEMA DE VALIDACIÓN ZOD
// ----------------------------------------------------------------------
const bitacoraSchema = z.object({
  fecha: z.string({ message: 'La fecha es obligatoria.' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato inválido. Usa YYYY-MM-DD'),
  horasHombre: z.number({ error: 'Debe ser un número' }).min(0, 'Las horas no pueden ser negativas.'),
  resumen: z.string().min(10, 'El resumen debe tener al menos 10 caracteres.'),
  clima: z.string().min(1, 'Selecciona el clima.'),
  ubicacion: z.string().min(2, 'Especifica la ubicación o frente de trabajo.'),
  eventos: z.array(
    z.object({
      titulo: z.string().min(2, 'El título del evento es requerido'),
      descripcion: z.string().min(5, 'Describe brevemente la incidencia')
    })
  )
});

type BitacoraFormValues = z.infer<typeof bitacoraSchema>;

// ----------------------------------------------------------------------
// COMPONENTE: MODAL DE CÁMARA NATIVA (navigator.mediaDevices)
// ----------------------------------------------------------------------
function CameraCaptureModal({
  onCapture,
  onClose
}: {
  onCapture: (file: File) => void,
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function startCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' } // Preferir cámara trasera siempre que sea posible
        });
        streamRef.current = mediaStream;
        setIsReady(true);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          // Prevenir pausas indeseadas en iOS
          videoRef.current.setAttribute('playsinline', 'true');
        }
      } catch (err) {
        console.error("Error accediendo a la cámara:", err);
        setError("No se pudo acceder a la cámara. Revisa los permisos.");
      }
    }
    startCamera();

    return () => {
      // Limpieza: Detener los tracks de la cámara al desmontar
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []); // Solo al montar

  const handleCapture = () => {
    if (!videoRef.current || !streamRef.current) return;

    const canvas = document.createElement('canvas');
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Opcional: COMPRESIÓN BÁSICA usando toBlob con calidad 0.8
      canvas.toBlob((blob) => {
        if (blob) {
          const fileName = `captura_${format(new Date(), 'yyyyMMdd_HHmmss')}.jpg`;
          const file = new File([blob], fileName, { type: 'image/jpeg' });
          onCapture(file);
          onClose(); // Cerrar tras capturar exitosamente
        }
      }, 'image/jpeg', 0.8);
    }
  };

  // Detener todo al cerrar
  const handleClose = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-gray-900 rounded-2xl overflow-hidden shadow-2xl">
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="p-2 bg-black/50 text-white rounded-full hover:bg-black/80 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {error ? (
          <div className="p-8 text-center text-red-400 min-h-[300px] flex flex-col items-center justify-center">
            <AlertTriangle className="w-12 h-12 mb-4 mx-auto opacity-80" />
            <p className="mb-4">{error}</p>
            <button onClick={handleClose} className="px-4 py-2 bg-white/10 rounded-lg text-white hover:bg-white/20">Cerrar</button>
          </div>
        ) : (
          <>
            <div className="relative aspect-[3/4] sm:aspect-video w-full bg-black flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
              />
              {!isReady && (
                <div className="absolute text-white/50 flex flex-col items-center">
                  <Loader2 className="w-8 h-8 animate-spin mb-2" />
                  <p>Iniciando cámara...</p>
                </div>
              )}
            </div>

            <div className="p-6 bg-gray-900 flex justify-center">
              <button
                type="button"
                onClick={handleCapture}
                disabled={!isReady}
                className="w-16 h-16 bg-white rounded-full border-4 border-gray-900 ring-4 ring-white shadow-lg active:scale-95 transition-transform disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center group"
                aria-label="Tomar foto"
              >
                <div className="w-12 h-12 rounded-full border-2 border-transparent group-hover:border-gray-200" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// PRINCIPAL: COMPONENTE BITACORA DE OBRA
// ----------------------------------------------------------------------
export default function BitacoraForm() {
  const { project } = useProject();
  const [activeTab, setActiveTab] = useState<'capturar' | 'historial'>('capturar');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fotosTarea, setFotosTarea] = useState<{ file: File, preview: string }[]>([]);
  const [fotosIncidente, setFotosIncidente] = useState<{ file: File, preview: string }[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<'tarea' | 'incidente'>('tarea');
  const fileInputTareaRef = useRef<HTMLInputElement>(null);
  const fileInputIncidenteRef = useRef<HTMLInputElement>(null);

  // Inicialización de React Hook Form
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<BitacoraFormValues>({
    resolver: zodResolver(bitacoraSchema),
    defaultValues: {
      fecha: format(new Date(), 'yyyy-MM-dd'),
      horasHombre: 0,
      resumen: '',
      clima: '',
      ubicacion: '',
      eventos: []
    }
  });

  const { fields: eventosFields, append: appendEvento, remove: removeEvento } = useFieldArray({
    control,
    name: 'eventos'
  });

  // --- MÉTODOS DE FOTOS ---
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>, tipo: 'tarea' | 'incidente') => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      const newPhotos = newFiles.map(file => ({
        file,
        preview: URL.createObjectURL(file)
      }));
      if (tipo === 'tarea') {
        setFotosTarea(prev => [...prev, ...newPhotos]);
      } else {
        setFotosIncidente(prev => [...prev, ...newPhotos]);
      }
    }
    const inputRef = tipo === 'tarea' ? fileInputTareaRef : fileInputIncidenteRef;
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleCameraCapture = (file: File) => {
    const preview = URL.createObjectURL(file);
    if (cameraTarget === 'tarea') {
      setFotosTarea(prev => [...prev, { file, preview }]);
    } else {
      setFotosIncidente(prev => [...prev, { file, preview }]);
    }
  };

  const removePhoto = (indexToRemove: number, tipo: 'tarea' | 'incidente') => {
    const setter = tipo === 'tarea' ? setFotosTarea : setFotosIncidente;
    setter(prev => {
      URL.revokeObjectURL(prev[indexToRemove].preview);
      return prev.filter((_, i) => i !== indexToRemove);
    });
  };

  // Limpiar memoria cuando el componente se desmonte
  useEffect(() => {
    return () => {
      fotosTarea.forEach(p => URL.revokeObjectURL(p.preview));
      fotosIncidente.forEach(p => URL.revokeObjectURL(p.preview));
    };
  }, [fotosTarea, fotosIncidente]);

  // --- SUBMIT ---
  const onSubmit = async (data: BitacoraFormValues) => {
    try {
      setIsSubmitting(true);

      const filesTarea = fotosTarea.map(p => p.file);
      const filesIncidente = fotosIncidente.map(p => p.file);

      const payload = {
        ...data,
        proyecto_id: project?.id,
        proyecto_nombre: project?.name
      };

      await bitacoraApi.crearRegistro(payload, filesTarea, filesIncidente);

      toast.success('Registro de bitácora guardado exitosamente');

      // Limpiar formulario y ver historial
      reset();
      setFotosTarea([]);
      setFotosIncidente([]);
      setActiveTab('historial');
    } catch (error: unknown) {
      const err = error as Error;
      toast.error(err?.message || 'Hubo un error al guardar la bitácora');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- RENDER ---
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="text-sm font-medium text-gray-500 mb-1 flex items-center gap-2">
            Obra <span className="opacity-50">›</span> Control de Obra <span className="opacity-50">›</span> <span className="text-green-700 font-semibold">Bitácora</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Bitácora de Obra</h1>
          <p className="text-gray-500 mt-1">Registro diario de avances, eventos y condiciones del sitio.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 print:hidden w-full md:w-auto mt-4 md:mt-0">
          <div className="bg-gray-100 p-1 rounded-xl flex items-center justify-between sm:justify-start w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('capturar')}
              className={`flex-1 sm:flex-none px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'capturar' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                }`}
            >
              Nuevo Registro
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('historial')}
              className={`flex-1 sm:flex-none px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'historial' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                }`}
            >
              Historial
            </button>
          </div>


          {activeTab === 'capturar' && (
            <button
              type="button"
              onClick={() => document.getElementById('bitacora-form')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))}
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-xl flex justify-center items-center gap-2 font-medium transition-all shadow-md shadow-green-700/20 focus:ring-4 focus:ring-green-700/30 outline-none disabled:opacity-70 w-full sm:w-auto"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Guardar Registro
            </button>
          )}
        </div>
      </div>

      {activeTab === 'capturar' ? (
        <form id="bitacora-form" onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">

          {/* COLUMNA PRINCIPAL (FORMULARIO) */}
          <div className="lg:col-span-2 space-y-6">

            {/* SECCIÓN: PROGRESO DEL DÍA */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden p-6 sm:p-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center gap-2 border-b border-gray-100 pb-4">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                Progreso del Día
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* FECHA */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Fecha <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <Calendar className="w-5 h-5 text-gray-400" />
                    </div>
                    <input
                      type="date"
                      className="w-full bg-gray-50/50 border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-colors text-gray-700"
                      {...register('fecha')}
                    />
                  </div>
                  {errors.fecha && <span className="text-xs text-red-500 font-medium">{errors.fecha.message}</span>}
                </div>

                {/* HORAS HOMBRE */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Horas Hombre</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      className="w-full bg-gray-50/50 border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-colors text-gray-700 pr-12"
                      {...register('horasHombre', { valueAsNumber: true })}
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-gray-400 font-medium">
                      hrs
                    </div>
                  </div>
                  {errors.horasHombre && <span className="text-xs text-red-500 font-medium">{errors.horasHombre.message}</span>}
                </div>
              </div>

              {/* RESUMEN */}
              <div className="space-y-2 mb-6">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Resumen del Día <span className="text-red-500">*</span></label>
                <textarea
                  rows={5}
                  placeholder="Describa las actividades relevantes, avance logrado, etc..."
                  className="w-full bg-gray-50/50 border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-colors text-gray-700 resize-y"
                  {...register('resumen')}
                />
                {errors.resumen && <span className="text-xs text-red-500 font-medium">{errors.resumen.message}</span>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* CLIMA */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Clima <span className="text-red-500">*</span></label>
                  <select
                    className="w-full bg-gray-50/50 border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-colors text-gray-700 appearance-none"
                    {...register('clima')}
                  >
                    <option value="">Selecciona una opción</option>
                    <option value="soleado">Soleado</option>
                    <option value="nublado">Nublado</option>
                    <option value="lluvioso">Lluvioso</option>
                    <option value="viento">Mucho Viento</option>
                    <option value="nieve">Nieve/Hielo</option>
                  </select>
                  {errors.clima && <span className="text-xs text-red-500 font-medium">{errors.clima.message}</span>}
                </div>

                {/* UBICACIÓN */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Ubicación / Frente <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    placeholder="Ej. Torre A - Nivel 4"
                    className="w-full bg-gray-50/50 border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-colors text-gray-700"
                    {...register('ubicacion')}
                  />
                  {errors.ubicacion && <span className="text-xs text-red-500 font-medium">{errors.ubicacion.message}</span>}
                </div>
              </div>
            </div>

            {/* SECCIÓN: EVENTOS E INCIDENCIAS */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden p-6 sm:p-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center gap-2 border-b border-gray-100 pb-4">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                Eventos Importantes e Incidencias
              </h2>

              {eventosFields.length > 0 && (
                <div className="space-y-4 mb-6">
                  {eventosFields.map((field, index) => (
                    <div key={field.id} className="relative bg-amber-50/50 border border-amber-100 p-4 rounded-xl group transition-all hover:bg-amber-50">
                      <button
                        type="button"
                        onClick={() => removeEvento(index)}
                        className="absolute top-2 right-2 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all focus:opacity-100 outline-none"
                        title="Eliminar incidencia"
                      >
                        <X className="w-4 h-4" />
                      </button>

                      <div className="flex gap-3">
                        <div className="flex-shrink-0 mt-1 pl-1">
                          <AlertTriangle className="w-5 h-5 text-amber-600/70" />
                        </div>
                        <div className="flex-1 space-y-3">
                          <div>
                            <input
                              type="text"
                              placeholder="Título (ej. Retraso en suministro)"
                              className="w-full bg-transparent border-none font-semibold text-gray-800 focus:ring-0 p-0 placeholder-gray-400"
                              {...register(`eventos.${index}.titulo` as const)}
                            />
                            {errors.eventos?.[index]?.titulo && (
                              <span className="text-xs text-red-500">{errors.eventos[index]?.titulo?.message}</span>
                            )}
                          </div>
                          <div>
                            <input
                              type="text"
                              placeholder="Breve descripción del motivo o impacto..."
                              className="w-full bg-transparent border-none text-sm text-gray-600 focus:ring-0 p-0 placeholder-gray-400"
                              {...register(`eventos.${index}.descripcion` as const)}
                            />
                            {errors.eventos?.[index]?.descripcion && (
                              <span className="text-xs text-red-500">{errors.eventos[index]?.descripcion?.message}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => appendEvento({ titulo: '', descripcion: '' })}
                className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-colors font-medium outline-none focus:ring-2 focus:ring-gray-200 focus:ring-offset-2 mb-8"
              >
                <Plus className="w-4 h-4" />
                Agregar Incidencia o Evento
              </button>

              {/* SECCIÓN INCIDENTES FOTOS (Movido aquí) */}
              <div className="border-t border-gray-100 pt-6">
                <h3 className="text-sm font-semibold text-amber-700 mb-3 uppercase tracking-wider">🚨 Evidencia de Incidentes</h3>
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                  <button type="button" onClick={() => fileInputIncidenteRef.current?.click()} className="w-full sm:flex-1 bg-amber-50 hover:bg-amber-100 text-amber-700 py-2.5 px-4 rounded-xl text-sm font-medium flex justify-center items-center gap-2 transition-all">
                    <UploadCloud className="w-4 h-4" /> Subir Fotos
                  </button>
                  <input ref={fileInputIncidenteRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => handlePhotoSelect(e, 'incidente')} />
                  <button type="button" onClick={() => { setCameraTarget('incidente'); setShowCamera(true); }} className="w-full sm:flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 px-4 rounded-xl text-sm font-medium flex justify-center items-center gap-2 transition-all">
                    <Camera className="w-4 h-4" /> Tomar Foto
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {fotosIncidente.map((photo, i) => (
                    <div key={i} className="relative group aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shadow-sm">
                      <img src={photo.preview} alt="Preview Incidente" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removePhoto(i, 'incidente')} className="absolute top-2 right-2 p-1.5 bg-red-500/90 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                  {fotosIncidente.length === 0 && (
                    <div className="col-span-2 sm:col-span-4 aspect-[4/1] rounded-xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50">
                      <span className="text-xs font-medium">Sin evidencia de incidentes</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA (FOTOS) */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 sticky top-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center gap-2 border-b border-gray-100 pb-4">
                <Camera className="w-5 h-5 text-green-700" />
                Evidencia Fotográfica
              </h2>

              {/* SECCIÓN TAREA */}
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">📸 Tarea del Día</h3>
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                  <button type="button" onClick={() => fileInputTareaRef.current?.click()} className="w-full sm:flex-1 bg-green-50 hover:bg-green-100 text-green-700 py-2.5 px-4 rounded-xl text-sm font-medium flex justify-center items-center gap-2 transition-all">
                    <UploadCloud className="w-4 h-4" /> Subir
                  </button>
                  <input ref={fileInputTareaRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => handlePhotoSelect(e, 'tarea')} />
                  <button type="button" onClick={() => { setCameraTarget('tarea'); setShowCamera(true); }} className="w-full sm:flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 px-4 rounded-xl text-sm font-medium flex justify-center items-center gap-2 transition-all">
                    <Camera className="w-4 h-4" /> Tomar
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {fotosTarea.map((photo, i) => (
                    <div key={i} className="relative group aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shadow-sm">
                      <img src={photo.preview} alt="Preview Tarea" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removePhoto(i, 'tarea')} className="absolute top-2 right-2 p-1.5 bg-red-500/90 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                  {fotosTarea.length === 0 && (
                    <div className="col-span-2 aspect-[3/1] rounded-xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50">
                      <span className="text-xs font-medium">Sin evidencia de tarea</span>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </form>
      ) : (
        <div className="animate-in fade-in duration-300">
          <BitacoraHistorial />
        </div>
      )}

      {/* Modal de Cámara */}
      {showCamera && (
        <CameraCaptureModal
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}
