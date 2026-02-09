/**
 * Ethereum ELA ERC-20 Fetcher
 * Tracks ELA on Ethereum via:
 * 1. Etherscan V2 — total ERC-20 supply
 * 2. Alchemy — recent transfers + individual balances
 * 
 * Contract: 0xe6fd75ff38Adca4B97FBCD938c86b98772431867
 * Bridge: ShadowTokens (ESC → Ethereum)
 */

import { log } from "../index";

const ELA_ETH_CONTRACT = "0xe6fd75ff38Adca4B97FBCD938c86b98772431867";

export interface EthSupplyResult {
  totalSupply: number;
  contractAddress: string;
}

export interface EthTransfer {
  from: string;
  to: string;
  value: number;
  timestamp: string;
  txHash: string;
}

export interface EthFetchResult {
  totalSupply: number;
  recentTransfers: EthTransfer[];
}

/**
 * Fetch total ELA ERC-20 supply on Ethereum via Etherscan V2.
 */
export async function fetchEthElaSupply(): Promise<EthSupplyResult> {
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) {
    return { totalSupply: 0, contractAddress: ELA_ETH_CONTRACT };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const url = `https://api.etherscan.io/v2/api?chainid=1&module=stats&action=tokensupply&contractaddress=${ELA_ETH_CONTRACT}&apikey=${apiKey}`;
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`Etherscan HTTP ${response.status}`);
    const data = await response.json();
    if (data.status !== "1") throw new Error(`Etherscan: ${data.message}`);

    const supplyEla = parseFloat(data.result || "0") / 1e18;

    return { totalSupply: supplyEla, contractAddress: ELA_ETH_CONTRACT };
  } catch (error: any) {
    log(`ETH supply fetch failed: ${error.message}`, "eth-fetcher");
    return { totalSupply: 0, contractAddress: ELA_ETH_CONTRACT };
  }
}

/**
 * Fetch recent ELA ERC-20 transfers on Ethereum via Alchemy.
 */
export async function fetchEthRecentTransfers(count: number = 20): Promise<EthTransfer[]> {
  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) {
    log("ALCHEMY_API_KEY not set, skipping ETH transfer fetch", "eth-fetcher");
    return [];
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`https://eth-mainnet.g.alchemy.com/v2/${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "alchemy_getAssetTransfers",
        params: [{
          fromBlock: "0x0",
          toBlock: "latest",
          contractAddresses: [ELA_ETH_CONTRACT],
          category: ["erc20"],
          order: "desc",
          maxCount: `0x${count.toString(16)}`,
          withMetadata: true,
        }],
        id: 1,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`Alchemy HTTP ${response.status}`);
    const data = await response.json();

    if (data.error) throw new Error(`Alchemy: ${data.error.message}`);

    const transfers: EthTransfer[] = (data.result?.transfers || []).map((t: any) => ({
      from: t.from,
      to: t.to,
      value: t.value || 0,
      timestamp: t.metadata?.blockTimestamp || "",
      txHash: t.hash,
    }));

    log(`ETH: Fetched ${transfers.length} recent ELA transfers`, "eth-fetcher");
    return transfers;
  } catch (error: any) {
    log(`ETH transfer fetch failed: ${error.message}`, "eth-fetcher");
    return [];
  }
}

/**
 * Get ELA ERC-20 balance for a specific Ethereum address via Alchemy.
 */
export async function fetchEthAddressBalance(address: string): Promise<number> {
  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) return 0;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`https://eth-mainnet.g.alchemy.com/v2/${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "alchemy_getTokenBalances",
        params: [address, [ELA_ETH_CONTRACT]],
        id: 1,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) return 0;
    const data = await response.json();

    const balHex = data.result?.tokenBalances?.[0]?.tokenBalance || "0x0";
    return Number(BigInt(balHex)) / 1e18;
  } catch {
    return 0;
  }
}
