#!/usr/bin/env python3
"""
EOD Brain Agent
Runs at 3:35 PM IST after market close.
Reads today's trades, asks Hermes what to learn, saves patterns to memory.

This is the LEARNING engine — not just reporting, but building institutional memory.
Every day adds to the pattern library that future signals use.

Usage:
  python3 agents/eod-brain.py
"""

import subprocess, json, sys, os, urllib.request, urllib.error, datetime, glob

APP_URL    = os.environ.get("APP_URL", "http://localhost:1803")
VERCEL_URL = os.environ.get("VERCEL_URL", "https://stock-market-analyzer-five.vercel.app")
SECRET     = os.environ.get("TRADING_SECRET", "")
TODAY      = datetime.datetime.now().strftime("%Y-%m-%d")
MEMORY_DIR = os.path.expanduser("~/.hermes/memories/")

def fetch_vercel(path):
    url = VERCEL_URL + path
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "eod-brain/1.0"})
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read())
    except Exception as e:
        print(f"  [fetch] {e}")
        return {}

def post_vercel(path):
    url = VERCEL_URL + path
    req = urllib.request.Request(url, data=b"{}", method="POST", headers={
        "Content-Type": "application/json",
        "x-trading-secret": SECRET,
    })
    try:
        with urllib.request.urlopen(req, timeout=58) as r:
            return json.loads(r.read())
    except Exception as e:
        print(f"  [post] {e}")
        return {}

def ask_hermes(prompt):
    cmd = ["hermes", "chat", "-q", prompt, "-Q", "-m", "llama3.1:8b", "--max-turns", "2"]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
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
    if ans and len(ans) > 20:
        return ans, "hermes"
    ans = ask_claude(prompt)
    return (ans, "claude") if ans else ("", "none")

def load_past_patterns(days=30):
    """Load last N days of memory for pattern context."""
    patterns = []
    files = sorted(glob.glob(os.path.join(MEMORY_DIR, "trading_*.json")))[-days:]
    for f in files:
        try:
            with open(f) as fp:
                patterns.append(json.load(fp))
        except:
            pass
    return patterns

