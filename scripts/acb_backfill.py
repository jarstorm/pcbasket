"""Re-fetches just the players acb_scraper.py couldn't get full data for
(the site occasionally streams a "thin" player reference instead of the
full object — flaky per-request, not a fixed data gap), with more retries."""
import json
import time

import acb_scraper as s

PATH = "acb_2026_raw.json"


def main():
    data = json.load(open(PATH, encoding="utf-8"))
    fixed = 0
    still_missing = []

    equipos_html = s.fetch("https://acb.com/es/liga/equipos")
    href_by_id = {href.rsplit("-", 1)[-1]: href for href in s.get_team_hrefs(equipos_html)}

    for team in data["teams"]:
        team_href = href_by_id[team["id"]]
        for i, p in enumerate(team["roster"]):
            if p["position_raw"] and p["birthdate"]:
                continue
            found = None
            # we don't have the player's href anymore (only id/name) — look
            # it up again from the team roster page.
            for attempt in range(10):
                try:
                    team_html = s.fetch(f"https://acb.com/es/liga/equipos/{team_href}")
                    hrefs = [h for h in s.get_roster_hrefs(team_html) if h.endswith(f"-{p['player_id']}")]
                    if not hrefs:
                        break
                    player_html = s.fetch(f"https://acb.com/es/liga/jugadores/{hrefs[0]}")
                    candidate = s.get_player(player_html)
                    if candidate and candidate["position_raw"] and candidate["birthdate"]:
                        found = candidate
                        break
                except Exception as e:
                    print(f"  error retrying {p['name']}: {e}", flush=True)
                time.sleep(0.3)

            if found:
                team["roster"][i] = found
                fixed += 1
                print(f"  fixed {found['name']}", flush=True)
            else:
                still_missing.append(f"{team['name']}: {p['name']}")

    with open(PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\nFixed {fixed}, still missing {len(still_missing)}")
    for m in still_missing:
        print("  -", m)


if __name__ == "__main__":
    main()
