
import { useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import React, { useState } from "react"
import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const LoginForm: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const { signIn } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await signIn(email, password);
            navigate('/dashboard');
        } catch (error: any) {
            setError(error.message || 'Error al iniciar sesión');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={cn("flex flex-col gap-6 bg-card text-card-foreground p-8 rounded-xl shadow-xl border z-50")}>
            <form onSubmit={handleSubmit}>
                <FieldGroup>
                    <div className="flex flex-col items-center gap-2 text-center">
                        <a
                            href="#"
                            className="flex flex-col items-center gap-2 font-medium"
                        >
                            <div className="flex size-8 items-center justify-center rounded-md">
                            </div>
                            <img src="./src/assets/logo.svg" alt="Logo" />
                        </a>
                        <h1 className="text-xl font-bold">Welcome to Acme Inc.</h1>
                    </div>
                    {error && <div className="text-red-500 text-sm text-center">{error}</div>}
                    <Field>
                        <FieldLabel htmlFor="email">Email</FieldLabel>
                        <Input
                            id="email"
                            type="email"
                            placeholder="someone@example.com"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="bg-background"
                        />
                    </Field>
                    <Field>
                        <FieldLabel htmlFor="password">Password</FieldLabel>
                        <Input
                            id="password"
                            type="password"
                            placeholder="* * * * * * * *"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="bg-background"
                        />
                    </Field>
                    <Field>
                        <Button type="submit" disabled={loading}>{loading ? 'Loading...' : 'Login'}</Button>
                    </Field>
                </FieldGroup>
            </form>
            <FieldDescription className="px-6 text-center">
                By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
                and <a href="#">Privacy Policy</a>.
            </FieldDescription>
        </div>
    )
}

export default LoginForm;