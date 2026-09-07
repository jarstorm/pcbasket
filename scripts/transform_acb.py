"""Transforms acb_2026_raw.json (scraped real team/roster/bio, see
acb_scraper.py) into acb_league_data.json — same shape as the FEB league
data files (teams: [{id,name}], players: [...]), EXCEPT it carries no
overall/potential/ratings: acb.com has no accessible performance stats for
any season (confirmed directly against the raw responses, headless-browser
territory), so skill ratings stay procedurally generated in generate.js,
same as before — this only swaps invented names for real ones.
Uses an "acb"/"acbp" id prefix so this division's teams/players never
collide with the FEB divisions' ids when merged in the app."""
import json

POSITION_MAP = {
    "Base": "PG",
    "Escolta": "SG",
    "Alero": "SF",
    "Ala-Pívot": "PF",
    "Ala-pívot": "PF",
    "Ala-Pivot": "PF",
    "Ala-pivot": "PF",
    "Pívot": "C",
    "Pivot": "C",
}


def infer_position(height_cm):
    if not height_cm:
        return "SF"
    if height_cm >= 205:
        return "C"
    if height_cm >= 198:
        return "PF"
    if height_cm >= 193:
        return "SF"
    if height_cm >= 185:
        return "SG"
    return "PG"


def main():
    with open("acb_2026_raw.json", encoding="utf-8") as f:
        raw = json.load(f)

    out_teams = [{"id": f"acb{t['id']}", "name": t["name"], "logo": t.get("logo")} for t in raw["teams"]]

    out_players = []
    for team in raw["teams"]:
        for p in team["roster"]:
            position = POSITION_MAP.get(p["position_raw"]) or infer_position(p["height_cm"])
            out_players.append({
                "id": f"acbp{p['player_id']}",
                "teamId": f"acb{team['id']}",
                "name": p["name"],
                "position": position,
                "age": p["age"] or 24,
                "nationality": p["nationality"],
                "heightCm": p["height_cm"],
            })

    result = {"season": raw["season"], "competition": raw["competition"], "teams": out_teams, "players": out_players}

    with open("acb_league_data.json", "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"{len(out_teams)} teams, {len(out_players)} players -> acb_league_data.json")


if __name__ == "__main__":
    main()
