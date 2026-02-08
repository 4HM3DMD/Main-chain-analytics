import { useLocation, Link } from "wouter";
import { LayoutDashboard, Calendar, ArrowLeftRight, TrendingUp, Trophy, Activity, BarChart3, Ghost, Building2, Layers, Cpu } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Shadow Entries", url: "/ghost-wallets", icon: Ghost },
  { title: "Entities", url: "/entities", icon: Building2 },
  { title: "Flows", url: "/flows", icon: Activity },
  { title: "History", url: "/history", icon: Calendar },
  { title: "Compare", url: "/compare", icon: ArrowLeftRight },
  { title: "Movers", url: "/movers", icon: TrendingUp },
  { title: "Hall of Fame", url: "/hall-of-fame", icon: Trophy },
  { title: "ESC Chain", url: "/esc", icon: Cpu },
  { title: "Cross-Chain", url: "/cross-chain", icon: Layers },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/" data-testid="link-logo">
          <div className="flex items-center gap-2">
            <img src="/android-chrome-192x192.png" alt="" className="w-8 h-8 rounded-md" />
            <div>
              <h1 className="text-sm font-semibold leading-tight">ELA Whale Tracker</h1>
              <p className="text-xs text-muted-foreground leading-tight">Top 100 Wallets</p>
            </div>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Powered by Elastos Blockchain</p>
          <p>Snapshots every 5 minutes</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
