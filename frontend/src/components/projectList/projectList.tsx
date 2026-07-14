import {
  useEffect,
  useState,
  useCallback,
  useRef,
  useLayoutEffect,
  useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  Pencil,
  Trash2,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Calendar,
  LogOut,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import supabase from "@/utils/supabase";
import { useProject } from "@/contexts/ProjectContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Spinner } from "../ui/spinner";
import { useAuth } from "@/contexts/AuthContext";

// --- TIPOS ---
interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

interface UserRole {
  role: string | null;
  avatar_url: string;
}

type DateFilterType = "all" | "newest" | "oldest" | "year" | "month" | "range";

export function ProjectList() {
  // --- ESTADOS ---
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  // Estados para borrar
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Estados para crear
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
  });
  const [createFormErrors, setCreateFormErrors] = useState({
    name: "",
    description: "",
  });

  // Estados para editar
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [editProject, setEditProject] = useState({
    name: "",
    description: "",
  });
  const [editFormErrors, setEditFormErrors] = useState({
    name: "",
    description: "",
  });

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Estados de filtros
  const [dateFilter, setDateFilter] = useState<DateFilterType>("all");
  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear()
  );
  const [selectedMonth, setSelectedMonth] = useState<number>(
    new Date().getMonth() + 1
  );
  const [filterMonthWithYear, setFilterMonthWithYear] =
    useState<boolean>(false);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);

  // --- LÓGICA DE GRID DINÁMICO (Responsive NxN) ---
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [projectsPerPage, setProjectsPerPage] = useState(12);

  const CARD_MIN_WIDTH = 300;
  const CARD_HEIGHT = 140;
  const GAP = 16;

  const { signOut } = useAuth();

  useLayoutEffect(() => {
    const calculateCapacity = () => {
      if (!gridContainerRef.current) return;

      const width = gridContainerRef.current.clientWidth;
      const height = gridContainerRef.current.clientHeight;

      const columns = Math.floor((width + GAP) / (CARD_MIN_WIDTH + GAP));
      const safeColumns = Math.max(1, columns);

      // On mobile/scrolling layouts, we don't want to limit by height
      const isMobile = window.innerWidth < 768;
      const rows = isMobile
        ? Math.ceil(12 / safeColumns)
        : Math.floor((height + GAP) / (CARD_HEIGHT + GAP));
      const safeRows = Math.max(1, rows);

      const optimalCount = safeColumns * safeRows;

      setProjectsPerPage((prev) => {
        if (prev !== optimalCount) return optimalCount;
        return prev;
      });
    };

    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(calculateCapacity);
    });

    if (gridContainerRef.current) {
      observer.observe(gridContainerRef.current);
      calculateCapacity();
    }

    return () => observer.disconnect();
  }, [loading]);

  const navigate = useNavigate();
  const { setProject } = useProject();

  // --- EFECTOS DE DATOS ---
  useEffect(() => {
    fetchUserRole();
    fetchProjects();
  }, []);

  useEffect(() => {
    filterAndSortProjects();
  }, [
    projects,
    searchTerm,
    dateFilter,
    selectedYear,
    selectedMonth,
    filterMonthWithYear,
    startDate,
    endDate,
  ]);

  useEffect(() => {
    const maxPage = Math.ceil(filteredProjects.length / projectsPerPage) || 1;
    if (currentPage > maxPage) setCurrentPage(maxPage);
  }, [projectsPerPage, filteredProjects.length]);

  // Función para obtener el rol del usuario
  const fetchUserRole = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("users")
        .select("role, avatar_url")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      setUserRole(data);
    } catch (err) {
      console.error("Error fetching user role:", err);
    }
  };

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      setProjects(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching projects");
    } finally {
      setLoading(false);
    }
  };

  // Función para eliminar proyecto
  const deleteProject = async (projectId: string) => {
    try {
      setIsDeleting(true);

      const { error } = await supabase.rpc("delete_project", {
        project_id: projectId,
      });

      if (error) throw error;

      setProjects((prev) => prev.filter((project) => project.id !== projectId));
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    } catch (err) {
      console.error("Error deleting project:", err);
      alert(err instanceof Error ? err.message : "Error al borrar el proyecto");
    } finally {
      setIsDeleting(false);
    }
  };

  // Función para crear proyecto
  const createProject = async () => {
    const errors = {
      name: "",
      description: "",
    };

    if (!newProject.name.trim()) {
      errors.name = "El nombre del proyecto es requerido";
    }

    if (newProject.name.trim().length > 100) {
      errors.name = "El nombre no puede exceder 100 caracteres";
    }

    if (newProject.description.trim().length > 500) {
      errors.description = "La descripción no puede exceder 500 caracteres";
    }

    setCreateFormErrors(errors);

    if (errors.name || errors.description) {
      return;
    }

    try {
      setIsCreating(true);

      // Solo crear el proyecto en Supabase
      const { data: projectId, error } = await supabase.rpc("create_project", {
        project_name: newProject.name.trim(),
        project_description: newProject.description.trim() || null,
      });

      if (error) throw error;

      // 🔥 ACTUALIZACIÓN CRÍTICA: CREAR EL OBJETO LOCALMENTE
      // Simplemente creamos un objeto temporal con los datos del nuevo proyecto
      const tempProject: Project = {
        id: projectId || `temp-${Date.now()}`, // Si no retorna ID, usamos temporal
        name: newProject.name.trim(),
        description: newProject.description.trim() || "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // 🔥 ACTUALIZAR EL ESTADO LOCAL INMEDIATAMENTE (sin fetchProjects)
      setProjects((prev) => {
        const updated = [...prev, tempProject];
        // Mantener orden alfabético como lo hace el backend
        return updated.sort((a, b) =>
          a.name.toLowerCase().localeCompare(b.name.toLowerCase())
        );
      });

      // Limpiar y cerrar
      setNewProject({ name: "", description: "" });
      setCreateDialogOpen(false);
      setCreateFormErrors({ name: "", description: "" });
    } catch (err) {
      console.error("Error creating project:", err);
      alert(err instanceof Error ? err.message : "Error al crear el proyecto");
    } finally {
      setIsCreating(false);
    }
  };

  // Función para editar proyecto (versión optimizada)
  const updateProject = async () => {
    if (!projectToEdit) return;

    const errors = {
      name: "",
      description: "",
    };

    if (!editProject.name.trim()) {
      errors.name = "El nombre del proyecto es requerido";
    }

    if (editProject.name.trim().length > 100) {
      errors.name = "El nombre no puede exceder 100 caracteres";
    }

    if (editProject.description.trim().length > 500) {
      errors.description = "La descripción no puede exceder 500 caracteres";
    }

    setEditFormErrors(errors);

    if (errors.name || errors.description) {
      return;
    }

    try {
      setIsEditing(true);

      const { error } = await supabase.rpc("update_project", {
        project_id: projectToEdit.id,
        project_name: editProject.name.trim(),
        project_description: editProject.description.trim() || null,
      });

      if (error) throw error;

      // 🔥 ACTUALIZACIÓN OPTIMIZADA: Solo actualizar el proyecto modificado
      setProjects((prev) =>
        prev.map((project) =>
          project.id === projectToEdit.id
            ? {
              ...project,
              name: editProject.name.trim(),
              description: editProject.description.trim() || "",
              updated_at: new Date().toISOString(), // Actualizar timestamp
            }
            : project
        )
      );

      setEditDialogOpen(false);
      setProjectToEdit(null);
      setEditFormErrors({ name: "", description: "" });
      //alert("¡Proyecto actualizado exitosamente!");
    } catch (err) {
      console.error("Error updating project:", err);
      alert(
        err instanceof Error ? err.message : "Error al actualizar el proyecto"
      );
    } finally {
      setIsEditing(false);
    }
  };

  const filterAndSortProjects = useCallback(() => {
    let result = [...projects];

    // Filtro búsqueda inteligente
    if (searchTerm) {
      result = result.filter((project) => {
        const searchLower = searchTerm.toLowerCase();
        const nameLower = project.name.toLowerCase();
        const descLower = project.description
          ? project.description.toLowerCase()
          : "";

        // Búsqueda inteligente que encuentra coincidencias parciales desde el inicio
        return (
          nameLower.includes(searchLower) ||
          descLower.includes(searchLower) ||
          nameLower.startsWith(searchLower) ||
          // Si el usuario escribe "ay" debería encontrar "ayuda", "ay*", etc.
          nameLower.split(/\s+/).some((word) => word.startsWith(searchLower))
        );
      });
    }

    // Filtro por fecha
    if (dateFilter !== "all") {
      result = result.filter((project) => {
        const projectDate = new Date(project.created_at);

        switch (dateFilter) {
          case "newest":
            return true;
          case "oldest":
            return true;
          case "year":
            return projectDate.getFullYear() === selectedYear;
          case "month":
            if (filterMonthWithYear) {
              return (
                projectDate.getFullYear() === selectedYear &&
                projectDate.getMonth() + 1 === selectedMonth
              );
            } else {
              return projectDate.getMonth() + 1 === selectedMonth;
            }
          case "range":
            if (!startDate || !endDate) return true;
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            return projectDate >= start && projectDate <= end;
          default:
            return true;
        }
      });
    }

    // Ordenamiento
    result.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();

      if (dateFilter === "newest") {
        return dateB - dateA;
      } else if (dateFilter === "oldest") {
        return dateA - dateB;
      }

      // Por defecto, orden alfabético A-Z
      return nameA.localeCompare(nameB);
    });

    setFilteredProjects(result);
  }, [
    projects,
    searchTerm,
    dateFilter,
    selectedYear,
    selectedMonth,
    filterMonthWithYear,
    startDate,
    endDate,
  ]);

  // --- LÓGICA PARA DETERMINAR SI HAY FILTROS ACTIVOS ---
  const hasActiveFilters = useMemo(() => {
    const hasSearchFilter = searchTerm.trim() !== "";
    const hasDateFilter = dateFilter !== "all";
    const hasYearFilter = dateFilter === "year";
    const hasMonthFilter = dateFilter === "month";
    const hasRangeFilter =
      dateFilter === "range" && (startDate !== "" || endDate !== "");

    const hasSortingFilter = dateFilter === "newest" || dateFilter === "oldest";

    return (
      hasSearchFilter ||
      hasDateFilter ||
      hasYearFilter ||
      hasMonthFilter ||
      hasRangeFilter ||
      hasSortingFilter
    );
  }, [searchTerm, dateFilter, startDate, endDate]);

  // --- HANDLERS ---
  const handleSelectProject = (project: Project) => {
    setProject(project);
    navigate("/dashboard");
  };

  const handleEditClick = (e: React.MouseEvent, project: Project) => {
    e.preventDefault();
    e.stopPropagation();
    setProjectToEdit(project);
    setEditProject({
      name: project.name,
      description: project.description || "",
    });
    setEditFormErrors({ name: "", description: "" });
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (e: React.MouseEvent, project: Project) => {
    e.preventDefault();
    e.stopPropagation();
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (projectToDelete) {
      try {
        deleteProject(projectToDelete.id);
        toast.success("Proyecto eliminado exitosamente");
      } catch (error) {
        toast.error("Error al eliminar el proyecto");
      }
    }
  };

  const handleAddProjectClick = () => {
    if (!isAdmin) {
      alert("Solo los administradores pueden crear proyectos");
      return;
    }
    setCreateDialogOpen(true);
  };

  const handleCreateProject = () => {
    try {
      createProject();
      toast.success("Proyecto creado exitosamente");
    } catch (error) {
      toast.error("Error al crear el proyecto");
    }
  };

  const handleUpdateProject = () => {
    try {
      updateProject();
      toast.success("Proyecto actualizado exitosamente");
    } catch (error) {
      toast.error("Error al actualizar el proyecto");
    }
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setDateFilter("all");
    setSelectedYear(new Date().getFullYear());
    setSelectedMonth(new Date().getMonth() + 1);
    setFilterMonthWithYear(false);
    setStartDate("");
    setEndDate("");
  };

  const handleDateFilterChange = (value: DateFilterType) => {
    setDateFilter(value);
    if (value !== "month") {
      setFilterMonthWithYear(false);
    }
  };

  const handleNewProjectChange = (
    field: keyof typeof newProject,
    value: string
  ) => {
    setNewProject((prev) => ({
      ...prev,
      [field]: value,
    }));
    if (createFormErrors[field]) {
      setCreateFormErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  const handleEditProjectChange = (
    field: keyof typeof editProject,
    value: string
  ) => {
    setEditProject((prev) => ({
      ...prev,
      [field]: value,
    }));
    if (editFormErrors[field]) {
      setEditFormErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      setProject(null);
      navigate("/login");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  // --- FUNCIONES DE VERIFICACIÓN DE ROL ---
  const isAdmin = useMemo(() => {
    return userRole?.avatar_url === "admin" || userRole?.role === "admin";
  }, [userRole]);

  const canEditOrDelete = useMemo(() => {
    return isAdmin;
  }, [isAdmin]);

  // --- PAGINACIÓN ---
  const indexOfLastProject = currentPage * projectsPerPage;
  const indexOfFirstProject = indexOfLastProject - projectsPerPage;
  const currentProjects = filteredProjects.slice(
    indexOfFirstProject,
    indexOfLastProject
  );
  const totalPages = Math.ceil(filteredProjects.length / projectsPerPage);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);
  const months = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center">
        Cargando...
        <Spinner />
      </div>
    );
  if (error)
    return (
      <div className="flex h-screen items-center justify-center text-red-500">
        Error: {error}
      </div>
    );

  return (
    <>
      <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
        {/* Header Fijo */}
        <div className="flex-shrink-0 bg-gray-50 px-4 py-4 shadow-sm z-10 border-b">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between max-w-[1920px] mx-auto w-full">
            <div className="flex-shrink-0 text-center md:text-left">
              <h1 className="text-xl md:text-2xl font-bold text-gray-800">
                Mis Proyectos
              </h1>
              <p className="text-xs md:text-sm text-gray-600">
                Selecciona un proyecto para continuar
              </p>
            </div>

            <div className="flex items-center gap-2 md:gap-3 w-full md:max-w-xl">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-full text-sm h-9 md:h-10"
                />
              </div>
              {canEditOrDelete && (
                <Button
                  onClick={handleAddProjectClick}
                  size="sm"
                  className="h-9 md:h-10 px-3 md:px-4"
                >
                  <Plus className="md:mr-2 h-4 w-4" />{" "}
                  <span className="hidden md:inline">Nuevo</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Cuerpo Principal (Filtros + Grid) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden max-w-[1920px] mx-auto w-full">
          {/* Sidebar de Filtros */}
          <div className="w-full md:w-64 flex-shrink-0 border-b md:border-b-0 md:border-r bg-white flex flex-col md:overflow-hidden">
            <div className="p-4 flex-none md:flex-1 md:overflow-y-auto">
              <div
                className="flex items-center justify-between mb-0 md:mb-6 cursor-pointer md:cursor-default"
                onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
              >
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <span className="font-semibold text-gray-700">Filtros</span>
                  <div className="md:hidden ml-1">
                    {isFiltersExpanded ? (
                      <ChevronUp className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearFilters();
                    }}
                    className={`h-8 w-8 p-0 ${!isFiltersExpanded ? "hidden md:flex" : "flex"
                      }`}
                    title="Limpiar filtros"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Lista de Filtros - Oculta en móvil si no está expandida */}
              <div
                className={`${isFiltersExpanded ? "block" : "hidden"
                  } md:block space-y-6 mt-4 md:mt-0`}
              >
                {/* Filtro por Fecha */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span className="font-medium">Por fecha</span>
                  </div>

                  <div className="space-y-2 pl-6">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="date-newest"
                        checked={dateFilter === "newest"}
                        onCheckedChange={() => handleDateFilterChange("newest")}
                      />
                      <Label
                        htmlFor="date-newest"
                        className="text-sm cursor-pointer"
                      >
                        Más recientes
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="date-oldest"
                        checked={dateFilter === "oldest"}
                        onCheckedChange={() => handleDateFilterChange("oldest")}
                      />
                      <Label
                        htmlFor="date-oldest"
                        className="text-sm cursor-pointer"
                      >
                        Más antiguos
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="date-year"
                        checked={dateFilter === "year"}
                        onCheckedChange={() => handleDateFilterChange("year")}
                      />
                      <Label
                        htmlFor="date-year"
                        className="text-sm cursor-pointer"
                      >
                        Por Año
                      </Label>
                    </div>

                    {dateFilter === "year" && (
                      <div className="pl-4 mt-1">
                        <Select
                          value={selectedYear.toString()}
                          onValueChange={(val) =>
                            setSelectedYear(parseInt(val))
                          }
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Seleccionar año" />
                          </SelectTrigger>
                          <SelectContent>
                            {years.map((year) => (
                              <SelectItem key={year} value={year.toString()}>
                                {year}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="date-month"
                        checked={dateFilter === "month"}
                        onCheckedChange={() => handleDateFilterChange("month")}
                      />
                      <Label
                        htmlFor="date-month"
                        className="text-sm cursor-pointer"
                      >
                        Por Mes
                      </Label>
                    </div>

                    {dateFilter === "month" && (
                      <div className="pl-4 mt-1 space-y-2">
                        <Select
                          value={selectedMonth.toString()}
                          onValueChange={(val) =>
                            setSelectedMonth(parseInt(val))
                          }
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Mes" />
                          </SelectTrigger>
                          <SelectContent>
                            {months.map((month, index) => (
                              <SelectItem
                                key={index + 1}
                                value={(index + 1).toString()}
                              >
                                {month}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <div className="flex items-center space-x-2 pt-1">
                          <Checkbox
                            id="filter-month-year"
                            checked={filterMonthWithYear}
                            onCheckedChange={() =>
                              setFilterMonthWithYear(!filterMonthWithYear)
                            }
                            className="h-3 w-3"
                          />
                          <Label
                            htmlFor="filter-month-year"
                            className="text-xs cursor-pointer"
                          >
                            Filtrar también por año
                          </Label>
                        </div>

                        {filterMonthWithYear && (
                          <Select
                            value={selectedYear.toString()}
                            onValueChange={(val) =>
                              setSelectedYear(parseInt(val))
                            }
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Año" />
                            </SelectTrigger>
                            <SelectContent>
                              {years.map((year) => (
                                <SelectItem key={year} value={year.toString()}>
                                  {year}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    )}

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="date-range"
                        checked={dateFilter === "range"}
                        onCheckedChange={() => handleDateFilterChange("range")}
                      />
                      <Label
                        htmlFor="date-range"
                        className="text-sm cursor-pointer"
                      >
                        Por rango
                      </Label>
                    </div>

                    {dateFilter === "range" && (
                      <div className="pl-4 mt-1 space-y-2">
                        <div className="space-y-1">
                          <Label
                            htmlFor="start-date"
                            className="text-xs text-gray-500"
                          >
                            De
                          </Label>
                          <Input
                            id="start-date"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label
                            htmlFor="end-date"
                            className="text-xs text-gray-500"
                          >
                            Hasta
                          </Label>
                          <Input
                            id="end-date"
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Espaciador para empujar el contador hacia abajo */}
              <div className="flex-1" />
            </div>

            {/* Parte inferior del sidebar (Contador) - Oculta en móvil si no está expandida */}
            <div
              className={`${isFiltersExpanded ? "block" : "hidden"
                } md:block bg-white`}
            >
              {/* Contador de proyectos (encima de la línea) */}
              <div className="flex-shrink-0 bg-card p-4">
                <div>
                  <p className="text-sm text-foreground font-medium">
                    {hasActiveFilters ? (
                      <>
                        <span className="font-bold text-chart-4">
                          {filteredProjects.length}
                        </span>{" "}
                        {filteredProjects.length === 1
                          ? "Proyecto"
                          : "Proyectos"}{" "}
                        en total
                      </>
                    ) : (
                      <>
                        <span className="font-bold text-primary">
                          {projects.length}
                        </span>{" "}
                        {projects.length === 1 ? "Proyecto" : "Proyectos"} en
                        total
                      </>
                    )}
                  </p>
                  {hasActiveFilters && (
                    <p className="text-xs text-muted-foreground mt-1">
                      De {projects.length}{" "}
                      {projects.length === 1 ? "Proyecto" : "Proyectos"} en
                      total
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Línea separadora y Botón de Logout - Siempre visible */}
            <div className="border-t border-border">
              <div className="flex-shrink-0 bg-card p-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="w-full h-8 text-sm"
                >
                  <LogOut className="mr-2 h-3.5 w-3.5" />
                  Cerrar Sesión
                </Button>
              </div>
            </div>
          </div>

          {/* Área de Grid y Paginación */}
          <div className="flex-none md:flex-1 flex flex-col min-w-0 bg-gray-50 p-3 md:p-4">
            {/* Contenedor del Grid */}
            <div
              ref={gridContainerRef}
              className="md:flex-1 md:min-h-0 md:overflow-y-auto"
            >
              {currentProjects.length > 0 ? (
                <div
                  className="grid gap-4"
                  style={{
                    gridTemplateColumns: `repeat(auto-fill, minmax(${CARD_MIN_WIDTH}px, 1fr))`,
                  }}
                >
                  {currentProjects.map((project) => (
                    <div
                      key={project.id}
                      onClick={() => handleSelectProject(project)}
                      className="group flex flex-col justify-between rounded-lg border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-chart-1 cursor-pointer"
                      style={{ height: `${CARD_HEIGHT}px` }}
                    >
                      <div>
                        <div className="flex justify-between items-start mb-1">
                          <h3
                            className="font-semibold text-foreground line-clamp-1 group-hover:text-chart-5"
                            title={project.name}
                          >
                            {project.name}
                          </h3>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                          {project.description || "Sin descripción"}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 mt-2 border-t border-border">
                        <span className="text-xs text-muted-foreground">
                          {new Date(project.created_at).toLocaleDateString()}
                        </span>
                        {canEditOrDelete && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-yellow-600 hover:bg-yellow-50 hover:border-yellow-200"
                              onClick={(e) => handleEditClick(e, project)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/20"
                              onClick={(e) => handleDeleteClick(e, project)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <Search className="h-10 w-10 mb-2 opacity-20" />
                  <p>No se encontraron proyectos</p>
                  {hasActiveFilters && (
                    <p className="text-sm text-gray-500 mt-2">
                      Intenta con otros filtros
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Paginación */}
            <div className="flex-shrink-0 pt-3 mt-1 border-t border-gray-200">
              {totalPages > 1 && (
                <Pagination className="justify-center">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() =>
                          setCurrentPage((p) => Math.max(1, p - 1))
                        }
                        className={
                          currentPage === 1
                            ? "pointer-events-none opacity-50"
                            : "cursor-pointer"
                        }
                      />
                    </PaginationItem>
                    <span className="flex items-center px-4 text-sm text-gray-600">
                      Página {currentPage} de {totalPages}
                    </span>
                    <PaginationItem>
                      <PaginationNext
                        onClick={() =>
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                        className={
                          currentPage === totalPages
                            ? "pointer-events-none opacity-50"
                            : "cursor-pointer"
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Diálogo de confirmación para borrar */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción borrará permanentemente el proyecto "
              {projectToDelete?.name}". Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Borrando..." : "Borrar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo para crear nuevo proyecto */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Proyecto</DialogTitle>
            <DialogDescription>
              Ingresa los detalles del nuevo proyecto. Los campos marcados con *
              son obligatorios.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Nombre del Proyecto *</Label>
              <Input
                id="project-name"
                value={newProject.name}
                onChange={(e) => handleNewProjectChange("name", e.target.value)}
                placeholder="Ej: Sistema de Gestión"
                maxLength={100}
                className={createFormErrors.name ? "border-destructive" : ""}
              />
              {createFormErrors.name && (
                <p className="text-sm text-destructive">
                  {createFormErrors.name}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {newProject.name.length}/100 caracteres
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-description">
                Descripción (Opcional)
              </Label>
              <Textarea
                id="project-description"
                value={newProject.description}
                onChange={(e) =>
                  handleNewProjectChange("description", e.target.value)
                }
                placeholder="Describe brevemente el proyecto..."
                rows={4}
                maxLength={500}
                className={
                  createFormErrors.description ? "border-destructive" : ""
                }
              />
              {createFormErrors.description && (
                <p className="text-sm text-destructive">
                  {createFormErrors.description}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {newProject.description.length}/500 caracteres
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                setNewProject({ name: "", description: "" });
                setCreateFormErrors({ name: "", description: "" });
              }}
              disabled={isCreating}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateProject}
              disabled={isCreating || !newProject.name.trim()}
            >
              {isCreating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                "Crear Proyecto"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo para editar proyecto */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Proyecto</DialogTitle>
            <DialogDescription>
              Modifica los detalles del proyecto. Los campos marcados con * son
              obligatorios.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-project-name">Nombre del Proyecto *</Label>
              <Input
                id="edit-project-name"
                value={editProject.name}
                onChange={(e) =>
                  handleEditProjectChange("name", e.target.value)
                }
                placeholder="Ej: Sistema de Gestión"
                maxLength={100}
                className={editFormErrors.name ? "border-destructive" : ""}
              />
              {editFormErrors.name && (
                <p className="text-sm text-destructive">
                  {editFormErrors.name}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {editProject.name.length}/100 caracteres
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-project-description">
                Descripción (Opcional)
              </Label>
              <Textarea
                id="edit-project-description"
                value={editProject.description}
                onChange={(e) =>
                  handleEditProjectChange("description", e.target.value)
                }
                placeholder="Describe brevemente el proyecto..."
                rows={4}
                maxLength={500}
                className={
                  editFormErrors.description ? "border-destructive" : ""
                }
              />
              {editFormErrors.description && (
                <p className="text-sm text-destructive">
                  {editFormErrors.description}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {editProject.description.length}/500 caracteres
              </p>
            </div>

            {/* Información del proyecto */}
            {projectToEdit && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mt-1">
                  Creado el:{" "}
                  {new Date(projectToEdit.created_at).toLocaleDateString()}
                </p>
                {projectToEdit.updated_at !== projectToEdit.created_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Última actualización:{" "}
                    {new Date(projectToEdit.updated_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setProjectToEdit(null);
                setEditFormErrors({ name: "", description: "" });
              }}
              disabled={isEditing}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpdateProject}
              disabled={isEditing || !editProject.name.trim()}
            >
              {isEditing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Actualizando...
                </>
              ) : (
                "Guardar Cambios"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
