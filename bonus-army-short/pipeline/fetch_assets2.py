#!/usr/bin/env python3
"""Fetch the image-driven-rebuild asset set (Wikimedia Commons, public domain).
Delays between requests to respect rate limits. Saves to public/assets/src2/.
"""
import json, urllib.request, urllib.parse, ssl, os, time, sys

ctx = ssl.create_default_context(cafile="/root/.ccr/ca-bundle.crt")
UA = {"User-Agent": "BonusArmyShort/1.0 (historical documentary; research use)"}
API = "https://commons.wikimedia.org/w/api.php"
OUT = "public/assets/src2"
os.makedirs(OUT, exist_ok=True)


def get(url, timeout=45):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout, context=ctx).read()


def search(term, limit=8):
    q = {"action": "query", "format": "json", "list": "search",
         "srsearch": term, "srnamespace": "6", "srlimit": str(limit)}
    j = json.loads(get(API + "?" + urllib.parse.urlencode(q)))
    return [r["title"] for r in j["query"]["search"]]


def imageinfo(title, width=1800):
    q = {"action": "query", "format": "json", "titles": title, "prop": "imageinfo",
         "iiprop": "url|extmetadata|size|mime", "iiurlwidth": str(width)}
    j = json.loads(get(API + "?" + urllib.parse.urlencode(q)))
    for _, p in j["query"]["pages"].items():
        ii = p.get("imageinfo")
        if ii:
            info = ii[0]
            lic = info.get("extmetadata", {}).get("LicenseShortName", {}).get("value", "?")
            return (info.get("thumburl") or info.get("url"), lic,
                    info.get("width", 0), info.get("height", 0), info.get("mime", ""))
    return None, None, 0, 0, ""


# name -> (search terms, min width) — first good PD raster wins
NEED = {
    "veterans_crowd": (["Bonus Army marchers Washington 1932 crowd", "Bonus Army Pennsylvania Avenue 1932", "Bonus Expeditionary Force 1932"], 1000),
    "breadline": (["breadline 1932", "unemployed men bread line Great Depression 1932", "soup kitchen 1931 depression"], 900),
    "anacostia_wide": (["Bonus Army Anacostia camp 1932", "Bonus Army camp shacks 1932", "Anacostia flats Bonus Army"], 1000),
    "camp_life": (["Bonus Army camp veterans 1932", "Bonus marchers camp 1932", "Bonus Army family 1932"], 900),
    "cavalry": (["US Cavalry 1932 Washington Bonus", "cavalry troops Pennsylvania Avenue 1932", "US Army cavalry 1930s"], 900),
    "infantry": (["US infantry 1932 Bonus Army", "soldiers bayonets 1932 Washington", "US Army infantry 1932"], 900),
    "troops_gas": (["Bonus Army tear gas troops 1932", "US Army Bonus Army eviction 1932", "Bonus march troops 1932"], 900),
    "theater_1930s": (["movie theater audience 1930s", "cinema audience 1932", "newsreel theater 1930s"], 900),
    "dc_map_1932": (["Washington DC map 1932", "map Washington DC 1930", "Washington DC street map 1917"], 900),
    "hooverville": (["Hooverville 1932", "shanty town depression 1932 Washington", "Hooverville Anacostia"], 900),
}


def main():
    report = {}
    for name, (terms, minw) in NEED.items():
        done = False
        for term in terms:
            try:
                titles = search(term); time.sleep(3)
            except Exception as e:
                print(f"{name}: search err {repr(e)[:50]}", flush=True); time.sleep(4); continue
            for title in titles:
                if not any(title.lower().endswith(e) for e in (".jpg", ".jpeg", ".png", ".gif", ".tif", ".tiff")):
                    continue
                try:
                    url, lic, w, h, mime = imageinfo(title); time.sleep(3)
                except Exception:
                    time.sleep(4); continue
                if not url:
                    continue
                low = (lic or "").lower()
                if not any(k in low for k in ("public domain", "pd", "cc0", "no known")):
                    continue
                if max(w, h) and max(w, h) < minw:
                    continue
                try:
                    data = get(url)
                except Exception:
                    time.sleep(4); continue
                ext = url.split(".")[-1].split("?")[0].lower()
                if ext not in ("jpg", "jpeg", "png", "gif"):
                    ext = "jpg"
                open(f"{OUT}/{name}.{ext}", "wb").write(data)
                report[name] = f"OK {len(data)//1024}KB {w}x{h} [{lic}] <- {title[:42]}"
                done = True
                break
            if done:
                break
        if not done:
            report[name] = "NOT FOUND"
        print(f"{name:16} {report.get(name)}", flush=True)
        time.sleep(1)
    print("DONE")


if __name__ == "__main__":
    sys.exit(main())
