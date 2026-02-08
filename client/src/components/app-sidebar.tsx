import { useLocation, Link } from "wouter";
import { LayoutDashboard, Calendar, ArrowLeftRight, TrendingUp, Trophy, Activity, BarChart3, Ghost, Building2 } from "lucide-react";
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
import { ChainSwitcher } from "@/components/chain-switcher";
import { useChain } from "@/lib/chain-context";

const navItems = [
  { title: "Dashboard", path: "", icon: LayoutDashboard },
  { title: "Analytics", path: "analytics", icon: BarChart3 },
  { title: "Shadow Entries", path: "ghost-wallets", icon: Ghost },
  { title: "Entities", path: "entities", icon: Building2 },
  { title: "Flows", path: "flows", icon: Activity },
  { title: "History", path: "history", icon: Calendar },
  { title: "Compare", path: "compare", icon: ArrowLeftRight },
  { title: "Movers", path: "movers", icon: TrendingUp },
  { title: "Hall of Fame", path: "hall-of-fame", icon: Trophy },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { chain, chainInfo } = useChain();
  const base = `/${chain}`;

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href={base} data-testid="link-logo">
          <div className="flex items-center gap-2">
            <img src="/android-chrome-192x192.png" alt="" className="w-8 h-8 rounded-md" />
            <div>
              <h1 className="text-sm font-semibold leading-tight">ELA Whale Tracker</h1>
              <p className={`text-xs leading-tight ${chainInfo.color}`}>{chainInfo.name}</p>
            </div>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {/* Chain Switcher */}
        <SidebarGroup>
          <SidebarGroupContent>
            <div className="px-2">
              <ChainSwitcher />
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const href = item.path ? `${base}/${item.path}` : base;
                const isActive = location === href || (item.path && location.startsWith(`${base}/${item.path}`));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={href} data-testid={`link-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
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
