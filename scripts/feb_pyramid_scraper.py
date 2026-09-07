"""Generalized scraper for the real men's FEB pyramid (tiers 2-4):
Primera FEB, Segunda FEB, Tercera FEB. Tier 1 (ACB) is not scrapable this
way — acb.com is a client-rendered Next.js app with no simple HTML/API,
unlike baloncestoenvivo.feb.es's classic server-rendered pages.

Every competition is split into 1+ "Liga Regular" subgroups on the site
(Primera FEB: 1 group; Segunda FEB: 2, ESTE/OESTE; Tercera FEB: 10,
territorial "A-A".."E-B") — always iterated generically, no per-competition
group count hardcoded. Archived seasons also list playoff "fase final"
subgroups (overlapping subsets of teams already counted); those are
filtered out. Switching subgroup on the live site is an ASP.NET WebForms
postback (not a URL param), so this script simulates that postback with
`requests` (see get_group_options / switch_group).

Usage: python3 feb_pyramid_scraper.py <competition>
  competition: primerafeb | segundafeb | tercerafeb
"""
import html as htmllib
import json
import re
import sys
import time
from datetime import date

import requests
from bs4 import BeautifulSoup

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; pcbasket-hobby-project/1.0)"}
SEASON = "2025"  # last completed season (2025/2026) — 2026/2027 has just started, no stats yet
TODAY = date(2026, 9, 7)

COMPETITIONS = {
    "primerafeb": {"group": "1", "name": "Primera FEB"},
    "segundafeb": {"group": "2", "name": "Segunda FEB"},
    "tercerafeb": {"group": "3", "name": "Tercera FEB"},
}

POSITION_MAP = {
    "Base": "PG",
    "Escolta": "SG",
    "Alero": "SF",
    "Ala-Pívot": "PF",
    "Ala-Pivot": "PF",
    "Pívot": "C",
    "Pivot": "C",
}

session = requests.Session()
session.headers.update(HEADERS)


def fetch(url):
    r = session.get(url, timeout=20)
    r.raise_for_status()
    return r.text


def get_group_options(nm, group):
    """Returns list of (subgroup_id, label) from the calendario page's
    gruposDropDownList, the id of whichever one loaded by default, plus the
    raw HTML of that (first) page load."""
    url = f"https://baloncestoenvivo.feb.es/calendario/{nm}/{group}/{SEASON}"
    html = fetch(url)
    dropdown_html = re.search(r'id="_ctl0_MainContentPlaceHolderMaster_gruposDropDownList">(.*?)</select>', html, re.S).group(1)
    opts = re.findall(r'<option(?: selected="selected")? value="(\d+)">([^<]+)</option>', dropdown_html)
    selected = re.search(r'<option selected="selected" value="(\d+)">', dropdown_html)
    selected_id = selected.group(1) if selected else opts[0][0]
    return [(sid, htmllib.unescape(lbl)) for sid, lbl in opts], selected_id, url, html


def teams_from_html(html):
    pairs = re.findall(r'Equipo\.aspx\?i=(\d+)">([^<]+)</a>', html)
    teams = {}
    for team_id, name in pairs:
        teams[team_id] = htmllib.unescape(name).strip().title()
    return teams


def switch_group(page_url, html, subgroup_id):
    """Simulate the ASP.NET postback that the gruposDropDownList onchange
    triggers, to load a different Tercera FEB subgroup."""
    hidden = dict(re.findall(r'<input type="hidden" name="([^"]+)" id="[^"]*" value="([^"]*)"', html))
    selects = re.findall(r'<select name="([^"]+)"[^>]*>(.*?)</select>', html, re.S)
    select_data = {}
    for name, body in selects:
        m = re.search(r'<option selected="selected" value="([^"]*)"', body)
        select_data[name] = m.group(1) if m else ""

    field = "_ctl0:MainContentPlaceHolderMaster:gruposDropDownList"
    data = {**hidden, **select_data}
    data["__EVENTTARGET"] = field
    data["__EVENTARGUMENT"] = ""
    data[field] = subgroup_id
    data = {k: htmllib.unescape(v) for k, v in data.items()}

    r = session.post(page_url, data=data, timeout=20)
    r.raise_for_status()
    return r.text


def parse_age(birthdate_str):
    if not birthdate_str or birthdate_str == "-":
        return None
    try:
        d, m, y = birthdate_str.split("/")
        born = date(int(y), int(m), int(d))
        return TODAY.year - born.year - ((TODAY.month, TODAY.day) < (born.month, born.day))
    except Exception:
        return None


def get_roster(team_id):
    html = fetch(f"https://baloncestoenvivo.feb.es/equipo/{team_id}")
    soup = BeautifulSoup(html, "html.parser")
    players = []
    for t in soup.find_all("table"):
        header = t.get_text(" ", strip=True)[:60]
        if "Nombre" in header and "Puesto" in header:
            rows = t.find_all("tr")
            for r in rows[1:]:
                cells = r.find_all("td")
                if len(cells) < 9:
                    continue
                texts = [c.get_text(" ", strip=True) for c in cells]
                name = texts[1]
                if not name:
                    continue
                link = r.find("a", href=True)
                player_id = None
                if link:
                    m = re.search(r"c=(\d+)", link["href"])
                    if m:
                        player_id = m.group(1)
                height = texts[7]
                players.append({
                    "team_id": team_id,
                    "player_id": player_id,
                    "name": name.title(),
                    "position_raw": texts[2],
                    "dorsal": texts[3] if texts[3] != "-" else None,
                    "birthdate": texts[4] if texts[4] != "-" else None,
                    "age": parse_age(texts[4]),
                    "nationality": texts[5].title() if texts[5] else None,
                    "homegrown": texts[6] == "SI",
                    "height_cm": int(height) if height.isdigit() else None,
                })
            break
    return players


