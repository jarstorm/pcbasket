"""Same pipeline as feb_scraper.py, pointed at Segunda FEB (grupo 2) instead
of Primera FEB. See PLAN.md for how the g=/nm= values were found."""
import json
import re
import time
import urllib.request
from datetime import date

from bs4 import BeautifulSoup

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; pcbasket-hobby-project/1.0)"}
SEASON = "2026"
GROUP = "2"
NAME_SLUG = "segundafeb"

POSITION_MAP = {
    "Base": "PG",
    "Escolta": "SG",
    "Alero": "SF",
    "Ala-Pívot": "PF",
    "Ala-Pivot": "PF",
    "Pívot": "C",
    "Pivot": "C",
}


def fetch(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read().decode("utf-8", errors="ignore")


def get_teams():
    url = f"https://baloncestoenvivo.feb.es/calendario.aspx?g={GROUP}&t={SEASON}&nm={NAME_SLUG}"
    html = fetch(url)
    pairs = re.findall(r'Equipo\.aspx\?i=(\d+)">([^<]+)</a>', html)
    teams = {}
    for team_id, name in pairs:
        teams[team_id] = name.strip().title()
    return teams


def parse_age(birthdate_str):
    if not birthdate_str or birthdate_str == "-":
        return None
    try:
        d, m, y = birthdate_str.split("/")
        born = date(int(y), int(m), int(d))
        today = date(2026, 9, 4)
        return today.year - born.year - ((today.month, today.day) < (born.month, born.day))
    except Exception:
        return None


def get_roster(team_id):
    url = f"https://baloncestoenvivo.feb.es/equipo/{team_id}"
    html = fetch(url)
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
    url = f"https://baloncestoenvivo.feb.es/jugador/{team_id}/{player_id}"
    html = fetch(url)
    soup = BeautifulSoup(html, "html.parser")
    tables = soup.find_all("table")
    stats_table = None
    for t in tables:
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


def main():
    teams = get_teams()
    print(f"Found {len(teams)} teams")
    result = []
    for team_id, name in teams.items():
        roster = get_roster(team_id)
        print(f"  {name}: {len(roster)} players")
        for p in roster:
            if p["player_id"]:
                try:
                    p["stats"] = get_player_stats(team_id, p["player_id"])
                except Exception as e:
                    print(f"    stats error {p['name']}: {e}")
                    p["stats"] = None
                time.sleep(0.3)
            else:
                p["stats"] = None
        result.append({"id": team_id, "name": name, "roster": roster})
        time.sleep(0.3)

    with open("segunda_feb_2025_26_raw.json", "w", encoding="utf-8") as f:
        json.dump({"season": "2025/2026", "competition": "Segunda FEB", "teams": result}, f, ensure_ascii=False, indent=2)
    total_players = sum(len(t["roster"]) for t in result)
    with_stats = sum(1 for t in result for p in t["roster"] if p["stats"])
    print(f"Saved segunda_feb_2025_26_raw.json — {total_players} players, {with_stats} with stats")


if __name__ == "__main__":
    main()
