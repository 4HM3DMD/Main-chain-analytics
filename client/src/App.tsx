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
import { Camera, RefreshCw } from "lucide-react";

import Dashboard from "@/pages/dashboard";
import Flows from "@/pages/flows";
import History from "@/pages/history";
import Compare from "@/pages/compare";
import AddressDetail from "@/pages/address-detail";
import Movers from "@/pages/movers";
import HallOfFame from "@/pages/hall-of-fame";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
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
