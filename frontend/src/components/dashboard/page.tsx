import { Outlet } from "react-router-dom"
import { AppSidebar } from "./sidebar/app-sidebar"
import { SiteHeader } from "./header/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export const iframeHeight = "800px"

export const description = "A sidebar with a header and a search form."

export default function Page() {
    return (
        <div className="[--header-height:calc(--spacing(14))]">
            <SidebarProvider className="flex flex-col">
                <SiteHeader />
                <div className="flex flex-1">
                    <AppSidebar />
                    <SidebarInset>
                        <Outlet />
                    </SidebarInset>
                </div>
            </SidebarProvider>
        </div>
    )
}
