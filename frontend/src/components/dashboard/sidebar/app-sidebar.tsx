"use client";

import * as React from "react";
import {
  BanknoteArrowDown,
  BanknoteArrowUp,
  BookUser,
  CalendarClock,
  Camera,
  CircleDollarSign,
  Clipboard,
  Container,
  FileCodeCorner,
  Gavel,
  Handshake,
  HardHat,
  Landmark,
  LandPlot,
  LifeBuoy,
  ListCheck,
  LoaderCircle,
  MessageSquareText,
  Presentation,
  Radio,
  Scale,
  ScrollText,
  Send,
  ShieldPlus,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import Logo from "@/assets/logo.svg";

import { NavMain } from "./nav-main";
import { NavPresentacion } from "./nav-projects";
import { NavPlaneacion } from "./nav-plan";
import { NavObra } from "./nav-obra";
import { NavFinanzas } from "./nav-finanzas";
import { NavUser } from "./nav-user";
import { NavPlataforma } from "./nav-plataforma";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

import { useAuth } from "@/hooks/useAuth";
import { useProject } from "@/contexts/ProjectContext";
import { NavLegal } from "./nav-legal";

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Arquitectura",
      url: "#",
      icon: Landmark,
      isActive: false,
      items: [
        {
          title: "Planos",
          url: "/dashboard/planos",
        },
        {
          title: "Evaluación",
          url: "#",
        },
      ],
    },
    {
      title: "Ingenieria",
      url: "#",
      icon: HardHat,
      items: [
        {
          title: "Planos",
          url: "#",
        },
        {
          title: "Cálculos",
          url: "#",
        },
        {
          title: "Taller",
          url: "#",
        },
      ],
    },
    {
      title: "Presupuesto",
      url: "#",
      icon: CircleDollarSign,
      items: [
        {
          title: "Gasto",
          url: "#",
        },
        {
          title: "Calidad",
          url: "#",
        },
      ],
    },
    {
      title: "Chats",
      url: "#",
      icon: MessageSquareText,
      items: [
        {
          title: "Mensajes",
          url: "/dashboard/chats",
        },
        {
          title: "Contactos",
          url: "#",
        },
      ],
    },
  ],
  navPlaneacion: [
    {
      title: "Cronograma de Proyecto",
      url: "#",
      icon: CalendarClock,
    },
    {
      title: "Avance",
      url: "#",
      icon: LoaderCircle,
    },
  ],
  navObra: [
    {
      title: "Programa de Obra",
      url: "#",
      icon: ScrollText,
    },
    {
      title: "Control de Obra",
      url: "#",
      icon: ListCheck,
      isActive: false,
      items: [
        {
          title: "Bitacora",
          url: "/dashboard/bitacora",
        },
        {
          title: "Licencias",
          url: "#",
        },
        {
          title: "Altas Bajas de Seguro",
          url: "#",
        },
        {
          title: "Laboratorios",
          url: "#",
        },
      ],
    },
    {
      title: "Suministros",
      url: "#",
      icon: Container,
      isActive: false,
      items: [
        {
          title: "Materiales",
          url: "#",
        },
        {
          title: "Mano de Obra",
          url: "#",
        },
        {
          title: "Control de Inventario",
          url: "#",
        },
        {
          title: "Almacen",
          url: "#",
        },
        {
          title: "Uso y Suministros",
          url: "#",
        },
      ],
    },
    {
      title: "Fotografías de Sitio",
      url: "#",
      icon: Camera,
    },
  ],
  navFinanzas: [
    {
      title: "Facturas",
      url: "/dashboard/facturas",
      icon: FileCodeCorner,
    },
    {
      title: "Ingreso",
      url: "#",
      icon: BanknoteArrowUp,
    },
    {
      title: "Egreso",
      url: "#",
      icon: BanknoteArrowDown,
    },
    {
      title: "Fiscal",
      url: "#",
      icon: Scale,
    },
    {
      title: "Relaciones",
      url: "#",
      icon: Handshake,
    },
    {
      title: "Mercadotecnia",
      url: "#",
      icon: Presentation,
    },
  ],
  navPresentacion: [
    {
      title: "Reportes",
      url: "#",
      icon: Clipboard,
    },
    {
      title: "Solicitudes",
      url: "#",
      icon: Radio,
    },
  ],
  navPlataforma: [
    {
      title: "Usuarios",
      url: "#",
      icon: BookUser,
      items: [
        {
          title: "Administrar Usuarios",
          url: "/dashboard/users",
        },
      ],
    },
    {
      title: "Soporte",
      url: "#",
      icon: LifeBuoy,
    },
    {
      title: "Feedback",
      url: "#",
      icon: Send,
    },
  ],
  navLegal: [
    {
      title: "Seguimiento Legal Financiero",
      url: "#",
      icon: Gavel,
    },
    {
      title: "Permisos",
      url: "#",
      icon: LandPlot,
    },
    {
      title: "Seguro",
      url: "#",
      icon: ShieldPlus,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth();
  const { isMobile, setOpenMobile } = useSidebar()
  const { project: currentProject, setProject: setCurrentProject } = useProject();


  const navigate = useNavigate();
  const handleSwitchProject = () => {
    setCurrentProject(null);
    navigate("/projects");
  };

  if (!currentProject) return null;

  return (
    <Sidebar className="top-(--header-height) h-[calc(100svh-var(--header-height))]!" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              onClick={() => {
                if (isMobile) setOpenMobile(false)
              }}
            >
              <Link to="/dashboard">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <img src={Logo} alt="Acme Inc Logo" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {currentProject ? currentProject.name : "Acme Inc"}
                  </span>
                  <span
                    className="truncate text-xs cursor-pointer hover:underline"
                    onClick={handleSwitchProject}
                  >
                    Cambiar de proyecto
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavPresentacion items={data.navPresentacion} />
        <NavPlaneacion items={data.navPlaneacion} />
        <NavObra items={data.navObra} />
        <NavLegal items={data.navLegal} />
        <NavFinanzas items={data.navFinanzas} />
        <NavPlataforma items={data.navPlataforma} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={
            user
              ? {
                name: user.user_metadata.name || "User",
                email: user.email,
                avatar: "",
              }
              : data.user
          }
        />
      </SidebarFooter>
    </Sidebar>
  );
}
