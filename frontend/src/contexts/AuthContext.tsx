import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '../types';
import supabase from '../utils/supabase';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // Function to fetch extended user data
    const fetchUserData = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                // If the user is authenticated but not in the users table, we shouldn't block the app.
                console.warn("Could not fetch user profile details:", error.message);
                return null;
            }
            return data;
        } catch (error) {
            console.error('Error fetching user data:', error);
            return null;
        }
    };

    useEffect(() => {
        let mounted = true;
        let initialCheckDone = false;

        const handleAuthChange = async (session: any, source: string) => {
            if (!mounted) return;
            console.log(`Auth update from ${source}:`, session?.user?.email || 'No user');

            if (session?.user) {
                const userData = await fetchUserData(session.user.id);
                if (mounted) {
                    setUser({
                        id: session.user.id,
                        email: session.user.email!,
                        user_metadata: {
                            role: userData?.role || 'employee',
                            name: userData?.name || session.user.email?.split('@')[0] || 'User'
                        }
                    });
                    setLoading(false);
                    initialCheckDone = true;
                }
            } else {
                // Only set loading to false if we are sure there is no session
                // We'll wait for the initial getSession to finish before deciding it's null
                if (source === 'getSession' || initialCheckDone) {
                    setUser(null);
                    setLoading(false);
                    initialCheckDone = true;
                }
            }
        };

        // Initial check
        supabase.auth.getSession().then(({ data: { session } }) => {
            handleAuthChange(session, 'getSession');
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                handleAuthChange(session, `onAuthStateChange:${event}`);
            }
        );

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const signIn = async (email: string, password: string) => {
        try {
            // setLoading(true); // Optional: global loading on sign in
            const { error, data } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) throw error;

            if (data.user) {
                const userData = await fetchUserData(data.user.id);
                setUser({
                    id: data.user.id,
                    email: data.user.email!,
                    user_metadata: {
                        role: userData?.role || 'employee',
                        name: userData?.name || data.user.email?.split('@')[0] || 'User'
                    }
                });
            }
        } catch (error) {
            console.error('Sign in error:', error);
            throw error;
        }
    };

    const signOut = async () => {
        try {
            await supabase.auth.signOut();
            setUser(null);
            localStorage.clear(); // Be careful clearing all localstorage if other things use it
        } catch (error) {
            console.error("Sign out error:", error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};