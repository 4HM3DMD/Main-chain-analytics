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
  { address: "EMRKTXN183vwcGbCetvKuUPHMyQScRjx6F", label: "Antpool Mining", category: "pool" },
  { address: "XV5cSp1y1PU4xXSQs5oaaLExgHA2xHYjp5", label: "ECO Chain Transfer", category: "sidechain" },
];

export async function seedAddressLabels(): Promise<void> {
  log("Seeding known address labels...", "seed");
  for (const entry of KNOWN_ADDRESSES) {
    await storage.upsertAddressLabel(entry);
  }
  log(`Seeded ${KNOWN_ADDRESSES.length} address labels`, "seed");
}
