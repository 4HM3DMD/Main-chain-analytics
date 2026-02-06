import { log } from "../index";

export interface RichListItem {
  address: string;
  balance: string;
  percentage: string;
}

interface RichListResponse {
  richlist: RichListItem[];
  totalRichlist: number;
  totalBalances: string;
}

export async function fetchRichList(): Promise<RichListItem[]> {
  const maxRetries = 3;
  const retryDelay = 5000;
  const timeout = 15000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log(`Fetching richlist (attempt ${attempt}/${maxRetries})...`, "fetcher");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(
        "https://ela.elastos.io/api/v1/richlist?page=1&pageSize=50",
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: RichListResponse = await response.json();

      if (!data.richlist || !Array.isArray(data.richlist)) {
        throw new Error("Invalid response format: missing richlist array");
      }

      log(`Successfully fetched ${data.richlist.length} addresses`, "fetcher");
      return data.richlist;
    } catch (error: any) {
      log(`Attempt ${attempt} failed: ${error.message}`, "fetcher");

      if (attempt < maxRetries) {
        log(`Retrying in ${retryDelay / 1000}s...`, "fetcher");
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      } else {
        log(`All ${maxRetries} attempts failed`, "fetcher");
        throw error;
      }
    }
  }

  throw new Error("Should not reach here");
}
