
export interface User {
    id: string;
    email: string;
    user_metadata: {
        role: 'admin' | 'employee';
        name: string;
    };
}

export interface Project {
    id: string;
    name: string;
    description?: string;
    created_at: string;
    created_by: string;
}

export interface ProjectData {
    overview: string;
    team: string[];
    schedule: {
        start_date: string;
        end_date: string;
        milestones: string[];
    };
}