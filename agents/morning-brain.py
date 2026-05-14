#!/usr/bin/env python3
"""
Morning Brain Agent
Runs at 7:00 AM IST before market opens.
Uses Hermes (local llama3.1:8b, zero cost) as primary brain.
Falls back to Claude Code CLI if Hermes fails.

What it does:
1. Fetches live market overview + Nifty trend
2. Fetches top movers + global context
3. Asks Hermes to analyze: which sectors to focus, what bias (bull/bear/neutral)
4. Pushes the briefing to Firestore via the app API
5. Saves insights to Hermes memory for pattern building

Usage:
  python3 agents/morning-brain.py
  python3 agents/morning-brain.py --force   # run even if scan already done
"""

import subprocess, json, sys, os, urllib.request, urllib.error, datetime, time

APP_URL   = os.environ.get("APP_URL", "http://localhost:1803")
VERCEL_URL = os.environ.get("VERCEL_URL", "https://stock-market-analyzer-five.vercel.app")
SECRET    = os.environ.get("TRADING_SECRET", "")
TODAY     = datetime.datetime.now().strftime("%Y-%m-%d")
FORCE     = "--force" in sys.argv

# ── Fetch helpers ──────────────────────────────────────────────────────────────

def fetch(path, base=None):
    url = (base or APP_URL) + path
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "hermes-brain/1.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except Exception as e:
        print(f"  [fetch] {url} → {e}")
        return {}

def post_vercel(path, data=None):
    url = VERCEL_URL + path
    body = json.dumps(data or {}).encode()
    req = urllib.request.Request(url, data=body, method="POST", headers={
        "Content-Type": "application/json",
        "x-trading-secret": SECRET,
    })
    try:
        with urllib.request.urlopen(req, timeout=55) as r:
            return json.loads(r.read())
    except Exception as e:
        print(f"  [post_vercel] {url} → {e}")
        return {}

# ── Run Hermes with a prompt ───────────────────────────────────────────────────

