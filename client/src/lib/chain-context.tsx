import { createContext, useContext, useState, type ReactNode } from "react";

export type Chain = "mainchain" | "esc" | "ethereum";

export interface ChainInfo {
  id: Chain;
  name: string;
  shortName: string;
  explorerUrl: string;
  color: string;
  hasSnapshots: boolean; // false for ethereum (no richlist API)
}

export const CHAINS: Record<Chain, ChainInfo> = {
  mainchain: {
    id: "mainchain",
    name: "ELA Main Chain",
    shortName: "Main",
    explorerUrl: "https://blockchain.elastos.io/address",
    color: "text-blue-400",
    hasSnapshots: true,
  },
  esc: {
    id: "esc",
    name: "Elastos Smart Chain",
    shortName: "ESC",
    explorerUrl: "https://esc.elastos.io/address",
    color: "text-purple-400",
    hasSnapshots: true,
  },
  ethereum: {
    id: "ethereum",
    name: "Ethereum (ERC-20)",
    shortName: "ETH",
    explorerUrl: "https://etherscan.io/address",
    color: "text-amber-400",
    hasSnapshots: false,
  },
};

interface ChainContextType {
  chain: Chain;
  chainInfo: ChainInfo;
  setChain: (chain: Chain) => void;
  chainParam: string; // "?chain=esc" or "" for mainchain
}

const ChainContext = createContext<ChainContextType>({
  chain: "mainchain",
  chainInfo: CHAINS.mainchain,
  setChain: () => {},
  chainParam: "",
});

export function ChainProvider({ children }: { children: ReactNode }) {
  const [chain, setChain] = useState<Chain>("mainchain");

  const chainInfo = CHAINS[chain];
  const chainParam = chain === "mainchain" ? "" : `?chain=${chain}`;

  return (
    <ChainContext.Provider value={{ chain, chainInfo, setChain, chainParam }}>
      {children}
    </ChainContext.Provider>
  );
}

export function useChain() {
  return useContext(ChainContext);
}

/**
 * Helper: build query key with chain parameter.
 * For mainchain, no param is added (backward compatible).
 * For other chains, appends ?chain=xxx or &chain=xxx.
 */
export function useChainQuery(basePath: string, extraParams?: string): string[] {
  const { chain } = useChain();
  const chainSuffix = chain === "mainchain" ? "" : `chain=${chain}`;

  if (!extraParams && !chainSuffix) return [basePath];

  const params = [extraParams, chainSuffix].filter(Boolean).join("&");
  return [basePath, `?${params}`];
}
