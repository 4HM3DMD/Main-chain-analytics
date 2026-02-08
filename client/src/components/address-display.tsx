import { Copy, Check, ExternalLink } from "lucide-react";
import { useState } from "react";
import { truncateAddress, getCategoryColor } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const EXPLORER_URL = "https://blockchain.elastos.io/address";

interface AddressDisplayProps {
  address: string;
  label?: string | null;
  category?: string | null;
  truncate?: boolean;
  showCopy?: boolean;
  showExplorer?: boolean;
}

export function AddressDisplay({ address, label, category, truncate = true, showCopy = true, showExplorer = false }: AddressDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0">
        {label && (
          <Badge variant="outline" className={`text-xs mb-0.5 no-default-hover-elevate no-default-active-elevate ${getCategoryColor(category ?? null)}`}>
            {label}
          </Badge>
        )}
        <p className="font-mono text-xs text-muted-foreground truncate">
          {truncate ? truncateAddress(address) : address}
        </p>
      </div>
      {showCopy && (
        <Button variant="ghost" size="icon" onClick={handleCopy} className="shrink-0 w-6 h-6"
          data-testid={`button-copy-${address.slice(0, 6)}`}>
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
        </Button>
      )}
      {showExplorer && (
        <a href={`${EXPLORER_URL}/${address}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="shrink-0 w-6 h-6">
            <ExternalLink className="w-3 h-3" />
          </Button>
        </a>
      )}
    </div>
  );
}