def ask_hermes(prompt, skills="stock-market", max_turns=3):
    """Run Hermes non-interactively. Returns text output."""
    cmd = [
        "hermes", "chat",
        "-q", prompt,
        "-Q",  # quiet mode
        "-m", "llama3.1:8b",
        "-s", skills,
        "--max-turns", str(max_turns),
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        return (result.stdout or "").strip()
    except subprocess.TimeoutExpired:
        return ""
    except Exception as e:
        print(f"  [hermes] error: {e}")
        return ""

def ask_claude(prompt):
    """Fallback: Claude Code CLI."""
    try:
        result = subprocess.run(
            ["claude", "-p", prompt, "--output-format", "text"],
            capture_output=True, text=True, timeout=60
        )
        return (result.stdout or "").strip()
    except Exception as e:
        print(f"  [claude] error: {e}")
        return ""

def ask_brain(prompt, skills="stock-market"):
    """Try Hermes first, fall back to Claude."""
    print("  → Asking Hermes...")
    ans = ask_hermes(prompt, skills)
    if ans and len(ans) > 20:
        print(f"  ✓ Hermes responded ({len(ans)} chars)")
        return ans, "hermes"
    print("  → Hermes empty, falling back to Claude...")
    ans = ask_claude(prompt)
    if ans:
        print(f"  ✓ Claude responded ({len(ans)} chars)")
        return ans, "claude"
    return "", "none"

# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    print(f"\n{'='*60}")
    print(f"MORNING BRAIN — {TODAY} — {datetime.datetime.now().strftime('%H:%M IST')}")
    print(f"{'='*60}")

    # 1. Check if already done
    if not FORCE:
        existing = fetch(f"/api/trading/morning-scan?date={TODAY}", VERCEL_URL)
        if existing.get("dayBias") and existing.get("dayBias") != "neutral":
            print(f"✓ Morning scan already done: bias={existing['dayBias']}")
            print("  Use --force to rerun.")
            return

    # 2. Fetch live market data
    print("\n[1] Fetching live market data...")
    overview  = fetch("/api/market/overview")
    nifty_raw = fetch("/api/quotes?symbols=^NSEI,^BSESN,^NSEBANK,INDIA_VIX.NS")

    # Extract key numbers
    indices = overview.get("indices", [])
    gainers = overview.get("gainers", [])[:5]
    losers  = overview.get("losers",  [])[:5]

    nifty_line = ""
    for q in (nifty_raw if isinstance(nifty_raw, list) else []):
        sym = q.get("symbol", "")
        prc = q.get("price", 0)
        pct = q.get("changePercent", 0) or 0
        nifty_line += f"{sym}: {prc:.0f} ({pct:+.2f}%)  "

    gainer_str = ", ".join([f"{g.get('symbol','?')} +{g.get('changePercent',0):.1f}%" for g in gainers])
    loser_str  = ", ".join([f"{l.get('symbol','?')} {l.get('changePercent',0):.1f}%" for l in losers])

    print(f"  Nifty data: {nifty_line[:80]}")
    print(f"  Top gainers: {gainer_str[:80]}")
    print(f"  Top losers:  {loser_str[:80]}")

    # 3. Build the prompt for Hermes
    prompt = f"""Indian market morning analysis for {TODAY}.

Market snapshot:
{nifty_line}

Top gainers: {gainer_str}
Top losers: {loser_str}

Analyze this and give me:
1. DAY_BIAS: bullish / bearish / neutral
2. SECTOR_FOCUS: top 2-3 sectors to watch today
3. KEY_RISK: main risk to watch (one sentence)
4. TRADING_PLAN: one clear sentence — what kind of trades to look for
5. SIGNAL_BIAS: long / short / both

Format your response exactly like:
DAY_BIAS: bullish
SECTOR_FOCUS: Banking, IT
KEY_RISK: FII selling if Nifty breaks 22800
TRADING_PLAN: Buy gap-ups in banking on pullback to VWAP
SIGNAL_BIAS: long"""

    print("\n[2] Asking brain for market analysis...")
    analysis, brain_used = ask_brain(prompt)

    # 4. Parse structured response
    def extract(key, text, default=""):
        for line in text.split("\n"):
            if line.upper().startswith(key.upper() + ":"):
                return line.split(":", 1)[1].strip()
        return default

    day_bias      = extract("DAY_BIAS",      analysis, "neutral").lower()
    sector_focus  = extract("SECTOR_FOCUS",  analysis, "").split(",")
    key_risk      = extract("KEY_RISK",      analysis, "No major risk identified")
    trading_plan  = extract("TRADING_PLAN",  analysis, "Trade momentum setups")
    signal_bias   = extract("SIGNAL_BIAS",   analysis, "both").lower()

    # Sanitize bias
    if day_bias not in ["bullish", "bearish", "neutral"]: day_bias = "neutral"
    if signal_bias not in ["long", "short", "both"]: signal_bias = "both"

    print(f"\n[3] Analysis result (via {brain_used}):")
    print(f"  Day bias:     {day_bias}")
    print(f"  Sectors:      {', '.join(s.strip() for s in sector_focus)}")
    print(f"  Risk:         {key_risk}")
    print(f"  Plan:         {trading_plan}")
    print(f"  Signal bias:  {signal_bias}")

    # 5. Push morning scan to Vercel/Firestore
    print("\n[4] Pushing briefing to system...")
    result = post_vercel(f"/api/trading/run?mode=morning_scan")
    if result.get("success"):
        print(f"  ✓ Morning scan triggered. Stocks scored: {result.get('stocksScored', 0)}")
    else:
        print(f"  ⚠ Morning scan trigger: {result}")

    # 6. Save Hermes memory for pattern learning
    memory_entry = {
        "date":        TODAY,
        "brain":       brain_used,
        "day_bias":    day_bias,
        "signal_bias": signal_bias,
        "sectors":     [s.strip() for s in sector_focus],
        "risk":        key_risk,
        "plan":        trading_plan,
        "raw":         analysis[:500],
    }
    memory_file = os.path.expanduser(f"~/.hermes/memories/trading_{TODAY}.json")
    os.makedirs(os.path.dirname(memory_file), exist_ok=True)
    with open(memory_file, "w") as f:
        json.dump(memory_entry, f, indent=2)
    print(f"  ✓ Memory saved: {memory_file}")

    print(f"\n✓ Morning brain complete. Market opens 9:15 AM IST.")

if __name__ == "__main__":
    main()
