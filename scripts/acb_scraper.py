"""Scrapes real ACB (Liga Endesa) team/roster/bio data from acb.com.

acb.com is a Next.js app: the visible HTML for team rosters and player bios
is client-hydrated from a skeleton, but the real data is already embedded
in the page as an escaped JSON blob (React Server Components flight
payload) — no headless browser needed, just regex the blob out of the
plain HTTP response.

What's NOT scraped here: season/career statistics (points, rebounds, VA,
etc). Those are genuinely loaded by a separate client-side fetch with no
data present anywhere in the server HTML for any season, current or past
(verified directly against the raw response, not just an AI summary of it)
— getting them would require a headless browser. So this produces real
club/player identities (name, position, birthdate, height, nationality)
with NO performance stats; ratings stay procedurally generated in
generate.js, same as before, just attached to real names instead of
invented ones.

Usage: python3 acb_scraper.py
"""
import json
import re
import sys
import time
from datetime import date

import requests

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; pcbasket-hobby-project/1.0)"}
TODAY = date(2026, 9, 7)

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


def unescape_blob_string(s):
    """Undoes the double escaping of the embedded flight payload (a JSON
    string embedded inside a JS string embedded inside HTML): backslash-
    quotes and \\uXXXX escapes."""
    s = s.replace('\\"', '"')
    return re.sub(r"\\u([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1), 16)), s)


def get_teams(html):
    """{clubId: (fullName, logoUrl)} from the teams list page's embedded
    JSON — appears several times (once per component using it); dedupe by
    id, keep first-seen order."""
    pairs = re.findall(
        r'clubId\\+":(\d+),\\+"fullName\\+":\\+"(.*?)\\+".*?\\+"logo\\+":\\+"(.*?)\\+"',
        html,
    )
    seen = {}
    for cid, name, logo in pairs:
        if cid not in seen:
            seen[cid] = (unescape_blob_string(name), unescape_blob_string(logo))
    return seen


def get_team_hrefs(html):
    return sorted(set(re.findall(r'/es/liga/equipos/([a-z0-9-]+-\d+)', html)))


def get_roster_hrefs(html):
    # Scoped to the roster card's own player-card links (the page also
    # links to historical/legend players elsewhere, e.g. an all-time
    # scorers section, which a plain link-anywhere-on-the-page match would
    # wrongly include).
    return re.findall(r'href="/es/liga/jugadores/([a-z0-9-]+)"><div class="[^"]*ResumenPlantillaPlayerCard[^_]', html)


def parse_age(birthdate):
    # embedded as "DD-MM-YYYY"
    if not birthdate:
        return None
    try:
        d, m, y = birthdate.split("-")
        born = date(int(y), int(m), int(d))
        return TODAY.year - born.year - ((TODAY.month, TODAY.day) < (born.month, born.day))
    except Exception:
        return None


def _field(key, text):
    m = re.search(key + r'\\+":\\+"(.*?)\\+"', text)
    return unescape_blob_string(m.group(1)) if m else None


def _num_field(key, text):
    m = re.search(key + r'\\+":(\d+)', text)
    return m.group(1) if m else None


def get_player(html):
    # The flight payload streams the same player reference more than once
    # (e.g. a "related players" widget), in an order that isn't stable
    # request to request — the first occurrence isn't always the full
    # {"player":{...}} object, and even the full object pushes "gameRole"
    # well past a short window when the (long) headshot image URLs are
    # populated. Use the first occurrence with a real (non-null) gameRole
    # value, falling back to the first occurrence at all — a player with
    # gameRole genuinely null in every occurrence has no position on file.
    name_idxs = [m.start() for m in re.finditer("firstInitialAndLastName", html)]
    if not name_idxs:
        return None
    name_idx = next(
        (i for i in name_idxs if re.search(r'"gameRole\\+":\\+"', html[i:i + 1200])),
        name_idxs[0],
    )
    # id precedes firstInitialAndLastName in the same {"player":{"id":...}}
    # object — a small window back is enough to find it unambiguously.
    id_window = html[max(0, name_idx - 60):name_idx]
    player_id = _num_field("id", id_window)
    name_window = html[name_idx:name_idx + 1200]
    first = _field("firstName", name_window)
    last = _field("lastName", name_window)
    position_raw = _field("gameRole", name_window)

    # Search forward from this same occurrence's object, within a bound
    # (birthDate/height/nationality follow it directly in the real
    # {"player":{...}} object) — not a global find, so a duplicate
    # elsewhere on the page can't be picked instead.
    birth_idx = html.find("birthDate", name_idx, name_idx + 1500)
    if birth_idx < 0:
        return {"player_id": player_id, "name": f"{first} {last}".strip(), "position_raw": position_raw,
                "birthdate": None, "age": None, "nationality": None, "height_cm": None}
    # birthDate/birthPlace/birthCountry/nationality/height are one small
    # contiguous cluster in the player object.
    bio_window = html[birth_idx:birth_idx + 300]
    birthdate = _field("birthDate", bio_window)
    nationality = _field("nationality", bio_window)
    height_raw = _field("height", bio_window)
    height_cm = int(round(float(height_raw.replace(",", ".")) * 100)) if height_raw else None

    return {
        "player_id": player_id,
        "name": f"{first} {last}".strip(),
        "position_raw": position_raw,
        "birthdate": birthdate,
        "age": parse_age(birthdate),
        "nationality": nationality,
        "height_cm": height_cm,
    }


def main():
    out_path = "acb_2026_raw.json"

    print("Fetching team list...", flush=True)
    equipos_html = fetch("https://acb.com/es/liga/equipos")
    team_names = get_teams(equipos_html)
    team_hrefs = get_team_hrefs(equipos_html)
    print(f"{len(team_hrefs)} teams found", flush=True)

    teams = []
    for href in team_hrefs:
        team_id = href.rsplit("-", 1)[-1]
        name, logo = team_names.get(team_id, (href, None))
        team_html = fetch(f"https://acb.com/es/liga/equipos/{href}")
        roster_hrefs = get_roster_hrefs(team_html)
        print(f"  {name}: {len(roster_hrefs)} players", flush=True)

        roster = []
        for phref in roster_hrefs:
            # The site's response occasionally streams only a "thin"
            # reference for a player (missing gameRole/birthDate/etc) even
            # though a normal fetch usually returns the full object —
            # observed to vary request to request for the same URL, not a
            # parsing bug — so retry a few times before accepting a partial
            # or missing result.
            player = None
            for attempt in range(4):
                try:
                    player_html = fetch(f"https://acb.com/es/liga/jugadores/{phref}")
                    candidate = get_player(player_html)
                    if candidate and candidate["position_raw"] and candidate["birthdate"]:
                        player = candidate
                        break
                    player = player or candidate
                except Exception as e:
                    print(f"    error fetching {phref} (attempt {attempt + 1}): {e}", flush=True)
                time.sleep(0.3)
            if player:
                roster.append(player)
            else:
                print(f"    could not parse player data for {phref}", flush=True)

        teams.append({"id": team_id, "name": name, "logo": logo, "roster": roster})
        time.sleep(0.2)

        # checkpoint after every team so a late failure doesn't lose earlier work
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump({"season": "2026/2027", "competition": "Liga Endesa (ACB)", "teams": teams}, f, ensure_ascii=False, indent=2)

    total_players = sum(len(t["roster"]) for t in teams)
    print(f"Saved {out_path} — {len(teams)} teams, {total_players} players")


if __name__ == "__main__":
    main()
