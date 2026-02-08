/**
 * Ethereum ELA ERC-20 Fetcher
 * Fetches total ELA supply bridged to Ethereum via ShadowTokens.
 * Uses Etherscan V2 API.
 * 
 * Contract: 0xe6fd75ff38Adca4B97FBCD938c86b98772431867
 * Note: Top holders list requires Etherscan Pro API (not available with free key).
 * We track total supply only.
 */

import { log } from "../index";

const ELA_ETH_CONTRACT = "0xe6fd75ff38Adca4B97FBCD938c86b98772431867";

export interface EthSupplyResult {
  totalSupply: number;  // Total ELA on Ethereum in ELA units
  contractAddress: string;
}

/**
 * Fetch total ELA ERC-20 supply on Ethereum.
 */
export async function fetchEthElaSupply(): Promise<EthSupplyResult> {
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) {
    log("ETHERSCAN_API_KEY not set, skipping Ethereum supply fetch", "eth-fetcher");
    return { totalSupply: 0, contractAddress: ELA_ETH_CONTRACT };
  }

  const maxRetries = 3;
  const retryDelay = 5000;
  const timeout = 10000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log(`Fetching ETH ELA supply (attempt ${attempt}/${maxRetries})...`, "eth-fetcher");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const url = `https://api.etherscan.io/v2/api?chainid=1&module=stats&action=tokensupply&contractaddress=${ELA_ETH_CONTRACT}&apikey=${apiKey}`;
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Etherscan API HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.status !== "1") {
        throw new Error(`Etherscan API error: ${data.message} - ${data.result}`);
      }

      // Result is in Wei (18 decimals)
      const supplyWei = BigInt(data.result || "0");
      const supplyEla = Number(supplyWei) / 1e18;

      log(`ETH: ELA supply on Ethereum = ${supplyEla.toFixed(2)} ELA`, "eth-fetcher");

      return { totalSupply: supplyEla, contractAddress: ELA_ETH_CONTRACT };
    } catch (error: any) {
      log(`ETH attempt ${attempt} failed: ${error.message}`, "eth-fetcher");

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      } else {
        log(`ETH: All ${maxRetries} attempts failed`, "eth-fetcher");
        throw error;
      }
    }
  }

  throw new Error("Should not reach here");
}
