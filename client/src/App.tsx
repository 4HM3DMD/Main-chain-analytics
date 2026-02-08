import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/lib/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, RefreshCw, Search } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";

import Dashboard from "@/pages/dashboard";
import Flows from "@/pages/flows";
import History from "@/pages/history";
import Compare from "@/pages/compare";
import AddressDetail from "@/pages/address-detail";
import Movers from "@/pages/movers";
import HallOfFame from "@/pages/hall-of-fame";
import Analytics from "@/pages/analytics";
import GhostWallets from "@/pages/ghost-wallets";
import Entities from "@/pages/entities";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/ghost-wallets" component={GhostWallets} />
      <Route path="/entities" component={Entities} />
      <Route path="/flows" component={Flows} />
      <Route path="/history" component={History} />
      <Route path="/compare" component={Compare} />
      <Route path="/address/:address" component={AddressDetail} />
      <Route path="/movers" component={Movers} />
      <Route path="/hall-of-fame" component={HallOfFame} />
      <Route component={NotFound} />
    </Switch>
  );
}

function HeaderSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ address: string; label: string | null; category: string | null }>>([]);
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 3) { setResults([]); return; }
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results || []);
        setOpen(true);
      } catch { setResults([]); }
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          placeholder="Search address or label..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          className="pl-8 h-8 w-44 sm:w-56 text-xs"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 right-0 w-80 bg-popover border rounded-md shadow-lg z-50 max-h-64 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.address}
              className="w-full text-left px-3 py-2 hover:bg-accent transition-colors border-b last:border-0"
              onClick={() => {
                navigate(`/address/${r.address}`);
                setOpen(false);
                setQuery("");
              }}
            >
              {r.label && (
                <span className="text-xs font-medium block">{r.label}</span>
              )}
              <span className="text-xs font-mono text-muted-foreground">{r.address}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function HeaderBar() {
  const { toast } = useToast();

  const triggerMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/snapshots/trigger");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Snapshot triggered", description: "A new snapshot has been taken." });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/snapshots"] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <header className="flex items-center justify-between gap-2 p-3 border-b sticky top-0 z-50 bg-background/95 backdrop-blur">
      <div className="flex items-center gap-2">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
        <h1 className="text-sm font-semibold hidden sm:block">ELA Whale Tracker</h1>
      </div>
      <div className="flex items-center gap-2">
        <HeaderSearch />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => triggerMutation.mutate()}
          disabled={triggerMutation.isPending}
          data-testid="button-trigger-snapshot"
        >
          {triggerMutation.isPending ? (
            <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <Camera className="w-3.5 h-3.5 mr-1.5" />
          )}
          <span className="hidden sm:inline">Snapshot</span>
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}

function App() {
  const style = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <SidebarProvider style={style as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1 min-w-0">
                <HeaderBar />
                <main className="flex-1 overflow-y-auto">
                  <Router />
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
