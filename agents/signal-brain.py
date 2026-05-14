#!/usr/bin/env python3
"""
Signal Brain Agent
Called during market hours to validate trade signals before entry.
Hermes reads live price + context, gives approve/reject + reasoning.
Falls back to Claude Code CLI.

Usage:
  python3 agents/signal-brain.py --symbol RELIANCE --direction long --entry 1450 --stop 1420 --target 1510
  python3 agents/signal-brain.py --json '{"symbol":"RELIANCE","direction":"long","entry":1450,"stop":1420,"target":1510}'
"""

import subprocess, json, sys, os, urllib.request, datetime, argparse

APP_URL    = os.environ.get("APP_URL", "http://localhost:1803")
VERCEL_URL = os.environ.get("VERCEL_URL", "https://stock-market-analyzer-five.vercel.app")
TODAY      = datetime.datetime.now().strftime("%Y-%m-%d")

def fetch(path, base=None):
    url = (base or APP_URL) + path
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "signal-brain/1.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except Exception as e:
        return {}

def ask_hermes(prompt):
    cmd = ["hermes", "chat", "-q", prompt, "-Q", "-m", "llama3.1:8b",
           "-s", "stock-market", "--max-turns", "2"]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
        return (r.stdout or "").strip()
    except:
        return ""

def ask_claude(prompt):
    try:
        r = subprocess.run(["claude", "-p", prompt, "--output-format", "text"],
                           capture_output=True, text=True, timeout=45)
        return (r.stdout or "").strip()
    except:
        return ""

def ask_brain(prompt):
    ans = ask_hermes(prompt)
    if ans and len(ans) > 10:
        return ans, "hermes"
    ans = ask_claude(prompt)
    return ans, "claude" if ans else "none"

def validate_signal(symbol, direction, entry, stop, target, profile="moderate"):
    # Fetch live data
    nse_sym = f"{symbol}.NS" if not symbol.endswith(".NS") else symbol
    stock   = fetch(f"/api/stock?symbol={nse_sym}&period=5d")
    quote   = stock.get("quote", {})
    live_px = quote.get("regularMarketPrice") or quote.get("price") or entry

    stop_pct   = abs(entry - stop) / entry * 100
    target_pct = abs(entry - target) / entry * 100
    rr         = target_pct / stop_pct if stop_pct > 0 else 0

    # Load today's morning bias from memory
    memory_file = os.path.expanduser(f"~/.hermes/memories/trading_{TODAY}.json")
    morning = {}
    try:
        with open(memory_file) as f:
            morning = json.load(f)
    except:
        pass

    prompt = f"""Validate this intraday trade signal for {symbol} on NSE.

Signal:
- Direction: {direction} ({"BUY" if direction == "long" else "SELL"})
- Entry: ₹{entry}
- Stop: ₹{stop} ({stop_pct:.1f}% risk)
- Target: ₹{target} ({target_pct:.1f}% reward)
- Risk:Reward = 1:{rr:.1f}
- Live price: ₹{live_px}

Market context today:
- Day bias: {morning.get('day_bias', 'unknown')}
- Signal bias: {morning.get('signal_bias', 'both')}
- Trading plan: {morning.get('plan', 'N/A')}

Respond in this exact format:
DECISION: approve / reject
CONFIDENCE: high / medium / low
ADJUSTED_STOP: (same as {stop} if no change, or a better level)
ADJUSTED_TARGET: (same as {target} if no change)
REASON: one sentence why"""

    ans, brain = ask_brain(prompt)

    def extract(key, text, default=""):
        for line in text.split("\n"):
            if line.upper().startswith(key.upper() + ":"):
                return line.split(":", 1)[1].strip()
        return default

    decision   = extract("DECISION",         ans, "approve").lower()
    confidence = extract("CONFIDENCE",       ans, "medium").lower()
    adj_stop   = float(extract("ADJUSTED_STOP",   ans, str(stop)).replace("₹","").strip() or stop)
    adj_target = float(extract("ADJUSTED_TARGET", ans, str(target)).replace("₹","").strip() or target)
    reason     = extract("REASON",           ans, "Signal looks acceptable")

    approved = "approve" in decision

    result = {
        "symbol":           symbol,
        "direction":        direction,
        "approved":         approved,
        "confidence":       confidence,
        "adjustedStop":     adj_stop,
        "adjustedTarget":   adj_target,
        "reasoning":        reason,
        "brain":            brain,
        "livePrice":        live_px,
        "riskReward":       round(rr, 2),
    }

    return result

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--symbol",    default="RELIANCE")
    parser.add_argument("--direction", default="long")
    parser.add_argument("--entry",     type=float, default=0)
    parser.add_argument("--stop",      type=float, default=0)
    parser.add_argument("--target",    type=float, default=0)
    parser.add_argument("--json",      default="")
    args = parser.parse_args()

    if args.json:
        data = json.loads(args.json)
        symbol    = data["symbol"]
        direction = data["direction"]
        entry     = float(data["entry"])
        stop      = float(data["stop"])
        target    = float(data["target"])
    else:
        symbol, direction = args.symbol, args.direction
        entry, stop, target = args.entry, args.stop, args.target

    result = validate_signal(symbol, direction, entry, stop, target)
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
