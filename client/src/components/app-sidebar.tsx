import { useLocation, Link } from "wouter";
import { LayoutDashboard, Calendar, ArrowLeftRight, TrendingUp, Trophy, Activity, BarChart3, Ghost, Building2, Layers } from "lucide-react";
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
  { title: "Dashboard", path: "", icon: LayoutDashboard, requiresSnapshots: false },
  { title: "Analytics", path: "analytics", icon: BarChart3, requiresSnapshots: true },
  { title: "Shadow Entries", path: "ghost-wallets", icon: Ghost, requiresSnapshots: true },
  { title: "Entities", path: "entities", icon: Building2, requiresSnapshots: false },
  { title: "Flows", path: "flows", icon: Activity, requiresSnapshots: true },
  { title: "History", path: "history", icon: Calendar, requiresSnapshots: true },
  { title: "Compare", path: "compare", icon: ArrowLeftRight, requiresSnapshots: true },
  { title: "Movers", path: "movers", icon: TrendingUp, requiresSnapshots: true },
  { title: "Hall of Fame", path: "hall-of-fame", icon: Trophy, requiresSnapshots: true },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { chain, chainInfo } = useChain();
  const base = `/${chain}`;

  // Filter navigation items based on chain capabilities
  const visibleNavItems = navItems.filter(item => {
    // If item doesn't require snapshots, always show it
    if (!item.requiresSnapshots) return true;
    
    // Otherwise, only show if chain has snapshots
    return chainInfo.hasSnapshots;
  });

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

        {/* Cross-Chain Overview */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/cross-chain"}>
                  <Link href="/cross-chain">
                    <Layers className="w-4 h-4" />
                    <span>Cross-Chain</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleNavItems.map((item) => {
                const href = item.path ? `${base}/${item.path}` : base;
                const isActive = location === href || (!!item.path && location.startsWith(`${base}/${item.path}`));
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
