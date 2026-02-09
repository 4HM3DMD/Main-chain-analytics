/**
 * Ethereum ELA ERC-20 Holder Fetcher
 * Fetches top ELA token holders on Ethereum via Moralis Web3 Data API.
 * 
 * Contract: 0xe6fd75ff38Adca4B97FBCD938c86b98772431867
 * API: Moralis erc20/:address/owners (free tier: 40,000 CU/day)
 * 
 * Returns the same format as mainchain/ESC fetchers so the existing
 * analyzer, analytics engine, and storage pipeline work without changes.
 */

import { log } from "../index";

const ELA_ETH_CONTRACT = "0xe6fd75ff38Adca4B97FBCD938c86b98772431867";
const ETH_TOP_N = 50;

export interface EthHolderItem {
  address: string;
  balance: string; // in ELA
  percentage: string;
}

export interface EthHolderFetchResult {
  richlist: EthHolderItem[];
  totalSupply: number;
}

/**
 * Fetch top 50 ELA ERC-20 holders on Ethereum via Moralis.
 * Moralis returns holders sorted by balance descending.
 */
export async function fetchEthElaHolders(): Promise<EthHolderFetchResult> {
  const apiKey = process.env.MORALIS_API_KEY;
  if (!apiKey) {
    throw new Error("MORALIS_API_KEY not set");
  }

  const maxRetries = 3;
  const retryDelay = 5000;
  const timeout = 15000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log(`Fetching ETH ELA holders (top ${ETH_TOP_N}, attempt ${attempt}/${maxRetries})...`, "eth-holder-fetcher");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const url = `https://deep-index.moralis.io/api/v2.2/erc20/${ELA_ETH_CONTRACT}/owners?chain=eth&order=DESC&limit=${ETH_TOP_N}`;
      const response = await fetch(url, {
        headers: {
          "accept": "application/json",
          "X-API-Key": apiKey,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Moralis HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.result || !Array.isArray(data.result)) {
        throw new Error("Invalid Moralis response: missing result array");
      }

      const items = data.result.slice(0, ETH_TOP_N);

      // Build richlist and compute total
      let totalSupply = 0;
      const richlist: EthHolderItem[] = items.map((item: any) => {
        // Moralis provides balance_formatted (human-readable) or balance (raw wei string)
        let balanceEla: number;
        if (item.balance_formatted) {
          balanceEla = parseFloat(item.balance_formatted);
        } else if (item.balance) {
          balanceEla = Number(BigInt(item.balance)) / 1e18;
        } else {
          balanceEla = 0;
        }

        totalSupply += balanceEla;

        return {
          address: item.owner_address,
          balance: balanceEla.toString(),
          percentage: "0", // Compute after total is known
        };
      });

      // Compute percentages
      for (const entry of richlist) {
        const bal = parseFloat(entry.balance);
        entry.percentage = totalSupply > 0 ? ((bal / totalSupply) * 100).toString() : "0";
      }

      log(`ETH: Successfully fetched ${richlist.length} ELA holders, total: ${totalSupply.toFixed(2)} ELA`, "eth-holder-fetcher");

      return { richlist, totalSupply };
    } catch (error: any) {
      log(`ETH holder attempt ${attempt} failed: ${error.message}`, "eth-holder-fetcher");

      if (attempt < maxRetries) {
        log(`Retrying in ${retryDelay / 1000}s...`, "eth-holder-fetcher");
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      } else {
        log(`ETH holders: All ${maxRetries} attempts failed`, "eth-holder-fetcher");
        throw error;
      }
    }
  }

  throw new Error("Should not reach here");
}
