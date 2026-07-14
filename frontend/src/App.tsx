import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./components/login/page";
import DashboardPage from "./components/dashboard/page";
import { ProjectList } from "./components/projectList/projectList";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import DashboardHome from "./components/dashboard/dashboard-home";
import { UsersPage } from "./components/dashboard/users/users";
import ChatsPage from "./components/dashboard/chats/chats";
import { ProjectProvider, useProject } from "./contexts/ProjectContext";
import { PlanosList } from "./components/dashboard/Arquitectura/nav-planos";
import { Toaster } from "sonner";
import FacturasPage from "./components/dashboard/facturas/facturas";
import BitacoraForm from "./components/dashboard/bitacora/BitacoraForm";
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const { user, loading } = useAuth();
    console.log("ProtectedRoute - State:", { loading, user: user?.email });

    if (loading) {
        return <div className="flex h-screen w-full items-center justify-center">Loading...</div>;
    }

    if (!user) {
        console.log("ProtectedRoute - Redirecting to /login because no user found.");
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
    const { user, loading } = useAuth();
    console.log("PublicRoute - State:", { loading, user: user?.email });

    if (loading) {
        return <div className="flex h-screen w-full items-center justify-center">Loading...</div>;
    }

    if (user) {
        console.log("PublicRoute - Redirecting to /projects because user is logged in.");
        return <Navigate to="/projects" replace />;
    }

    return <>{children}</>;
};

// Nuevo componente para verificar si hay un proyecto seleccionado
const ProjectRequiredRoute = ({ children }: { children: React.ReactNode }) => {
    const { project, loading: projectLoading } = useProject(); // Necesitarás crear este hook

    if (projectLoading) {
        return <div className="flex h-screen w-full items-center justify-center">Loading project...</div>;
    }

    if (!project) {
        console.log("ProjectRequiredRoute - Redirecting to /projects because no project selected.");
        return <Navigate to="/projects" replace />;
    }

    return <>{children}</>;
};

export function App() {
    return (
        <AuthProvider>
            <ProjectProvider>
                <Routes>
                    <Route path="/" element={<Navigate to="/projects" replace />} />
                    <Route path="/login" element={
                        <PublicRoute>
                            <LoginPage />
                        </PublicRoute>
                    } />
                    <Route path="/projects" element={
                        <ProtectedRoute>
                            <ProjectList />
                        </ProtectedRoute>
                    } />
                    <Route path="/dashboard" element={
                        <ProtectedRoute>
                            <ProjectRequiredRoute>
                                <DashboardPage />
                            </ProjectRequiredRoute>
                        </ProtectedRoute>
                    }>
                        <Route index element={<DashboardHome />} />
                        <Route path="users" element={<UsersPage />} />
                        <Route path="chats" element={<ChatsPage />} />
                        <Route path="planos" element={<PlanosList />} />
                        <Route path="facturas" element={<FacturasPage />} />
                        <Route path="bitacora" element={<BitacoraForm />} />
                    </Route>
                </Routes>
                <Toaster richColors position="top-center" />
            </ProjectProvider>
        </AuthProvider>
    );
}

export default App;