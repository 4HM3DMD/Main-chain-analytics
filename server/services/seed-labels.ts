import { storage } from "../storage";
import { db } from "../db";
import { addressLabels } from "@shared/schema";
import { eq } from "drizzle-orm";
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
  { address: "EfpBYgTZxsrS3qtAApMTuSwW1M2N5ieH7k", label: "MEXC Exchange", category: "exchange" },
  // Elastos Foundation (potential)
  { address: "8PwL7pYuDS9EHFa2ej6ZLoy95TxeZV8dzJ", label: "Potential EF Address", category: "ef", notes: "Strictly used for voting in Term 6 Elastos DAO elections, hence high probability of being an Elastos Foundation address." },
  { address: "EabAPwWynzzEn8uYyRXGwyvJ4V42CqWuev", label: "Potential EF Address", category: "ef", notes: "Flagged due to suspicious activity patterns consistent with Elastos Foundation operations." },
  { address: "EUv3qKaZUmtfhxdQyML7qk7VAko2shAnfV", label: "Potential EF Address", category: "ef", notes: "Flagged due to suspicious activity patterns consistent with Elastos Foundation operations." },
  // ─── ESC (Elastos Smart Chain) Labels ───────────────────────────────────
  // These are 0x addresses — never collide with mainchain addresses
  // All ELA on ESC originates from mainchain's XVbCTM7vqM1qHKsABSFH4xKN1qbp7ijpWf (ESC Sidechain Transfer)
  // Note: All 0x addresses stored in lowercase for case-insensitive matching
  { address: "0xe235cbc85e26824e4d855d4d0ac80f3a85a520e4", label: "ShadowTokens Bridge (ETH Proxy)", category: "sidechain", notes: "ShadowTokens bridge contract — all ELA bridged to Ethereum goes through this address. Source of all ELA ERC-20 on Ethereum." },
  { address: "0xc882b111a75c0c657fc507c04fbfcd2cc984f071", label: "Gate.io Exchange", category: "exchange", notes: "Gate.io hot wallet on ESC" },
  { address: "0x0d0707963952f2fba59dd06f2b425ace40b492fe", label: "Gate.io Exchange", category: "exchange", notes: "Gate.io cold wallet on ESC" },
  { address: "0x517e9e5d46c1ea8ab6f78677d6114ef47f71f6c4", label: "Wrapped ELA Contract", category: "contract", notes: "WELA (Wrapped ELA) token contract on ESC" },
  // ─── Ethereum Labels ───────────────────────────────────────────────────
  // All ELA on Ethereum is bridged from ESC via ShadowTokens (0xE235CbC85e26824E4D855d4d0ac80f3A85A520E4)
  // Note: Ethereum addresses stored in lowercase for case-insensitive matching
  { address: "0xe6fd75ff38adca4b97fbcd938c86b98772431867", label: "ELA ERC-20 Contract", category: "sidechain", notes: "ELA token contract on Ethereum. All ELA here is bridged from ESC via ShadowTokens. Flow: Main Chain → ESC Bridge → ESC → ShadowTokens → Ethereum." },
  { address: "0x2291b0227314ed24b8b768e3e755c88bd077d4ea", label: "Coinbase Prime Custody", category: "exchange", notes: "Coinbase institutional custody service" },
  { address: "0x5047b7ad7c2d52491f0b01d41ccd8beed447bf91", label: "Coinbase Prime Custody", category: "exchange", notes: "Coinbase institutional custody service" },
  { address: "0x412940fdac1214fc3df430769f54e69210a18e49", label: "Uniswap ELA Pool", category: "dex", notes: "Uniswap decentralized exchange liquidity pool for ELA" },
  { address: "0xd00486207705f54f4bac843769d0f6d12a4bf9d4", label: "MultiSig Wallet Proxy", category: "contract", notes: "MultiSigWalletImplementation proxy contract" },
];

// Addresses to remove (temporarily unlabeled)
const REMOVE_ADDRESSES = [
  "EJitWuvoWBjeqju2K4AkgaqPof47V3HcDQ",
  "EYL34pvhFrfSkafBrAeXKgFua4CmJmYQos",
];

export async function seedAddressLabels(): Promise<void> {
  log("Seeding known address labels...", "seed");
  for (const entry of KNOWN_ADDRESSES) {
    await storage.upsertAddressLabel(entry);
  }
  // Remove temporarily unlabeled addresses
  for (const addr of REMOVE_ADDRESSES) {
    await db.delete(addressLabels).where(eq(addressLabels.address, addr));
  }
  if (REMOVE_ADDRESSES.length > 0) {
    log(`Removed ${REMOVE_ADDRESSES.length} temporary labels`, "seed");
  }
  log(`Seeded ${KNOWN_ADDRESSES.length} address labels`, "seed");
}
