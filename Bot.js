// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// always-run-in-app: true; icon-color: teal;
// icon-glyph: magic;

    RICHARD  — SOLANA PORTFOLIO

const WALLETS = [
  { label: Hot Wallet,    address: VicAQ3U2GjjAuF3tPCtEQZdZKnpAAxkr5Q3zjDKmdo7 },
  { label: Venmo,         address: "8d9FNC7AgKLTCPKNd3MMkLLXZYLmiYFYR3vfXMBNJVNx" },
  { label: Wallet 3,      address: "is6MTRHEgyFLNTfYcuV4QBWLjrZBfmhVNYR6ccgr8KV"  },
  { label: "Wallet 4",      address: "3mSyvNaJrV7912we42p2Pq6EzvojtczULPPfqekSpump" },
  { label: "Wallet 5",      address: "7tP8ko6zKSXsJnUzPKsAwqukaGsgjr7cHQWzzxLQi7Gd" },
]

const RPC   = "https://api.mainnet-beta.solana.com"
const CG    = "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true"
const CACHE_KEY  = "richy_portfolio_cache"
const CACHE_MINS = 5   // refresh every 5 minutes

// ── COLORS ──────────────────────────────────────────────────
const C = {
  bg:        new Color( #0a0a14 ),
  bgCard:    new Color("#12122a"),
  purple:    new Color("#9945FF"),
  green:     new Color("#14F195"),
  white:     new Color("#ffffff"),
  grey:      new Color("#888888"),
  red:       new Color("#ef4444"),
  yellow:    new Color("#fbbf24"),
  border:    new Color("#1e1e3e"),
}

── CACHE HELPERS ────────────────────────────────────────────
function saveCache(data) {
  Keychain.set(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }))
}
function loadCache() {
  try {
    const raw = Keychain.get(CACHE_KEY)
    if (!raw) return null
  