#!/usr/bin/env python3
"""
Traffic analysis for usecreatoros.co from the Caddy access log.

Why this script exists
----------------------
Caddy sits behind Cloudflare, so every request arrives from a Cloudflare edge
IP. `request.remote_ip` and `request.client_ip` in the JSON log are therefore
*both* the edge (e.g. 162.159.x, 172.70.x), not the visitor. Counting those
inflates unique visitors and invents countries that never visited: the naive
version of this analysis reported 24 "GB visitors" in a week while the
first-party beacon (which only fires when JavaScript runs) had recorded zero GB
visitors, ever.

The real visitor IP is in the `Cf-Connecting-Ip` header and the real country in
`Cf-Ipcountry`. Use those, and treat bot user agents separately from humans.

Usage (on the box, log files are root-only):

    sudo python3 marketing/analytics/traffic.py --days 7
    sudo python3 marketing/analytics/traffic.py --days 1 --json

Cross-check the output against the beacon table, which is the only source that
proves a real browser ran:

    select country, count(*), count(distinct visitor_id)
    from site_visits where created_at >= ... group by country;
"""

import argparse
import collections
import glob
import gzip
import json
import re
import sys
import time

LOG_GLOB = "/var/log/caddy/access*.log*"

# Anything that announces itself as automation, plus clients that cannot run JS
# (so they can never produce a beacon row).
BOT_UA = re.compile(
    r"(bot|crawl|spider|slurp|headless|phantom|python|curl|wget|node-fetch|axios|"
    r"go-http|scrapy|libwww|okhttp|java/|ahrefs|semrush|dataprovider|feedfetcher|"
    r"facebookexternalhit|whatsapp|telegrambot|preview|monitor|uptime|pingdom)",
    re.I,
)
# Static assets: requests for these say nothing about interest.
ASSET = re.compile(
    r"\.(css|js|mjs|png|jpe?g|gif|svg|ico|webp|avif|woff2?|ttf|map|mp4|webm)$", re.I
)


def client_ip(req, hdrs):
    for key in ("Cf-Connecting-Ip", "X-Forwarded-For"):
        vals = hdrs.get(key) or hdrs.get(key.lower())
        if vals:
            first = str(vals[0]).split(",")[0].strip()
            if first:
                return first
    return req.get("remote_ip") or req.get("client_ip") or "-"


def lower(hdrs):
    return {str(k).lower(): v for k, v in (hdrs or {}).items()}


def load(days):
    since = time.time() - days * 86400
    rows = []
    for path in sorted(glob.glob(LOG_GLOB)):
        opener = gzip.open if path.endswith(".gz") else open
        try:
            f = opener(path, "rt", errors="ignore")
        except OSError as e:
            print(f"skip {path}: {e}", file=sys.stderr)
            continue
        with f:
            for line in f:
                if '"handled request"' not in line:
                    continue
                try:
                    d = json.loads(line)
                except Exception:
                    continue
                ts = d.get("ts") or 0
                if ts < since:
                    continue
                req = d.get("request", {}) or {}
                h = lower(req.get("headers"))
                uri = req.get("uri") or ""
                rows.append(
                    {
                        "ts": ts,
                        "ip": client_ip(req, h),
                        "country": (h.get("cf-ipcountry") or ["-"])[0],
                        "ua": (h.get("user-agent") or [""])[0],
                        "uri": uri,
                        "path": uri.split("?")[0],
                        "ref": (h.get("referer") or [""])[0],
                        "status": d.get("status") or 0,
                    }
                )
    return since, rows


def report(days):
    since, rows = load(days)
    pages = [r for r in rows if not ASSET.search(r["path"])]
    bots = [r for r in pages if BOT_UA.search(r["ua"])]
    humans = [r for r in pages if not BOT_UA.search(r["ua"])]
    beaconless = [r for r in humans if not r["ua"]]

    out = {
        "window_days": days,
        "requests": len(rows),
        "page_requests": len(pages),
        "bot_page_requests": len(bots),
        "human_page_requests": len(humans),
        "unique_human_ips": len({r["ip"] for r in humans}),
        "by_country": {},
        "top_paths": collections.Counter(r["path"] for r in humans).most_common(12),
        "referrers": collections.Counter(
            re.sub(r"^https?://(www\.)?", "", r["ref"]).split("/")[0]
            for r in humans
            if r["ref"] and "usecreatoros.co" not in r["ref"]
        ).most_common(12),
        "top_talkers": [],
        "no_user_agent": len(beaconless),
    }

    per_country = collections.defaultdict(set)
    for r in humans:
        per_country[r["country"]].add(r["ip"])
    out["by_country"] = {
        c: len(ips)
        for c, ips in sorted(per_country.items(), key=lambda kv: -len(kv[1]))
    }

    per_ip = collections.Counter(r["ip"] for r in rows)
    for ip, n in per_ip.most_common(10):
        sample = next(r for r in rows if r["ip"] == ip)
        out["top_talkers"].append(
            {
                "ip": ip,
                "requests": n,
                "country": sample["country"],
                "ua": sample["ua"][:60],
            }
        )

    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=7)
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    res = report(a.days)
    if a.json:
        print(json.dumps(res, indent=2))
        return

    print(
        f"last {res['window_days']}d: {res['requests']} requests, "
        f"{res['page_requests']} page requests "
        f"({res['bot_page_requests']} bot, "
        f"{res['human_page_requests']} non-bot from {res['unique_human_ips']} IPs)"
    )
    print(f"non-bot page requests with no User-Agent at all: {res['no_user_agent']}")
    print("\ncountries (unique non-bot IPs):")
    for c, n in res["by_country"].items():
        print(f"  {c:4} {n:5}")
    print("\ntop paths (non-bot):")
    for p, n in res["top_paths"]:
        print(f"  {n:5} {p}")
    print("\nreferrers (non-bot, non-self):")
    for r, n in res["referrers"]:
        print(f"  {n:5} {r}")
    print("\nheaviest IPs (all requests):")
    for t in res["top_talkers"]:
        print(f"  {t['requests']:6} {t['ip']:16} {t['country']:3} {t['ua']}")


if __name__ == "__main__":
    main()
