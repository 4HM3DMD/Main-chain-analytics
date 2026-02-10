/**
 * ESC (Elastos Smart Chain) Fetcher
 * Fetches top ELA holders from the Blockscout V2 API.
 * ELA is the native token on ESC (like ETH on Ethereum).
 * Balances are returned in Wei (18 decimals).
 */

import { log } from "../index";

export interface EscRichListItem {
  address: string;
  balance: string; // in ELA (converted from Wei)
  percentage: string;
}

export interface EscFetchResult {
  richlist: EscRichListItem[];
  totalSupply: number;
}

const ESC_API_BASE = "https://esc.elastos.io/api/v2";

/** ESC API returns at most 50 per page; we only track top 50. */
const ESC_TOP_N = 50;

/**
 * Fetch top 50 ESC addresses by native ELA balance.
 * Blockscout V2 returns 50 per page; we use a single page and cap at 50.
 */
export async function fetchEscRichList(): Promise<EscFetchResult> {
  const maxRetries = 3;
  const retryDelay = 5000;
  const timeout = 15000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log(`Fetching ESC richlist (top ${ESC_TOP_N}, attempt ${attempt}/${maxRetries})...`, "esc-fetcher");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const url = `${ESC_API_BASE}/addresses?type=base_address&sort=balance&order=desc`;
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`ESC API HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.items || !Array.isArray(data.items)) {
        throw new Error("Invalid ESC API response: missing items array");
      }

      // Single page only; cap at 50
      const items = data.items.slice(0, ESC_TOP_N);

      // Convert Wei to ELA and compute total
      // Use parseFloat on string to avoid BigInt→Number precision loss for values > 2^53
      let totalSupply = 0;
      const richlist: EscRichListItem[] = items.map((item: any) => {
        const balanceEla = parseFloat(item.coin_balance || "0") / 1e18;
        totalSupply += balanceEla;

        return {
          address: (item.hash || "").toLowerCase(), // Normalize to lowercase
          balance: balanceEla.toString(),
          percentage: "0", // Will compute after we have total
        };
      });

      // Compute percentages
      for (const entry of richlist) {
        const bal = parseFloat(entry.balance);
        entry.percentage = totalSupply > 0 ? ((bal / totalSupply) * 100).toString() : "0";
      }

      log(`ESC: Successfully fetched ${richlist.length} addresses, total: ${totalSupply.toFixed(2)} ELA`, "esc-fetcher");

      return { richlist, totalSupply };
    } catch (error: any) {
      log(`ESC attempt ${attempt} failed: ${error.message}`, "esc-fetcher");

      if (attempt < maxRetries) {
        log(`Retrying in ${retryDelay / 1000}s...`, "esc-fetcher");
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      } else {
        log(`ESC: All ${maxRetries} attempts failed`, "esc-fetcher");
        throw error;
      }
    }
  }

  throw new Error("Should not reach here");
}
