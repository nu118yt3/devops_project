import { useEffect, useState } from "react"
import { Plus, Pencil, Trash2, Search, User as UserIcon, Loader2, Mail, Lock } from "lucide-react"
import supabase, { supabaseUrl, supabaseKey } from "@/utils/supabase"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetFooter,
    SheetClose
} from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

// Define types based on our knowledge
interface UserProfile {
    id: string;
    full_name: string; // Changed from name to full_name
    role: string;
    email?: string;
    created_at?: string;
}

export function UsersPage() {
    const [users, setUsers] = useState<UserProfile[]>([])
    const [loading, setLoading] = useState(true)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    const [searchTerm, setSearchTerm] = useState("")

    // Form state
    const [isSheetOpen, setIsSheetOpen] = useState(false)
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null)
    const [formData, setFormData] = useState({
        full_name: "", // Changed from name
        email: "",
        role: "employee",
        password: ""
    })
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        fetchUsers()
    }, [])

    const fetchUsers = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) {
                // Fallback if created_at doesn't exist, try without order
                console.warn("Sorting failed, trying without sort", error)
                const { data: retryData, error: retryError } = await supabase.from('users').select('*')
                if (retryError) throw retryError
                setUsers(retryData || [])
            } else {
                setUsers(data || [])
            }
        } catch (error: any) {
            console.error('Error fetching users:', error)
            setMessage({ type: 'error', text: error.message || "Failed to fetch users" })
        } finally {
            setLoading(false)
        }
    }

    const handleSheetOpen = (user?: UserProfile) => {
        if (user) {
            setEditingUser(user)
            setFormData({
                full_name: user.full_name || "", // Changed from name
                email: user.email || "",
                role: user.role || "employee",
                password: "" // Password usually not retrievable
            })
        } else {
            setEditingUser(null)
            setFormData({
                full_name: "", // Changed from name
                email: "",
                role: "employee",
                password: ""
            })
        }
        setIsSheetOpen(true)
        setMessage(null)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)
        setMessage(null)

        try {
            if (editingUser) {
                // Update
                // First update the database record
                const updates: any = {
                    full_name: formData.full_name, // Changed from name
                    role: formData.role,
                    email: formData.email,
                    password: formData.password
                }

                const { error: dbError } = await supabase
                    .from('users')
                    .update(updates)
                    .eq('id', editingUser.id)

                if (dbError) throw dbError

                // If password is provided, we would ideally update auth, but client-side limitations apply.
                if (formData.password && formData.password.trim().length > 0) {
                    setMessage({ type: 'success', text: "User profile updated. Note: Password update requires admin privileges or self-update." })
                } else {
                    setMessage({ type: 'success', text: "User updated successfully" })
                }
            } else {
                // Create
                if (!formData.email || !formData.password) {
                    throw new Error("Email and Password are required for new users")
                }

                const tempSupabase = createClient(supabaseUrl, supabaseKey, {
                    auth: {
                        persistSession: false,
                        autoRefreshToken: false,
                        detectSessionInUrl: false
                    }
                })

                const { data: authData, error: authError } = await tempSupabase.auth.signUp({
                    email: formData.email,
                    password: formData.password,
                    options: {
                        data: {
                            full_name: formData.full_name, // Changed from name
                            role: formData.role
                        }
                    }
                })

                if (authError) throw authError

                if (authData.user) {
                    // 2. Create User in 'users' table if not triggered automatically
                    // Check if row exists first? Or just insert and ignore duplicate if trigger exists?
                    // We'll try to insert. If id matches auth user, good.

                    const { error: dbError } = await supabase
                        .from('users')
                        .insert([{
                            id: authData.user.id,
                            full_name: formData.full_name, // Changed from name
                            role: formData.role,
                            email: formData.email
                        }])

                    if (dbError) {
                        // If duplicte key error, it means a trigger might have already created it.
                        console.warn("DB Insert might have failed or duplicated:", dbError)
                    }
                }

                setMessage({ type: 'success', text: "User created successfully" })
            }
            setIsSheetOpen(false)
            fetchUsers()

        } catch (error: any) {
            console.error('Error saving user:', error)
            setMessage({ type: 'error', text: error.message || "Failed to save user" })
        } finally {
            setIsSubmitting(false)
        }
    }


    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure? This will permanently delete the user and their account.")) return

        try {
            // Get the current session (ensure user is logged in as admin)
            const { data: { session } } = await supabase.auth.getSession()

            if (!session) {
                throw new Error('You must be logged in as an admin')
            }

            const response = await fetch('https://xxkmotspyohddsvszxbs.supabase.co/functions/v1/delete-users-auth', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,  // This satisfies the JWT check
                },
                body: JSON.stringify({ id }),
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'Failed to delete user')
            }

            setMessage({ type: 'success', text: 'User and account permanently deleted.' })
            fetchUsers()
        } catch (error: any) {
            console.error(error)
            setMessage({ type: 'error', text: error.message || 'Failed to delete user' })
        }
    }

    const filteredUsers = users.filter(user =>
        (user.full_name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
        (user.email?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
        (user.role?.toLowerCase() || "").includes(searchTerm.toLowerCase())
    )
    return (
        <div className="space-y-6 p-6 max-w-7xl mx-auto w-full">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Users</h1>
                    <p className="text-muted-foreground mt-1">Manage your team members and their roles.</p>
                </div>
                <Button onClick={() => handleSheetOpen()} className="bg-primary hover:bg-primary/90 cursor-pointer">
                    <Plus className="mr-2 h-4 w-4" /> Add User
                </Button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search users..."
                        className="pl-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Message Area */}
            {message && (
                <div className={`p-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                    {message.text}
                </div>
            )}

            {/* List */}
            {/* Desktop Table View */}
            <Card className="hidden md:block border-border/50 shadow-sm">
                <CardHeader className="p-0">
                    {/* Optional Header content for card if needed */}
                </CardHeader>
                <CardContent className="p-0">
                    <div className="relative w-full overflow-auto">
                        <table className="w-full caption-bottom text-sm text-left">
                            <thead className="[&_tr]:border-b">
                                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground">User</th>
                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Role</th>
                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Created At</th>
                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="[&_tr:last-child]:border-0">
                                {loading ? (
                                    <tr>
                                        <td colSpan={4} className="h-24 text-center">
                                            <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                                <Loader2 className="h-4 w-4 animate-spin" /> Loading users...
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="h-24 text-center text-muted-foreground">
                                            No users found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredUsers.map((user) => (
                                        <tr key={user.id} className="border-b transition-colors hover:bg-muted/50">
                                            <td className="p-4 align-middle">
                                                <div className="flex items-center gap-3">
                                                    <Avatar>
                                                        <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.full_name}`} />
                                                        <AvatarFallback><UserIcon className="h-4 w-4" /></AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <div className="font-medium">{user.full_name}</div>
                                                        <div className="text-xs text-muted-foreground">{user.email || "No email"}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle">
                                                <Badge variant="secondary" className="capitalize">
                                                    {user.role}
                                                </Badge>
                                            </td>
                                            <td className="p-4 align-middle text-muted-foreground">
                                                {user.created_at ? new Date(user.created_at).toLocaleDateString() : "-"}
                                            </td>
                                            <td className="p-4 align-middle text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button variant="ghost" size="icon" onClick={() => handleSheetOpen(user)} className="cursor-pointer">
                                                        <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(user.id)} className="cursor-pointer">
                                                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-500" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Mobile Card View */}
            <div className="grid gap-4 md:hidden">
                {loading ? (
                    <div className="text-center py-4 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading users...
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                        No users found.
                    </div>
                ) : (
                    filteredUsers.map((user) => (
                        <Card key={user.id} className="border-border/50 shadow-sm">
                            <CardContent className="p-4">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.full_name}`} />
                                            <AvatarFallback><UserIcon className="h-4 w-4" /></AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <div className="font-semibold">{user.full_name}</div>
                                            <div className="text-xs text-muted-foreground">{user.email}</div>
                                        </div>
                                    </div>
                                    <Badge variant="secondary" className="capitalize">
                                        {user.role}
                                    </Badge>
                                </div>
                                <div className="flex items-center justify-between text-muted-foreground text-sm">
                                    <span>Joined {user.created_at ? new Date(user.created_at).toLocaleDateString() : "-"}</span>
                                    <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => handleSheetOpen(user)} className="h-8 w-8 cursor-pointer">
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(user.id)} className="h-8 w-8 cursor-pointer">
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Add/Edit Sheet */}
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetContent>
                    <SheetHeader>
                        <SheetTitle>{editingUser ? 'Edit User' : 'Add New User'}</SheetTitle>
                        <SheetDescription>
                            {editingUser ? 'Make changes to the user profile here.' : 'Fill in the details to create a new user.'}
                        </SheetDescription>
                    </SheetHeader>
                    <form onSubmit={handleSubmit} className="mt-6 space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="name">Full Name</Label>
                            <Input
                                id="name"
                                placeholder="John Doe"
                                value={formData.full_name} // Changed from name
                                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} // Changed from name
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <div className="relative">
                                <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="john@example.com"
                                    className="pl-9"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">
                                {editingUser ? 'Password (Leave blank to keep current)' : 'Password'}
                            </Label>
                            <div className="relative">
                                <Lock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder={editingUser ? "••••••••" : "Minimum 6 characters"}
                                    className="pl-9"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    required={!editingUser}
                                    minLength={6}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="role">Role</Label>
                            <Select
                                value={formData.role}
                                onValueChange={(value) => setFormData({ ...formData, role: value })}
                            >
                                <SelectTrigger id="role">
                                    <SelectValue placeholder="Select a role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="employee">Employee</SelectItem>
                                    <SelectItem value="manager">Manager</SelectItem>
                                    <SelectItem value="intern">Intern</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <SheetFooter>
                            <SheetClose asChild>
                                <Button variant="outline" type="button" className="cursor-pointer">Cancel</Button>
                            </SheetClose>
                            <Button type="submit" disabled={isSubmitting} className="cursor-pointer">
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {editingUser ? 'Save Changes' : 'Create User'}
                            </Button>
                        </SheetFooter>
                    </form>
                </SheetContent>
            </Sheet>
        </div>
    )
}
