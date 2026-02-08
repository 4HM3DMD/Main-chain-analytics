import { storage } from "../storage";
import { log } from "../index";

const KNOWN_ADDRESSES = [
  { address: "ELANULLXXXXXXXXXXXXXXXXXXXXXYvs3rr", label: "Burn Address", category: "burn" },
  { address: "XVbCTM7vqM1qHKsABSFH4xKN1qbp7ijpWf", label: "ESC Sidechain Transfer", category: "sidechain" },
  { address: "STAKEPooLXXXXXXXXXXXXXXXXXXXpP1PQ2", label: "Staking Pool", category: "pool" },
  { address: "CRASSETSXXXXXXXXXXXXXXXXXXXX2qDX5J", label: "DAO Assets (Locked)", category: "dao" },
  { address: "CREXPENSESXXXXXXXXXXXXXXXXXX4UdT6b", label: "DAO Expenses (Unlocked)", category: "dao" },
  { address: "STAKEREWARDXXXXXXXXXXXXXXXXXFD5SHU", label: "Staking Rewards Pool", category: "pool" },
  { address: "ENqof4f3bvpLLZVXMALUL4b8hDAJHAVxU6", label: "F2Pool Mining", category: "pool" },
  { address: "EPEzY8RqLoHiKB5sXsRLNmMcE6ESqvY6Zq", label: "F2Pool Mining", category: "pool" },
  { address: "EMRKTXN183vwcGbCetvKuUPHMyQScRjx6F", label: "Antpool Mining", category: "pool" },
  { address: "EfZ6oNo4oKgefbuX3t2dVrH9ME2mR4ZZka", label: "Antpool Mining", category: "pool" },
  { address: "XV5cSp1y1PU4xXSQs5oaaLExgHA2xHYjp5", label: "ECO Chain Transfer", category: "sidechain" },
  { address: "XNQWEZ7aqNyJHvav8j8tNo2ZQypuTsWQk6", label: "PGP Chain Transfer", category: "sidechain" },
  // Exchanges
  { address: "EeKGjcERsZvmRYuJSFbrdvyb8MPzKpL3v6", label: "KuCoin Exchange", category: "exchange" },
  { address: "EJyiZrRDhdUtUpkxoLgKmdk8JxKoi1tvHG", label: "KuCoin Exchange", category: "exchange" },
  { address: "EHpQRE4K4e2UhD55ingFc7TETuve13aWbZ", label: "KuCoin Exchange", category: "exchange" },
  { address: "EKk4HeHnLvMpxFiSbjVizcrCB1nVt39Bwe", label: "Gate.io Exchange", category: "exchange" },
  { address: "ETsfuQEcNJbmeT5iPXJxJLc7CtipgaEWZQ", label: "CoinEX Exchange", category: "exchange" },
  // Elastos Foundation (potential)
  { address: "8PwL7pYuDS9EHFa2ej6ZLoy95TxeZV8dzJ", label: "Potential EF Address", category: "ef", notes: "Strictly used for voting in Term 6 Elastos DAO elections, hence high probability of being an Elastos Foundation address." },
  { address: "EabAPwWynzzEn8uYyRXGwyvJ4V42CqWuev", label: "Potential EF Address", category: "ef", notes: "Flagged due to suspicious activity patterns consistent with Elastos Foundation operations." },
  { address: "EUv3qKaZUmtfhxdQyML7qk7VAko2shAnfV", label: "Potential EF Address", category: "ef", notes: "Flagged due to suspicious activity patterns consistent with Elastos Foundation operations." },
  // Known Whales
  { address: "EJitWuvoWBjeqju2K4AkgaqPof47V3HcDQ", label: "Paxen (Whale)", category: "whale" },
  { address: "EYL34pvhFrfSkafBrAeXKgFua4CmJmYQos", label: "Paxen (Whale)", category: "whale" },
];

export async function seedAddressLabels(): Promise<void> {
  log("Seeding known address labels...", "seed");
  for (const entry of KNOWN_ADDRESSES) {
    await storage.upsertAddressLabel(entry);
  }
  log(`Seeded ${KNOWN_ADDRESSES.length} address labels`, "seed");
}
