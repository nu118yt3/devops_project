"use client";

import { useState, useEffect } from "react";
import {
  FileCode,
  FileText,
  Camera,
  StickyNote,
  ChevronRight,
  Search,
  UploadCloud,
  Loader2,
  Download,
  Calendar,
  Tag,
  File,
  Eye,
  MoreVertical,
  Trash2,
  FileImage,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import supabase from "@/utils/supabase";
import { toast } from "sonner";
import { useProject } from "@/contexts/ProjectContext";

// Definir tipos
interface InvoiceFormData {
  projectId: string;
  category: string;
  date: string;
  tag: string;
  notes: string;
}

interface Invoice {
  id: string;
  xml_file_name: string;
  xml_file_url: string;
  attachment_file_name: string | null;
  attachment_file_url: string | null;
  attachment_file_type: string | null;
  category: string;
  tags: string[];
  comments: string | null;
  invoice_date: string;
  created_at: string;
  project_id: string;
}

// Tipo para el filtro
type FileFilterType = "all" | "xml" | "attachments";

export default function FacturasPage() {
  const { project } = useProject();
  const [activeTab, setActiveTab] = useState<"subir" | "mis">("subir");
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [formData, setFormData] = useState<InvoiceFormData>({
    projectId: project?.id || "",
    category: "",
    date: new Date().toISOString().split("T")[0],
    tag: "",
    notes: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
  const [hasLoadedInvoices, setHasLoadedInvoices] = useState(false);
  const [fileFilter, setFileFilter] = useState<FileFilterType>("all");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Cargar facturas automáticamente cuando se carga la página
  useEffect(() => {
    if (project?.id && !hasLoadedInvoices) {
      loadInvoices();
    }
  }, [project?.id, hasLoadedInvoices]);

  // También cargar facturas cuando cambiamos a la pestaña "mis"
  useEffect(() => {
    if (activeTab === "mis" && project?.id && !hasLoadedInvoices) {
      loadInvoices();
    }
  }, [activeTab, project?.id, hasLoadedInvoices]);

  // Cargar facturas desde la base de datos
  const loadInvoices = async () => {
    if (!project?.id) return;

    setIsLoadingInvoices(true);
    try {
      const { data, error } = await supabase
        .from("project_files")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Enriquecer datos con tipo de archivo adjunto
      const enrichedData = (data || []).map((invoice) => ({
        ...invoice,
        attachment_file_type: getFileType(invoice.attachment_file_name),
      }));

      setInvoices(enrichedData);
      setHasLoadedInvoices(true);
    } catch (error: any) {
      console.error("Error loading invoices:", error);
      toast.error("Error al cargar las facturas");
    } finally {
      setIsLoadingInvoices(false);
    }
  };

  // Helper para extraer la ruta del archivo de una URL de Supabase
  const extractPathFromUrl = (url: string | null) => {
    if (!url) return "";
    try {
      // Si ya es una ruta relativa (no contiene http), la devolvemos tal cual
      if (!url.startsWith("http")) return url;

      const bucketName = "archivos";

      // Intentar encontrar el nombre del bucket en la URL
      // Formato típico: https://[project].supabase.co/storage/v1/object/public/archivos/path/to/file
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split("/");
      const bucketIndex = pathParts.indexOf(bucketName);

      if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
        return pathParts.slice(bucketIndex + 1).join("/");
      }

      // Fallback: si no se encuentra el nombre del bucket, intentar patrones comunes
      const storagePattern = "/storage/v1/object/";
      if (url.includes(storagePattern)) {
        const afterStorage = url.split(storagePattern)[1];
        // afterStorage será "public/bucket/path..." o "authenticated/bucket/path..."
        const parts = afterStorage.split("/");
        if (parts.length >= 3) {
          // El primer elemento es "public" o "authenticated", el segundo es el bucket
          return parts.slice(2).join("/");
        }
      }

      return url;
    } catch (error) {
      console.error("Error al extraer la ruta de la URL:", error);
      return url || "";
    }
  };

  // Helper para obtener una URL firmada (para buckets privados)
  const getSignedUrl = async (storedUrl: string | null, download = false) => {
    if (!storedUrl) return "";
    const path = extractPathFromUrl(storedUrl);

    try {
      const { data, error } = await supabase.storage
        .from("archivos")
        .createSignedUrl(path, 3600, download ? { download: true } : undefined);

      if (error) throw error;
      return data.signedUrl;
    } catch (error) {
      console.error("Error generating signed URL:", error);
      toast.error("Error al acceder al archivo privado");
      return "";
    }
  };



  // Determinar tipo de archivo por extensión
  const getFileType = (filename: string | null): string | null => {
    if (!filename) return null;

    const extension = filename.toLowerCase().split(".").pop();
    switch (extension) {
      case "pdf":
        return "pdf";
      case "jpg":
      case "jpeg":
      case "png":
      case "gif":
      case "bmp":
      case "webp":
        return "image";
      default:
        return "other";
    }
  };

  // Obtener icono según tipo de archivo
  const getFileIcon = (fileType: string | null) => {
    switch (fileType) {
      case "pdf":
        return <FileText className="h-4 w-4 text-purple-500" />;
      case "image":
        return <FileImage className="h-4 w-4 text-blue-500" />;
      default:
        return <FileText className="h-4 w-4 text-blue-500" />;
    }
  };

  // Filtrar facturas según tipo seleccionado
  const getFilteredInvoices = () => {
    let filtered = invoices;

    // Filtrar por tipo de archivo
    if (fileFilter === "xml") {
      filtered = filtered.filter((invoice) => invoice.xml_file_url);
    } else if (fileFilter === "attachments") {
      filtered = filtered.filter((invoice) => invoice.attachment_file_url);
    }

    // Filtrar por término de búsqueda
    if (searchTerm) {
      filtered = filtered.filter(
        (invoice) =>
          invoice.xml_file_name
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          invoice.attachment_file_name
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          invoice.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
          invoice.tags?.some((tag) =>
            tag.toLowerCase().includes(searchTerm.toLowerCase())
          ) ||
          invoice.comments?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  };

  const filteredInvoices = getFilteredInvoices();

  // Determinar qué botones mostrar según el filtro
  const getActionButtons = (invoice: Invoice) => {
    const buttons = [];

    // Siempre mostrar botón de eliminar
    const deleteButton = {
      label: "Eliminar",
      icon: <Trash2 className="mr-2 h-4 w-4" />,
      onClick: () => {
        setInvoiceToDelete(invoice.id);
        setDeleteDialogOpen(true);
      },
      className: "text-red-600",
    };

    if (fileFilter === "all") {
      // En modo "all", solo mostrar el menú desplegable
      return "dropdown";
    } else if (fileFilter === "xml") {
      // Solo mostrar opciones para XML
      if (invoice.xml_file_url) {
        buttons.push(
          {
            label: "Ver XML",
            icon: <Eye className="h-4 w-4" />,
            onClick: () => viewFile(invoice.xml_file_url),
            title: "Ver XML",
          },
          {
            label: "Descargar XML",
            icon: <Download className="h-4 w-4" />,
            onClick: () => downloadXml(invoice),
            title: "Descargar XML",
          },
          deleteButton
        );
      }
    } else if (fileFilter === "attachments") {
      // Solo mostrar opciones para adjuntos
      if (invoice.attachment_file_url) {
        buttons.push(
          {
            label: "Ver adjunto",
            icon: <FileImage className="h-4 w-4" />,
            onClick: () => previewAttachment(invoice),
            title: "Ver adjunto",
          },
          {
            label: "Descargar adjunto",
            icon: <Download className="h-4 w-4" />,
            onClick: () => downloadAttachment(invoice),
            title: "Descargar adjunto",
          },
          deleteButton
        );
      }
    }

    return buttons;
  };

  // Actualizar formData cuando cambie el proyecto
  useEffect(() => {
    if (project?.id) {
      setFormData((prev) => ({
        ...prev,
        projectId: project.id,
      }));
      // Reiniciar el estado de carga si cambia el proyecto
      if (hasLoadedInvoices) {
        setHasLoadedInvoices(false);
      }
    }
  }, [project]);

  const handleInputChange = (field: keyof InvoiceFormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const uploadFileToStorage = async (
    file: File,
    folder: string
  ): Promise<string | null> => {
    try {
      const originalName = file.name;
      const sanitizedName = originalName
        .replace(/[^\w\s.-]/gi, "")
        .replace(/\s+/g, "_")
        .toLowerCase();

      const timestamp = Date.now();
      const fileName = `${timestamp}_${sanitizedName}`;
      const filePath = `${folder}/${fileName}`;

      const { error } = await supabase.storage
        .from("archivos")
        .upload(filePath, file);

      if (error) throw error;

      return filePath;
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error(`Error al subir el archivo`);
      return null;
    }
  };

  const resetForm = () => {
    setXmlFile(null);
    setAttachmentFile(null);
    setFormData({
      projectId: project?.id || "",
      category: "",
      date: new Date().toISOString().split("T")[0],
      tag: "",
      notes: "",
    });

    const xmlInput = document.getElementById("file-xml") as HTMLInputElement;
    const attachmentInput = document.getElementById(
      "file-attachment"
    ) as HTMLInputElement;
    if (xmlInput) xmlInput.value = "";
    if (attachmentInput) attachmentInput.value = "";

    toast.info("Formulario limpiado");
  };

  // Descargar archivo XML
  const downloadXml = async (invoice: Invoice) => {
    try {
      if (!invoice.xml_file_url) return;

      toast.info("Generando enlace de descarga seguro...");
      const signedUrl = await getSignedUrl(invoice.xml_file_url, true);

      if (!signedUrl) return;

      const link = document.createElement("a");
      link.href = signedUrl;
      link.download = invoice.xml_file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Descargando XML...");
    } catch (error) {
      console.error("Error downloading XML:", error);
      toast.error("Error al descargar el archivo");
    }
  };

  // Descargar archivo adjunto
  const downloadAttachment = async (invoice: Invoice) => {
    if (!invoice.attachment_file_url) return;

    try {
      toast.info("Generando enlace de descarga seguro...");
      const signedUrl = await getSignedUrl(invoice.attachment_file_url, true);

      if (!signedUrl) return;

      const link = document.createElement("a");
      link.href = signedUrl;
      link.download = invoice.attachment_file_name || "adjunto";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Descargando adjunto...");
    } catch (error) {
      console.error("Error downloading attachment:", error);
      toast.error("Error al descargar el archivo adjunto");
    }
  };

  // Ver archivo
  const viewFile = async (url: string | null) => {
    if (!url) return;
    toast.info("Abriendo archivo seguro...");
    const signedUrl = await getSignedUrl(url);
    if (signedUrl) {
      window.open(signedUrl, "_blank");
    }
  };

  // Previsualizar archivo adjunto
  const previewAttachment = async (invoice: Invoice) => {
    if (!invoice.attachment_file_url) return;

    setSelectedInvoice(invoice);
    setIsLoadingPreview(true);
    setPreviewDialogOpen(true);
    setPreviewUrl(""); // Limpiar previa anterior

    const signedUrl = await getSignedUrl(invoice.attachment_file_url);
    setPreviewUrl(signedUrl);
    setIsLoadingPreview(false);
  };

  // Eliminar factura
  const handleDeleteInvoice = async () => {
    if (!invoiceToDelete) return;

    try {
      const { data: invoice } = await supabase
        .from("project_files")
        .select("xml_file_name, attachment_file_name")
        .eq("id", invoiceToDelete)
        .single();

      if (invoice) {
        const { error: storageError } = await supabase.storage
          .from("archivos")
          .remove(["xml/" + invoice.xml_file_name]);
        const { error: storageError2 } = await supabase.storage
          .from("archivos")
          .remove(["attachments/" + invoice.attachment_file_name]);

        if (storageError || storageError2) {
          console.error("Error deleting files from storage:", storageError);
        }
      }

      const { error } = await supabase
        .from("project_files")
        .delete()
        .eq("id", invoiceToDelete);

      if (error) throw error;

      setInvoices((prev) => prev.filter((inv) => inv.id !== invoiceToDelete));
      toast.success("Factura eliminada correctamente");
    } catch (error: any) {
      console.error("Error deleting invoice:", error);
      toast.error("Error al eliminar la factura");
    } finally {
      setDeleteDialogOpen(false);
      setInvoiceToDelete(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!xmlFile) {
      toast.error("Por favor, selecciona un archivo XML");
      return;
    }

    if (!attachmentFile) {
      toast.error("Por favor, selecciona un archivo adjunto (PDF o imagen)");
      return;
    }

    if (!formData.projectId) {
      toast.error("No hay un proyecto seleccionado");
      return;
    }

    if (xmlFile.type !== "text/xml" && !xmlFile.name.endsWith(".xml")) {
      toast.error("El archivo debe ser un XML válido");
      return;
    }

    const allowedAttachmentTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/jpg",
      "image/gif",
    ];

    const isImageOrPdf =
      allowedAttachmentTypes.includes(attachmentFile.type) ||
      attachmentFile.name.endsWith(".pdf") ||
      attachmentFile.name.endsWith(".jpg") ||
      attachmentFile.name.endsWith(".jpeg") ||
      attachmentFile.name.endsWith(".png");

    if (!isImageOrPdf) {
      toast.error("El archivo adjunto debe ser PDF o imagen (JPG, PNG, GIF)");
      return;
    }

    if (attachmentFile.size > 10 * 1024 * 1024) {
      toast.error("El archivo adjunto no debe exceder 10MB");
      return;
    }

    setIsLoading(true);

    try {
      const xmlUrl = await uploadFileToStorage(xmlFile, "xml");
      if (!xmlUrl) {
        setIsLoading(false);
        return;
      }

      const attachmentUrl = await uploadFileToStorage(
        attachmentFile,
        "attachments"
      );
      if (!attachmentUrl) {
        setIsLoading(false);
        return;
      }

      const { data: fileRecord, error: dbError } = await supabase
        .from("project_files")
        .insert([
          {
            project_id: formData.projectId,
            xml_file_name: xmlFile.name,
            xml_file_url: xmlUrl,
            attachment_file_name: attachmentFile.name,
            attachment_file_url: attachmentUrl,
            category: formData.category,
            tags: formData.tag ? [formData.tag] : [],
            comments: formData.notes,
            invoice_date: formData.date,
            created_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (dbError) throw dbError;

      // Enriquecer con tipo de archivo
      const enrichedRecord = {
        ...fileRecord,
        attachment_file_type: getFileType(attachmentFile.name),
      };

      // Actualizar la lista de facturas inmediatamente
      setInvoices((prev) => [enrichedRecord, ...prev]);

      toast.success("Factura y archivo adjunto subidos correctamente");
      resetForm();

      // Cambiar a la pestaña de mis facturas
      setActiveTab("mis");
    } catch (error: any) {
      console.error("Error submitting form:", error);
      toast.error(
        `Hubo un error al guardar la factura: ${error.message || "Error desconocido"
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Contadores para las tarjetas
  const totalInvoices = invoices.length;
  const xmlFilesCount = invoices.filter(
    (invoice) => invoice.xml_file_url
  ).length;
  const attachmentsCount = invoices.filter(
    (invoice) => invoice.attachment_file_url
  ).length;

  // Mostrar mensaje si no hay proyecto seleccionado
  if (!project) {
    return (
      <div className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
        <header className="flex-shrink-0 border-b bg-card min-h-16 h-auto py-4 flex items-center justify-between px-4 sm:px-8">
          <div className="flex items-center">
            <nav aria-label="Breadcrumb" className="flex">
              <ol className="flex items-center space-x-2 text-sm text-muted-foreground whitespace-nowrap">
                <li>
                  <a
                    className="hover:text-foreground transition-colors"
                    href="#"
                  >
                    Finanzas
                  </a>
                </li>
                <li>
                  <ChevronRight className="h-4 w-4" />
                </li>
                <li className="font-medium text-foreground">
                  Facturas
                </li>
              </ol>
            </nav>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-8">
            <h2 className="text-xl font-semibold mb-4">
              No hay proyecto seleccionado
            </h2>
            <p className="text-muted-foreground mb-6">
              Por favor, selecciona un proyecto primero para poder subir
              facturas.
            </p>
            <Button asChild>
              <a href="/dashboard">Ir a Dashboard</a>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 border-b bg-card min-h-16 h-auto py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-8 gap-4">
        <div className="flex items-center overflow-x-auto w-full sm:w-auto">
          <nav aria-label="Breadcrumb" className="flex">
            <ol className="flex items-center space-x-2 text-sm text-muted-foreground whitespace-nowrap">
              <li>
                <a className="hover:text-foreground transition-colors" href="#">
                  Finanzas
                </a>
              </li>
              <li>
                <ChevronRight className="h-4 w-4" />
              </li>
              <li className="font-medium text-foreground">
                Facturas
              </li>
            </ol>
          </nav>
        </div>
        <div className="w-full sm:max-w-xs relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-muted-foreground" />
          </div>
          <Input
            className="pl-10 w-full"
            placeholder="Buscar facturas..."
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </header>

      {/* Main Content */}
      <ScrollArea className="flex-1">
        <form onSubmit={handleSubmit}>
          <div className="w-full max-w-6xl mx-auto p-4 sm:p-8">
            <div className="mb-8">
              <h1 className="text-2xl font-bold uppercase tracking-tight text-foreground">
                Facturas
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Gestiona y carga tus comprobantes fiscales para el proyecto:{" "}
                <span className="font-semibold text-primary">
                  {project.name}
                </span>
              </p>
            </div>

            {/* Tabs */}
            <div className="mb-8 border-b overflow-x-auto scrollbar-hide">
              <nav className="-mb-px flex space-x-4 sm:space-x-8 min-w-max">
                <button
                  type="button"
                  onClick={() => setActiveTab("subir")}
                  className={`${activeTab === "subir"
                    ? "border-primary text-primary font-semibold"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                    } whitespace-nowrap py-4 px-1 border-b-2 text-sm transition-colors`}
                >
                  Subir Factura
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("mis")}
                  className={`${activeTab === "mis"
                    ? "border-primary text-primary font-semibold"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                    } whitespace-nowrap py-4 px-1 border-b-2 text-sm transition-colors`}
                >
                  Mis Facturas ({totalInvoices})
                </button>
              </nav>
            </div>

            {activeTab === "subir" ? (
              <div className="space-y-6">
                {/* Upload Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* XML Card */}
                  <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-4 space-y-0">
                      <CardTitle className="text-sm font-semibold flex items-center">
                        <FileCode className="text-orange-500 mr-2 h-5 w-5" />
                        Archivo XML
                      </CardTitle>
                      <Badge
                        variant="outline"
                        className="text-[10px] uppercase tracking-wider text-green-600 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 font-bold"
                      >
                        Obligatorio
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <div className="relative group border-2 border-dashed border-muted rounded-xl bg-muted/30 hover:bg-muted/50 transition-all cursor-pointer">
                        <input
                          accept=".xml,text/xml"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          id="file-xml"
                          type="file"
                          required
                          onChange={(e) =>
                            setXmlFile(e.target.files?.[0] || null)
                          }
                        />
                        <div className="py-8 sm:py-12 flex flex-col items-center justify-center text-center">
                          <UploadCloud className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground group-hover:text-primary transition-colors mb-3" />
                          <div className="text-sm text-foreground px-2">
                            {xmlFile ? (
                              <span className="font-semibold text-primary">
                                {xmlFile.name}
                              </span>
                            ) : (
                              <>
                                <span className="font-semibold text-primary">
                                  Haz clic para subir
                                </span>
                                <span className="px-1 text-muted-foreground">
                                  o arrastra el archivo
                                </span>
                              </>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Solo formato .XML
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Attachment Card */}
                  <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-4 space-y-0">
                      <CardTitle className="text-sm font-semibold flex items-center">
                        <FileText className="text-blue-500 mr-2 h-5 w-5" />
                        Archivo Adjunto
                      </CardTitle>
                      <Badge
                        variant="outline"
                        className="text-[10px] uppercase tracking-wider text-green-600 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 font-bold"
                      >
                        Obligatorio
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <div className="relative group border-2 border-dashed border-muted rounded-xl bg-muted/30 hover:bg-muted/50 transition-all cursor-pointer">
                        <input
                          accept=".pdf,.jpg,.jpeg,.png,.gif,application/pdf,image/*"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          id="file-attachment"
                          type="file"
                          required
                          onChange={(e) =>
                            setAttachmentFile(e.target.files?.[0] || null)
                          }
                        />
                        <div className="py-8 sm:py-12 flex flex-col items-center justify-center text-center">
                          <Camera className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground group-hover:text-primary transition-colors mb-3" />
                          <div className="text-sm text-foreground px-2">
                            {attachmentFile ? (
                              <span className="font-semibold text-primary">
                                {attachmentFile.name}
                              </span>
                            ) : (
                              <>
                                <span className="font-semibold text-primary">
                                  Haz clic para subir
                                </span>
                                <span className="px-1 text-muted-foreground">
                                  o arrastra el archivo
                                </span>
                              </>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            JPG, PNG, GIF o PDF (Máx. 10MB)
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Additional Details Card */}
                <Card className="shadow-sm overflow-hidden">
                  <CardHeader className="border-b bg-muted/20 flex flex-row items-center justify-between py-4">
                    <CardTitle className="text-base font-semibold">
                      Detalles Adicionales
                    </CardTitle>
                    <StickyNote className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6">
                    <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div className="space-y-1.5">
                        <Label
                          className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
                          htmlFor="categoria"
                        >
                          Categoría
                        </Label>
                        <Select
                          value={formData.category}
                          onValueChange={(value) =>
                            handleInputChange("category", value)
                          }
                        >
                          <SelectTrigger id="categoria">
                            <SelectValue placeholder="Selecciona" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="materiales">
                              Materiales
                            </SelectItem>
                            <SelectItem value="mano-de-obra">
                              Mano de Obra
                            </SelectItem>
                            <SelectItem value="herramientas">
                              Herramientas
                            </SelectItem>
                            <SelectItem value="otros">Otros</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label
                          className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
                          htmlFor="fecha"
                        >
                          Fecha de la Factura
                        </Label>
                        <div className="relative">
                          <Input
                            id="fecha"
                            type="date"
                            className="block w-full"
                            value={formData.date}
                            onChange={(e) =>
                              handleInputChange("date", e.target.value)
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label
                          className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
                          htmlFor="etiqueta"
                        >
                          Etiqueta
                        </Label>
                        <Input
                          id="etiqueta"
                          placeholder="Ej: Obra Norte"
                          value={formData.tag}
                          onChange={(e) =>
                            handleInputChange("tag", e.target.value)
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold" htmlFor="notas">
                        Notas / Comentarios
                      </Label>
                      <Textarea
                        id="notas"
                        placeholder="Proporciona contexto extra sobre esta factura..."
                        className="min-h-[120px] resize-none"
                        value={formData.notes}
                        onChange={(e) =>
                          handleInputChange("notes", e.target.value)
                        }
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row justify-end items-center gap-4 pt-4 pb-10">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto sm:px-8"
                    type="button"
                    onClick={resetForm}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="w-full sm:w-auto sm:px-12 bg-[#111827] hover:bg-[#111827]/90 text-white dark:bg-foreground dark:text-background"
                    type="submit"
                    disabled={isLoading || !xmlFile || !attachmentFile}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Subiendo...
                      </>
                    ) : (
                      "Guardar"
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Stats Cards - Clickables */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  <Card
                    className={`shadow-sm cursor-pointer transition-all hover:shadow-md ${fileFilter === "all" ? "ring-2 ring-primary" : ""
                      }`}
                    onClick={() => setFileFilter("all")}
                  >
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm text-muted-foreground truncate">
                            Total Facturas
                          </p>
                          <h3 className="text-xl sm:text-2xl font-bold">
                            {totalInvoices}
                          </h3>
                          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">
                            Haz clic para ver todas
                          </p>
                        </div>
                        <div className={`p-2 rounded-full ${fileFilter === "all" ? "bg-primary/10" : "bg-muted"}`}>
                          <File
                            className={`h-6 w-6 sm:h-8 sm:w-8 ${fileFilter === "all"
                              ? "text-primary"
                              : "text-primary/40"
                              }`}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card
                    className={`shadow-sm cursor-pointer transition-all hover:shadow-md ${fileFilter === "xml" ? "ring-2 ring-orange-500" : ""
                      }`}
                    onClick={() => setFileFilter("xml")}
                  >
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm text-muted-foreground truncate">
                            Archivos XML
                          </p>
                          <h3 className="text-xl sm:text-2xl font-bold">
                            {xmlFilesCount}
                          </h3>
                          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">
                            Haz clic para ver solo XML
                          </p>
                        </div>
                        <div className={`p-2 rounded-full ${fileFilter === "xml" ? "bg-orange-500/10" : "bg-muted"}`}>
                          <FileCode
                            className={`h-6 w-6 sm:h-8 sm:w-8 ${fileFilter === "xml"
                              ? "text-orange-500"
                              : "text-orange-500/40"
                              }`}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card
                    className={`shadow-sm cursor-pointer transition-all hover:shadow-md ${fileFilter === "attachments" ? "ring-2 ring-blue-500" : ""
                      }`}
                    onClick={() => setFileFilter("attachments")}
                  >
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm text-muted-foreground truncate">
                            Archivos Adjuntos
                          </p>
                          <h3 className="text-xl sm:text-2xl font-bold">
                            {attachmentsCount}
                          </h3>
                          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">
                            Haz clic para ver solo adjuntos
                          </p>
                        </div>
                        <div className={`p-2 rounded-full ${fileFilter === "attachments" ? "bg-blue-500/10" : "bg-muted"}`}>
                          <FileText
                            className={`h-6 w-6 sm:h-8 sm:w-8 ${fileFilter === "attachments"
                              ? "text-blue-500"
                              : "text-blue-500/40"
                              }`}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Filtro activo */}
                {fileFilter !== "all" && (
                  <div className="flex items-center justify-between">
                    <div>
                      <Badge variant="secondary" className="text-sm">
                        {fileFilter === "xml"
                          ? "Mostrando solo archivos XML"
                          : "Mostrando solo archivos adjuntos"}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFileFilter("all")}
                    >
                      Ver todas
                    </Button>
                  </div>
                )}

                {/* Facturas Table */}
                <Card>
                  <CardHeader className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <CardTitle>
                        {fileFilter === "all"
                          ? "Lista de Facturas"
                          : fileFilter === "xml"
                            ? "Archivos XML"
                            : "Archivos Adjuntos"}
                      </CardTitle>
                      <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={loadInvoices}
                          disabled={isLoadingInvoices}
                          className="flex-1 sm:flex-none"
                        >
                          <Loader2
                            className={`h-4 w-4 mr-2 ${isLoadingInvoices ? "animate-spin" : ""
                              }`}
                          />
                          Actualizar
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          {filteredInvoices.length} de {invoices.length}{" "}
                          facturas
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 sm:p-6">
                    {isLoadingInvoices ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                        <span className="text-sm text-muted-foreground">
                          Cargando facturas...
                        </span>
                      </div>
                    ) : filteredInvoices.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium">
                          No hay facturas registradas
                        </h3>
                        <p className="text-muted-foreground mt-1 max-w-xs mx-auto">
                          {invoices.length === 0
                            ? "Aún no has subido ninguna factura para este proyecto."
                            : fileFilter === "xml"
                              ? "No hay archivos XML en este proyecto."
                              : fileFilter === "attachments"
                                ? "No hay archivos adjuntos en este proyecto."
                                : "No se encontraron facturas con ese término de búsqueda."}
                        </p>
                        {invoices.length === 0 && (
                          <Button
                            onClick={() => setActiveTab("subir")}
                            className="mt-4"
                          >
                            Subir mi primera factura
                          </Button>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* Mobile View: Cards */}
                        <div className="block sm:hidden divide-y">
                          {filteredInvoices.map((invoice) => (
                            <div key={invoice.id} className="p-4 space-y-3">
                              <div className="flex items-start justify-between">
                                <div className="space-y-1 min-w-0 flex-1 mr-2">
                                  {invoice.xml_file_url && (
                                    <div className="flex items-center space-x-2">
                                      <FileCode className="h-4 w-4 flex-shrink-0 text-orange-500" />
                                      <span className="font-semibold truncate text-sm">
                                        {invoice.xml_file_name}
                                      </span>
                                    </div>
                                  )}
                                  {invoice.attachment_file_url && (
                                    <div className="flex items-center space-x-2">
                                      {getFileIcon(invoice.attachment_file_type)}
                                      <span className="text-muted-foreground truncate text-sm">
                                        {invoice.attachment_file_name}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex-shrink-0">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      {invoice.xml_file_url && (
                                        <>
                                          <DropdownMenuItem onClick={() => viewFile(invoice.xml_file_url)}>
                                            <Eye className="mr-2 h-4 w-4" /> Ver XML
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => downloadXml(invoice)}>
                                            <Download className="mr-2 h-4 w-4" /> Descargar XML
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                      {invoice.attachment_file_url && (
                                        <>
                                          <DropdownMenuItem onClick={() => previewAttachment(invoice)}>
                                            <FileImage className="mr-2 h-4 w-4" /> Ver adjunto
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => downloadAttachment(invoice)}>
                                            <Download className="mr-2 h-4 w-4" /> Descargar adjunto
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-red-600"
                                        onClick={() => {
                                          setInvoiceToDelete(invoice.id);
                                          setDeleteDialogOpen(true);
                                        }}
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-2 items-center text-[11px]">
                                <Badge variant="outline" className="px-1.5 py-0">
                                  {invoice.category}
                                </Badge>
                                <div className="flex items-center text-muted-foreground">
                                  <Calendar className="h-3 w-3 mr-1" />
                                  {new Date(invoice.invoice_date).toLocaleDateString()}
                                </div>
                                {invoice.tags?.map((tag, index) => (
                                  <Badge key={index} variant="secondary" className="px-1.5 py-0">
                                    <Tag className="h-2 w-2 mr-1" /> {tag}
                                  </Badge>
                                ))}
                              </div>

                              {invoice.comments && (
                                <p className="text-xs text-muted-foreground line-clamp-2 italic">
                                  "{invoice.comments}"
                                </p>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Desktop View: Table */}
                        <div className="hidden sm:block overflow-x-auto">
                          <div className="min-w-[800px]">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[300px]">Archivos</TableHead>
                                  <TableHead>Categoría</TableHead>
                                  <TableHead>Fecha</TableHead>
                                  <TableHead>Etiquetas</TableHead>
                                  <TableHead>Notas</TableHead>
                                  <TableHead className="text-right">
                                    Acciones
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {filteredInvoices.map((invoice) => {
                                  const actionButtons = getActionButtons(invoice);

                                  return (
                                    <TableRow key={invoice.id}>
                                      <TableCell>
                                        <div className="space-y-2 max-w-[280px]">
                                          {/* Mostrar según el filtro seleccionado */}
                                          {fileFilter === "all" ? (
                                            <>
                                              {/* Mostrar ambos en modo 'all' */}
                                              {invoice.xml_file_url && (
                                                <div className="flex items-center space-x-2">
                                                  <FileCode className="h-4 w-4 flex-shrink-0 text-orange-500" />
                                                  <span className="font-medium truncate text-sm">
                                                    {invoice.xml_file_name}
                                                  </span>
                                                </div>
                                              )}
                                              {invoice.attachment_file_url && (
                                                <div className="flex items-center space-x-2">
                                                  {getFileIcon(
                                                    invoice.attachment_file_type
                                                  )}
                                                  <span className="text-muted-foreground truncate text-sm">
                                                    {invoice.attachment_file_name}
                                                  </span>
                                                </div>
                                              )}
                                            </>
                                          ) : fileFilter === "xml" ? (
                                            // Solo mostrar XML
                                            <div className="flex items-center space-x-2">
                                              <FileCode className="h-4 w-4 flex-shrink-0 text-orange-500" />
                                              <span className="font-medium truncate text-sm">
                                                {invoice.xml_file_name ||
                                                  "No tiene archivo XML"}
                                              </span>
                                            </div>
                                          ) : (
                                            // Solo mostrar adjuntos
                                            <div className="flex items-center space-x-2">
                                              {getFileIcon(
                                                invoice.attachment_file_type
                                              )}
                                              <span className="text-muted-foreground truncate text-sm">
                                                {invoice.attachment_file_name ||
                                                  "No tiene archivo adjunto"}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant="outline" className="whitespace-nowrap">
                                          {invoice.category}
                                        </Badge>
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex items-center space-x-1 text-sm text-muted-foreground whitespace-nowrap">
                                          <Calendar className="h-3 w-3" />
                                          <span>
                                            {new Date(
                                              invoice.invoice_date
                                            ).toLocaleDateString()}
                                          </span>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex flex-wrap gap-1 min-w-[100px]">
                                          {invoice.tags?.map((tag, index) => (
                                            <Badge
                                              key={index}
                                              variant="secondary"
                                              className="text-[10px] px-1.5 py-0"
                                            >
                                              <Tag className="h-2 w-2 mr-1" />
                                              {tag}
                                            </Badge>
                                          ))}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <p className="text-sm text-muted-foreground truncate max-w-[150px]">
                                          {invoice.comments || "Sin notas"}
                                        </p>
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <div className="flex justify-end space-x-2">
                                          {actionButtons === "dropdown" ? (
                                            // Mostrar solo el menú desplegable para "all"
                                            <DropdownMenu>
                                              <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm">
                                                  <MoreVertical className="h-4 w-4" />
                                                </Button>
                                              </DropdownMenuTrigger>
                                              <DropdownMenuContent align="end">
                                                {invoice.xml_file_url && (
                                                  <>
                                                    <DropdownMenuItem
                                                      onClick={() =>
                                                        viewFile(
                                                          invoice.xml_file_url
                                                        )
                                                      }
                                                    >
                                                      <Eye className="mr-2 h-4 w-4" />
                                                      Ver XML
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                      onClick={() =>
                                                        downloadXml(invoice)
                                                      }
                                                    >
                                                      <Download className="mr-2 h-4 w-4" />
                                                      Descargar XML
                                                    </DropdownMenuItem>
                                                  </>
                                                )}
                                                {invoice.attachment_file_url && (
                                                  <>
                                                    <DropdownMenuItem
                                                      onClick={() =>
                                                        previewAttachment(invoice)
                                                      }
                                                    >
                                                      <FileImage className="mr-2 h-4 w-4" />
                                                      Ver adjunto
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                      onClick={() =>
                                                        downloadAttachment(invoice)
                                                      }
                                                    >
                                                      <Download className="mr-2 h-4 w-4" />
                                                      Descargar adjunto
                                                    </DropdownMenuItem>
                                                  </>
                                                )}
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                  className="text-red-600"
                                                  onClick={() => {
                                                    setInvoiceToDelete(invoice.id);
                                                    setDeleteDialogOpen(true);
                                                  }}
                                                >
                                                  <Trash2 className="mr-2 h-4 w-4" />
                                                  Eliminar
                                                </DropdownMenuItem>
                                              </DropdownMenuContent>
                                            </DropdownMenu>
                                          ) : (
                                            // Mostrar botones individuales según el filtro
                                            actionButtons.map((button, index) => (
                                              <Button
                                                key={index}
                                                type="button"
                                                variant={
                                                  "className" in button &&
                                                    button.className?.includes("red")
                                                    ? "destructive"
                                                    : "outline"
                                                }
                                                size="sm"
                                                onClick={button.onClick}
                                                title={button.label}
                                                className={
                                                  "className" in button
                                                    ? button.className
                                                    : undefined
                                                }
                                              >
                                                {button.icon}
                                              </Button>
                                            ))
                                          )}
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </form>
      </ScrollArea>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar factura?</DialogTitle>
            <DialogDescription>
              Esta acción eliminará permanentemente el archivo XML, el archivo
              adjunto y todos los datos asociados. Esta acción no se puede
              deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteInvoice}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog for Attachments */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vista previa del archivo adjunto</DialogTitle>
          </DialogHeader>
          {selectedInvoice && selectedInvoice.attachment_file_url && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-2 w-full sm:w-auto overflow-hidden">
                  {getFileIcon(selectedInvoice.attachment_file_type)}
                  <span className="font-medium truncate">
                    {selectedInvoice.attachment_file_name}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-none"
                    onClick={() => downloadAttachment(selectedInvoice!)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Descargar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-none"
                    onClick={() =>
                      viewFile(selectedInvoice!.attachment_file_url!)
                    }
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">Abrir en nueva pestaña</span>
                    <span className="sm:hidden">Abrir</span>
                  </Button>
                </div>
              </div>

              <div className="border rounded-lg overflow-auto max-h-[60vh] relative min-h-[200px] flex items-center justify-center bg-muted/10">
                {isLoadingPreview ? (
                  <div className="flex flex-col items-center justify-center p-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                    <p className="text-sm text-muted-foreground">Generando acceso seguro...</p>
                  </div>
                ) : previewUrl ? (
                  <>
                    {selectedInvoice.attachment_file_type === "pdf" ? (
                      <iframe
                        src={previewUrl}
                        className="w-full h-[400px]"
                        title={selectedInvoice.attachment_file_name || "PDF"}
                      />
                    ) : selectedInvoice.attachment_file_type === "image" ? (
                      <div className="flex items-center justify-center p-4">
                        <img
                          src={previewUrl}
                          alt={selectedInvoice.attachment_file_name || "Imagen"}
                          className="max-w-full max-h-[400px] object-contain"
                        />
                      </div>
                    ) : (
                      <div className="p-8 text-center">
                        <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">
                          Vista previa no disponible para este tipo de archivo
                        </p>
                        <Button
                          variant="outline"
                          className="mt-4"
                          onClick={() =>
                            viewFile(selectedInvoice!.attachment_file_url!)
                          }
                        >
                          Abrir archivo
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-12 text-center text-red-500">
                    No se pudo cargar el archivo seguro.
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
