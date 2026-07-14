import { useEffect, useState } from 'react';
import { api } from '@/api';
import { useProject } from '@/contexts/ProjectContext';

interface Plano {
  id: string;
  project_id: string;
  summary: string;
  objectives: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
  created_at: string;
  updated_at: string;
}

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, DollarSign } from 'lucide-react';

export function PlanosList() {
  const { project } = useProject();
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (project) {
      fetchPlanos();
    }
  }, [project]);

  const fetchPlanos = async () => {
    if (!project) return;

    try {
      setLoading(true);
      const { data } = await api.get(`/planos?project_id=${project.id}`);
      setPlanos(data || []);
    } catch (error) {
      console.error('Error fetching planos:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!project) {
    return (
      <div className="flex h-64 w-full items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-8 text-center bg-gray-50/50">
        <p className="text-gray-500">Por favor, selecciona un proyecto primero.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Cargando planos...</div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Planos</h2>
          <p className="text-muted-foreground">Gestión de planos para {project.name}</p>
        </div>
        {/* Potentially add a 'New Plano' button here */}
      </div>

      {planos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border rounded-xl bg-gray-50/50 dashed">
          <p className="text-muted-foreground">No hay planos registrados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {planos.map((plano) => (
            <Card key={plano.id} className="transition-all hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-4">
                  <CardTitle className="line-clamp-1 text-lg">{plano.summary}</CardTitle>
                  <Badge variant={plano.status === 'En Proceso' ? 'default' : 'secondary'}>
                    {plano.status}
                  </Badge>
                </div>
                <CardDescription className="line-clamp-2 min-h-[40px]">
                  {plano.objectives}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="flex items-center text-sm text-gray-500 gap-2">
                  <CalendarDays className="h-4 w-4" />
                  <span>
                    {plano.start_date ? new Date(plano.start_date).toLocaleDateString() : 'N/A'} - {plano.end_date ? new Date(plano.end_date).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center text-sm font-medium text-gray-900 gap-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span>${(plano.budget ?? 0).toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}