def main():
    print(f"\n{'='*60}")
    print(f"EOD BRAIN — {TODAY}")
    print(f"{'='*60}")

    # 1. Trigger EOD close via Vercel
    print("\n[1] Closing open positions...")
    eod = post_vercel("/api/trading/run?mode=eod")
    summary = eod.get("summary", {})
    trades  = summary.get("totalTrades", 0)
    winners = summary.get("winners", 0)
    losers  = summary.get("losers", 0)
    net_pnl = summary.get("netPnL", 0)
    win_rate = summary.get("winRate", 0)
    print(f"  Trades: {trades} | W: {winners} L: {losers} | Win%: {win_rate}% | PnL: ₹{net_pnl}")

    # 2. Load today's trades detail
    trades_data = fetch_vercel(f"/api/trading/paper?date={TODAY}")
    trade_list  = trades_data.get("trades", [])

    # Build trade summary string
    trade_lines = []
    for t in trade_list:
        if t.get("exitReason") in ("open", "avoided_charges"):
            continue
        line = (f"{t.get('symbol')} {t.get('direction','').upper()} "
                f"entry={t.get('entryPrice')} exit={t.get('exitPrice')} "
                f"reason={t.get('exitReason')} pnl={t.get('netPnL')}")
        trade_lines.append(line)

    # 3. Load morning's prediction
    morning_mem = os.path.join(MEMORY_DIR, f"trading_{TODAY}.json")
    morning = {}
    try:
        with open(morning_mem) as f:
            morning = json.load(f)
    except:
        pass

    # 4. Load recent patterns for context
    past = load_past_patterns(20)
    pattern_summary = ""
    if past:
        profitable_days = [p for p in past if p.get("day_pnl", 0) > 0]
        loss_days       = [p for p in past if p.get("day_pnl", 0) < 0]
        profitable_biases = [p.get("day_bias") for p in profitable_days]
        pattern_summary = (f"Last 20 days: {len(profitable_days)} profitable, {len(loss_days)} loss. "
                           f"Profitable day biases: {', '.join(set(profitable_biases))}")

    # 5. Ask brain for learning
    prompt = f"""EOD review for Indian stock market trades on {TODAY}.

Morning prediction:
- Day bias: {morning.get('day_bias', 'unknown')}
- Plan was: {morning.get('plan', 'N/A')}

Actual results:
- Trades: {trades} | Winners: {winners} | Losers: {losers} | Win rate: {win_rate}%
- Net PnL: ₹{net_pnl}

Trade details:
{chr(10).join(trade_lines[:10]) if trade_lines else "No completed trades"}

Historical context:
{pattern_summary}

Give me a structured learning report in this exact format:
PREDICTION_ACCURACY: correct / wrong / partial
WHAT_WORKED: one sentence (or "nothing" if loss day)
WHAT_FAILED: one sentence
KEY_PATTERN: one observation about today's market structure
TOMORROW_FOCUS: one actionable sentence for tomorrow
BIAS_SCORE: +1 (bias was right), 0 (neutral), -1 (bias was wrong)"""

    print("\n[2] Asking brain for learning analysis...")
    analysis, brain = ask_brain(prompt)
    print(f"  ✓ Response via {brain}")

    def extract(key, text, default=""):
        for line in text.split("\n"):
            if line.upper().startswith(key.upper() + ":"):
                return line.split(":", 1)[1].strip()
        return default

    pred_accuracy = extract("PREDICTION_ACCURACY", analysis, "partial")
    what_worked   = extract("WHAT_WORKED",         analysis, "")
    what_failed   = extract("WHAT_FAILED",         analysis, "")
    key_pattern   = extract("KEY_PATTERN",         analysis, "")
    tomorrow      = extract("TOMORROW_FOCUS",      analysis, "")
    bias_score    = int(extract("BIAS_SCORE",      analysis, "0").replace("+","") or 0)

    print(f"\n[3] Learning extracted:")
    print(f"  Prediction accuracy: {pred_accuracy}")
    print(f"  What worked:  {what_worked}")
    print(f"  What failed:  {what_failed}")
    print(f"  Key pattern:  {key_pattern}")
    print(f"  Tomorrow:     {tomorrow}")
    print(f"  Bias score:   {bias_score:+d}")

    # 6. Save enriched memory
    memory = {
        "date":               TODAY,
        "brain":              brain,
        # Morning prediction
        "day_bias":           morning.get("day_bias", "neutral"),
        "signal_bias":        morning.get("signal_bias", "both"),
        "morning_plan":       morning.get("plan", ""),
        # Results
        "day_pnl":            net_pnl,
        "trades":             trades,
        "win_rate":           win_rate,
        # Learning
        "prediction_accuracy": pred_accuracy,
        "what_worked":        what_worked,
        "what_failed":        what_failed,
        "key_pattern":        key_pattern,
        "tomorrow_focus":     tomorrow,
        "bias_score":         bias_score,
    }
    os.makedirs(MEMORY_DIR, exist_ok=True)
    mem_file = os.path.join(MEMORY_DIR, f"trading_{TODAY}.json")
    with open(mem_file, "w") as f:
        json.dump(memory, f, indent=2)
    print(f"\n✓ Memory updated: {mem_file}")

    # 7. Print weekly pattern summary every Friday
    dow = datetime.datetime.now().weekday()  # 4 = Friday
    if dow == 4 and len(past) >= 5:
        week = past[-5:]
        week_pnl   = sum(p.get("day_pnl", 0) for p in week)
        week_score = sum(p.get("bias_score", 0) for p in week)
        print(f"\n{'─'*40}")
        print(f"WEEKLY SUMMARY")
        print(f"  Week PnL:   ₹{week_pnl:.0f}")
        print(f"  Bias score: {week_score:+d}/5 (how often prediction was right)")
        patterns = [p.get("key_pattern","") for p in week if p.get("key_pattern")]
        if patterns:
            print(f"  Patterns seen this week:")
            for p in patterns:
                print(f"    • {p}")

    print(f"\n✓ EOD brain complete.")

if __name__ == "__main__":
    main()
