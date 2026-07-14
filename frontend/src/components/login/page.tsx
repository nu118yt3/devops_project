import LoginForm from "./login-form"
import LoginBackground from "./LoginBackground"

export default function LoginPage() {
    return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10 relative overflow-hidden">
            <LoginBackground />
            <div className="w-full max-w-sm relative z-10">
                <LoginForm />
            </div>
        </div>
    )
}
