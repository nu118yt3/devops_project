import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Loader2, AlertTriangle, Camera, Trash2, Edit2, X, Save, Plus } from 'lucide-react';
import { bitacoraApi, type BitacoraRegistro } from '../../../api/bitacoraApi';
import { toast } from 'sonner';
import { useAuth } from '../../../contexts/AuthContext';
import { useForm, useFieldArray } from 'react-hook-form';

export default function BitacoraHistorial() {
  const { user } = useAuth();
  const [registros, setRegistros] = useState<BitacoraRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRecord, setEditingRecord] = useState<BitacoraRegistro | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await bitacoraApi.obtenerRegistros();
      setRegistros(data);
    } catch (error) {
      toast.error('No se pudo cargar el historial');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este registro? Se eliminarán también las fotos asociadas.')) return;
    try {
      await bitacoraApi.eliminarRegistro(id);
      toast.success('Registro eliminado con éxito');
      setRegistros(prev => prev.filter(r => r.id !== id));
    } catch (error) {
      toast.error('No se pudo eliminar el registro');
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-500">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-green-600" />
        <p>Cargando historial de bitácora...</p>
      </div>
    );
  }

  if (registros.length === 0) {
    return (
      <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
        <AlertTriangle className="w-10 h-10 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-800">No hay registros aún</h3>
        <p className="text-gray-500 mt-2">Empieza capturando tu primer reporte de avance de obra.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {registros.map((registro) => (
        <div key={registro.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 lg:p-8 relative group">
          
          <div className="absolute top-4 right-4 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setEditingRecord(registro)}
              className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              title="Editar"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDelete(registro.id)}
              className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
              title="Eliminar"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col md:flex-row justify-between mb-4 border-b border-gray-50 pb-4 pr-24 md:pr-20">
            <div>
              <h3 className="text-lg md:text-xl font-bold text-gray-800 flex flex-wrap items-center gap-2 md:gap-3">
                {format(new Date(registro.fecha), 'dd/MM/yyyy')}
                {registro.proyecto_nombre && (
                  <span className="text-xs md:text-sm px-2.5 py-0.5 bg-green-100 text-green-800 rounded-md font-medium border border-green-200">
                    {registro.proyecto_nombre}
                  </span>
                )}
              </h3>
              <p className="text-sm text-gray-500 flex flex-wrap items-center gap-2 mt-1">
                <span className="font-medium text-gray-700">📍 {registro.ubicacion}</span>
                <span className="text-gray-300">|</span>
                <span>⏱ {registro.horas_hombre} hrs hombre</span>
                <span className="text-gray-300">|</span>
                <span className="capitalize">🌤 {registro.clima}</span>
              </p>
            </div>
            <div className="text-left md:text-right mt-3 md:mt-0">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Responsable / Doc</span>
              <p className="text-sm font-medium text-gray-800 mt-1 capitalize">
                {(user as any)?.user_metadata?.name || user?.email || 'Desconocido'}
              </p>
              <p className="text-xs text-gray-400 font-mono mt-0.5">ID: {registro.id.substring(0, 8)}</p>
            </div>
          </div>

          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Resumen de Actividades</h4>
            <p className="text-gray-600 bg-gray-50/50 p-4 rounded-xl text-sm leading-relaxed border border-gray-100 whitespace-pre-wrap">
              {registro.resumen}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {registro.eventos && registro.eventos.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> Eventos / Incidencias
                </h4>
                <div className="space-y-3">
                  {registro.eventos.map(ev => (
                    <div key={ev.id} className="bg-amber-50/50 border border-amber-100 p-3 rounded-lg">
                      <p className="font-semibold text-gray-800 text-sm">{ev.titulo}</p>
                      <p className="text-xs text-gray-600 mt-1">{ev.descripcion}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {registro.fotos && registro.fotos.length > 0 && (
              <div className="space-y-4">
                {/* Evidencia Tarea */}
                {registro.fotos.filter(f => f.tipo !== 'incidente').length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <Camera className="w-4 h-4 text-green-600" /> Tarea del Día ({registro.fotos.filter(f => f.tipo !== 'incidente').length})
                    </h4>
                    <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                      {registro.fotos.filter(f => f.tipo !== 'incidente').map(foto => {
                        const cleanUrl = foto.url_path.startsWith('http') 
                          ? foto.url_path 
                          : encodeURI(`http://localhost:3001${foto.url_path.startsWith('/') ? '' : '/'}${foto.url_path}`);
                        return (
                          <button key={foto.id} type="button" onClick={() => window.open(cleanUrl, '_blank')} className="flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden border border-gray-200 shadow-sm relative group bg-black cursor-pointer">
                            <img src={cleanUrl} alt="Evidencia" className="w-full h-full object-cover group-hover:opacity-80 transition-opacity" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* Evidencia Incidentes */}
                {registro.fotos.filter(f => f.tipo === 'incidente').length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-amber-700 mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" /> Incidentes ({registro.fotos.filter(f => f.tipo === 'incidente').length})
                    </h4>
                    <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                      {registro.fotos.filter(f => f.tipo === 'incidente').map(foto => {
                        const cleanUrl = foto.url_path.startsWith('http') 
                          ? foto.url_path 
                          : encodeURI(`http://localhost:3001${foto.url_path.startsWith('/') ? '' : '/'}${foto.url_path}`);
                        return (
                          <button key={foto.id} type="button" onClick={() => window.open(cleanUrl, '_blank')} className="flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden border border-gray-200 shadow-sm relative group bg-black cursor-pointer">
                            <img src={cleanUrl} alt="Evidencia" className="w-full h-full object-cover group-hover:opacity-80 transition-opacity" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ))}

      {editingRecord && (
        <EditModal 
          registro={editingRecord} 
          onClose={() => setEditingRecord(null)} 
          onSaved={() => {
            setEditingRecord(null);
            loadData();
          }} 
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Componente de Edición
// -------------------------------------------------------------
function EditModal({ registro, onClose, onSaved }: { registro: BitacoraRegistro, onClose: () => void, onSaved: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  type EditFormValues = {
    fecha: string;
    horasHombre: number;
    resumen: string;
    clima: string;
    ubicacion: string;
    eventos: { id?: string; titulo: string; descripcion: string; created_at?: string; }[];
  };

  const { register, control, handleSubmit } = useForm<EditFormValues>({
    defaultValues: {
      fecha: registro.fecha.split('T')[0],
      horasHombre: Number(registro.horas_hombre),
      resumen: registro.resumen,
      clima: registro.clima,
      ubicacion: registro.ubicacion,
      eventos: registro.eventos || []
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'eventos'
  });

  const onSubmit = async (data: any) => {
    try {
      setIsSubmitting(true);
      await bitacoraApi.editarRegistro(registro.id, data);
      toast.success('Registro actualizado exitosamente');
      onSaved();
    } catch (error) {
      toast.error('Error al actualizar el registro');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800">Editar Bitácora</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <form id="edit-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Fecha</label>
                <input type="date" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2" {...register('fecha')} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Horas Hombre</label>
                <input type="number" step="0.1" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2" {...register('horasHombre', { valueAsNumber: true })} />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Ubicación</label>
              <input type="text" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2" {...register('ubicacion')} />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Clima</label>
              <select className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2" {...register('clima')}>
                <option value="soleado">Soleado</option>
                <option value="nublado">Nublado</option>
                <option value="lluvioso">Lluvioso</option>
                <option value="viento">Mucho Viento</option>
                <option value="nieve">Nieve/Hielo</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Resumen</label>
              <textarea rows={4} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 resize-y" {...register('resumen')} />
            </div>

            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">Eventos / Incidencias</h3>
              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.id} className="relative bg-amber-50 border border-amber-100 p-3 rounded-lg pr-10">
                    <input type="text" placeholder="Título" className="w-full bg-transparent border-none font-semibold text-gray-800 p-0 mb-1 focus:ring-0" {...register(`eventos.${index}.titulo`)} />
                    <input type="text" placeholder="Descripción" className="w-full bg-transparent border-none text-sm text-gray-600 p-0 focus:ring-0" {...register(`eventos.${index}.descripcion`)} />
                    <button type="button" onClick={() => remove(index)} className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => append({ titulo: '', descripcion: '' })} className="mt-3 w-full flex justify-center items-center gap-2 py-2 border border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">
                <Plus className="w-4 h-4" /> Agregar Evento
              </button>
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 font-medium">
            Cancelar
          </button>
          <button type="submit" form="edit-form" disabled={isSubmitting} className="px-5 py-2.5 text-white bg-green-600 rounded-xl hover:bg-green-700 font-medium flex items-center gap-2 disabled:opacity-70">
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
}
