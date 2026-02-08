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

/**
 * Fetch top 100 ESC addresses by native ELA balance.
 * Blockscout V2 returns 50 per page, so we fetch 2 pages.
 */
export async function fetchEscRichList(): Promise<EscFetchResult> {
  const maxRetries = 3;
  const retryDelay = 5000;
  const timeout = 15000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log(`Fetching ESC richlist (attempt ${attempt}/${maxRetries})...`, "esc-fetcher");

      const allItems: any[] = [];

      // Fetch 2 pages of 50 = 100 addresses
      for (let page = 1; page <= 2; page++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const url = `${ESC_API_BASE}/addresses?type=base_address&sort=balance&order=desc&page=${page}`;
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`ESC API HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.items || !Array.isArray(data.items)) {
          throw new Error("Invalid ESC API response: missing items array");
        }

        allItems.push(...data.items);
      }

      // Convert Wei to ELA and compute total
      let totalSupply = 0;
      const richlist: EscRichListItem[] = allItems.slice(0, 100).map((item) => {
        const balanceWei = BigInt(item.coin_balance || "0");
        const balanceEla = Number(balanceWei) / 1e18;
        totalSupply += balanceEla;

        return {
          address: item.hash,
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
