import { useChain, CHAINS, type Chain } from "@/lib/chain-context";
import { Button } from "@/components/ui/button";

export function ChainSwitcher() {
  const { chain, setChain } = useChain();

  return (
    <div className="space-y-1">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider px-2 mb-1">Chain</p>
      {(Object.keys(CHAINS) as Chain[]).map((c) => {
        const info = CHAINS[c];
        const isActive = chain === c;
        return (
          <button
            key={c}
            onClick={() => setChain(c)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
              isActive
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${
              c === "mainchain" ? "bg-blue-400" : c === "esc" ? "bg-purple-400" : "bg-amber-400"
            }`} />
            <span>{info.shortName}</span>
            {!info.hasSnapshots && (
              <span className="text-[9px] text-muted-foreground ml-auto">limited</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