def to_float(s):
    if not s or s in ("-", ""):
        return 0.0
    s = s.replace("%", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return 0.0


def get_player_stats(team_id, player_id):
    html = fetch(f"https://baloncestoenvivo.feb.es/jugador/{team_id}/{player_id}")
    soup = BeautifulSoup(html, "html.parser")
    stats_table = None
    for t in soup.find_all("table"):
        txt = t.get_text(" ", strip=True)
        if "FASE" in txt and "VA" in txt:
            stats_table = t
            break
    if stats_table is None:
        return None

    rows = stats_table.find_all("tr")
    header_idx = None
    headers = []
    for i, r in enumerate(rows):
        cells = [c.get_text(" ", strip=True) for c in r.find_all(["th", "td"])]
        if cells and cells[0] == "FASE":
            headers = cells
            header_idx = i
            break
    if header_idx is None:
        return None

    data_rows = []
    for r in rows[header_idx + 1:]:
        cells = [c.get_text(" ", strip=True) for c in r.find_all("td")]
        if len(cells) == len(headers):
            data_rows.append(dict(zip(headers, cells)))

    chosen = next((d for d in data_rows if d.get("FASE") == "LR"), None)
    if chosen is None and data_rows:
        chosen = data_rows[0]
    if chosen is None:
        return None

    return {
        "games": to_float(chosen.get("Part")),
        "points": to_float(chosen.get("PT")),
        "fg2_pct": to_float(chosen.get("T2")),
        "fg3_pct": to_float(chosen.get("T3")),
        "fg_pct": to_float(chosen.get("TC")),
        "ft_pct": to_float(chosen.get("TL")),
        "reb_off": to_float(chosen.get("RO")),
        "reb_def": to_float(chosen.get("RD")),
        "reb_tot": to_float(chosen.get("RT")),
        "assists": to_float(chosen.get("AS")),
        "steals": to_float(chosen.get("BR")),
        "turnovers": to_float(chosen.get("BP")),
        "blocks_for": to_float(chosen.get("TF")),
        "fouls_committed": to_float(chosen.get("FC")),
        "fouls_received": to_float(chosen.get("FR")),
        "valoracion": to_float(chosen.get("VA")),
    }


def scrape_team(team_id, name, group_label=None):
    roster = get_roster(team_id)
    tag = f"{name}" + (f" [{group_label}]" if group_label else "")
    print(f"  {tag}: {len(roster)} players", flush=True)
    for p in roster:
        if group_label:
            p["subgroup"] = group_label
        if p["player_id"]:
            try:
                p["stats"] = get_player_stats(team_id, p["player_id"])
            except Exception as e:
                print(f"    stats error {p['name']}: {e}", flush=True)
                p["stats"] = None
            time.sleep(0.25)
        else:
            p["stats"] = None
    time.sleep(0.25)
    return {"id": team_id, "name": name, "roster": roster}


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in COMPETITIONS:
        print(f"Usage: {sys.argv[0]} <{'|'.join(COMPETITIONS)}>")
        sys.exit(1)

    nm = sys.argv[1]
    cfg = COMPETITIONS[nm]
    group = cfg["group"]
    out_path = f"{nm}_{SEASON}_raw.json"

    result = []

    all_options, default_id, page_url, first_html = get_group_options(nm, group)
    # archived seasons also list playoff "fase final" subgroups (overlapping
    # subsets of teams already counted in the regular-season groups) — keep
    # only the regular-season ones for full, non-overlapping rosters+stats.
    options = [(sid, lbl) for sid, lbl in all_options if lbl.startswith("Liga Regular")] or all_options
    multi = len(options) > 1
    print(f"{cfg['name']}: {len(options)} regular-season subgroup(s) (of {len(all_options)} total)", flush=True)
    for subgroup_id, label in options:
        # posting the already-selected value back as a "changed" postback
        # breaks the server's render (empty team list) — reuse the page as
        # first loaded instead of re-requesting it in that case.
        html = first_html if subgroup_id == default_id else switch_group(page_url, first_html, subgroup_id)
        teams = teams_from_html(html)
        print(f"-- subgroup {label} ({subgroup_id}): {len(teams)} teams --", flush=True)
        for team_id, name in teams.items():
            result.append(scrape_team(team_id, name, group_label=label if multi else None))
        # checkpoint after every subgroup so a late failure doesn't lose earlier work
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump({"season": f"{SEASON}/{int(SEASON)+1}", "competition": cfg["name"], "teams": result}, f, ensure_ascii=False, indent=2)

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"season": f"{SEASON}/{int(SEASON)+1}", "competition": cfg["name"], "teams": result}, f, ensure_ascii=False, indent=2)

    total_players = sum(len(t["roster"]) for t in result)
    with_stats = sum(1 for t in result for p in t["roster"] if p["stats"])
    print(f"Saved {out_path} — {len(result)} teams, {total_players} players, {with_stats} with stats")


if __name__ == "__main__":
    main()
