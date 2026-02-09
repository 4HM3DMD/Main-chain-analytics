import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

export type Chain = "mainchain" | "esc" | "ethereum";

export interface ChainInfo {
  id: Chain;
  name: string;
  shortName: string;
  explorerUrl: string;
  color: string;
  hasSnapshots: boolean; // false for ethereum (no richlist API)
  /** Number of top holders we track (e.g. 100 mainchain, 50 ESC). */
  topN: number;
}

export const CHAINS: Record<Chain, ChainInfo> = {
  mainchain: {
    id: "mainchain",
    name: "ELA Main Chain",
    shortName: "Main",
    explorerUrl: "https://blockchain.elastos.io/address",
    color: "text-blue-400",
    hasSnapshots: true,
    topN: 100,
  },
  esc: {
    id: "esc",
    name: "Elastos Smart Chain",
    shortName: "ESC",
    explorerUrl: "https://esc.elastos.io/address",
    color: "text-purple-400",
    hasSnapshots: true,
    topN: 50,
  },
  ethereum: {
    id: "ethereum",
    name: "Ethereum (ERC-20)",
    shortName: "ETH",
    explorerUrl: "https://etherscan.io/address",
    color: "text-amber-400",
    hasSnapshots: true,
    topN: 50,
  },
};

export const VALID_CHAINS: Chain[] = ["mainchain", "esc", "ethereum"];
export function isValidChain(s: string | undefined): s is Chain {
  return s !== undefined && VALID_CHAINS.includes(s as Chain);
}

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
  const [chain, setChainState] = useState<Chain>("mainchain");
  const queryClient = useQueryClient();

  const setChain = useCallback((newChain: Chain) => {
    setChainState(newChain);
    queryClient.clear();
  }, [queryClient]);

  const chainInfo = CHAINS[chain];
  const chainParam = chain === "mainchain" ? "" : `?chain=${chain}`;

  return (
    <ChainContext.Provider value={{ chain, chainInfo, setChain, chainParam }}>
      {children}
    </ChainContext.Provider>
  );
}

/**
 * URL-driven chain: chain is read from the first path segment (e.g. /esc/analytics → esc).
 * setChain(c) navigates to /:chain and clears cache. Use with routes like /:chain, /:chain/analytics.
 * Must be rendered inside wouter's Router.
 */
export function ChainFromUrl({ children }: { children: ReactNode }) {
  const [pathname, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const pathChain = pathname === "/" ? "" : pathname.split("/").filter(Boolean)[0];
  const chain: Chain = pathChain === "esc" || pathChain === "ethereum" ? pathChain : "mainchain";
  const chainInfo = CHAINS[chain];
  const chainParam = chain === "mainchain" ? "" : `?chain=${chain}`;

  const setChain = useCallback(
    (newChain: Chain) => {
      queryClient.clear();
      setLocation(`/${newChain}`);
    },
    [queryClient, setLocation]
  );

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
