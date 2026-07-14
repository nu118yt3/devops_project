import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';


interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

interface ProjectContextType {
  project: Project | null;
  setProject: (project: Project | null) => void;
  loading: boolean;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};

interface ProjectProviderProps {
  children: ReactNode;
}

export const ProjectProvider: React.FC<ProjectProviderProps> = ({ children }) => {
  const [project, setProject] = useState<Project | null>(() => {
    // Recuperar proyecto del localStorage si existe
    const savedProject = localStorage.getItem('selectedProject');
    return savedProject ? JSON.parse(savedProject) : null;
  });
  const [loading] = useState(false);

  const handleSetProject = (newProject: Project | null) => {
    if (newProject) {
      localStorage.setItem('selectedProject', JSON.stringify(newProject));
    } else {
      localStorage.removeItem('selectedProject');
    }
    setProject(newProject);
  };

  return (
    <ProjectContext.Provider value={{ project, setProject: handleSetProject, loading }}>
      {children}
    </ProjectContext.Provider>
  );
};