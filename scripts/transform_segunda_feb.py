"""Same transform as transform_ratings.py, for segunda_feb_2025_26_raw.json.
Uses an "sfeb"/"sfebp" id prefix (instead of "feb"/"febp") so this division's
teams/players never collide with Primera FEB's ids when merged in the app."""
import json

POSITION_MAP = {
    "Base": "PG",
    "Escolta": "SG",
    "Alero": "SF",
    "Ala-Pívot": "PF",
    "Ala-Pivot": "PF",
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


def percentile_ranks(values):
    indexed = sorted(range(len(values)), key=lambda i: values[i])
    ranks = [0.0] * len(values)
    n = len(values)
    for rank, idx in enumerate(indexed):
        ranks[idx] = rank / (n - 1) if n > 1 else 0.5
    return ranks


def clamp(v, lo=30, hi=99):
    return max(lo, min(hi, round(v)))


def main():
    with open("segunda_feb_2025_26_raw.json", encoding="utf-8") as f:
        raw = json.load(f)

    flat_players = []
    for team in raw["teams"]:
        for p in team["roster"]:
            p["team_ref"] = team["id"]
            flat_players.append(p)

    has_stats = []
    no_stats = []
    for p in flat_players:
        if p.get("stats") and p["stats"].get("games", 0) > 0:
            has_stats.append(p)
        else:
            no_stats.append(p)

    va_values = [p["stats"]["valoracion"] for p in has_stats]
    shooting_raw = [p["stats"]["points"] * 0.5 + p["stats"]["fg_pct"] * 0.3 + p["stats"]["fg3_pct"] * 0.2 for p in has_stats]
    defense_raw = [p["stats"]["steals"] + p["stats"]["blocks_for"] * 1.5 + p["stats"]["reb_def"] * 0.5 for p in has_stats]
    passing_raw = [p["stats"]["assists"] - p["stats"]["turnovers"] * 0.3 for p in has_stats]
    rebounding_raw = [p["stats"]["reb_tot"] for p in has_stats]
    heights = [p["height_cm"] for p in has_stats if p["height_cm"]]
    avg_height = sum(heights) / len(heights) if heights else 195
    physical_raw = [(p["height_cm"] or avg_height) + p["stats"]["fouls_committed"] * 2 + p["stats"]["blocks_for"] * 3 for p in has_stats]

    va_pct = percentile_ranks(va_values)
    shooting_pct = percentile_ranks(shooting_raw)
    defense_pct = percentile_ranks(defense_raw)
    passing_pct = percentile_ranks(passing_raw)
    rebounding_pct = percentile_ranks(rebounding_raw)
    physical_pct = percentile_ranks(physical_raw)

    out_players = []
    out_teams = []

    for team in raw["teams"]:
        out_teams.append({"id": f"sfeb{team['id']}", "name": team["name"]})

    # Segunda FEB overalls skew a bit lower than Primera FEB (35-95 vs
    # 35-95 base but centered lower) so it reads as a genuine lower tier.
    for i, p in enumerate(has_stats):
        overall = clamp(30 + va_pct[i] * 50)
        spread = 50
        shooting = clamp(overall + (shooting_pct[i] - va_pct[i]) * spread)
        defense = clamp(overall + (defense_pct[i] - va_pct[i]) * spread)
        passing = clamp(overall + (passing_pct[i] - va_pct[i]) * spread)
        rebounding = clamp(overall + (rebounding_pct[i] - va_pct[i]) * spread)
        physical = clamp(overall + (physical_pct[i] - va_pct[i]) * spread)

        age = p["age"] or 24
        potential_bonus = max(0, (24 - age)) * 1.5 if age < 24 else 0
        potential = clamp(overall + potential_bonus, 30, 99)

        position = POSITION_MAP.get(p["position_raw"], None) or infer_position(p["height_cm"])

        out_players.append({
            "id": f"sfebp{p['player_id'] or p['name'].replace(' ', '')}",
            "teamId": f"sfeb{p['team_ref']}",
            "name": p["name"],
            "position": position,
            "age": age,
            "nationality": p["nationality"],
            "heightCm": p["height_cm"],
            "ratings": {
                "shooting": shooting,
                "defense": defense,
                "passing": passing,
                "rebounding": rebounding,
                "physical": physical,
            },
            "overall": overall,
            "potential": potential,
        })

    for j, p in enumerate(no_stats):
        overall = 40 + (j % 7)
        age = p["age"] or 22
        position = POSITION_MAP.get(p["position_raw"], None) or infer_position(p["height_cm"])
        out_players.append({
            "id": f"sfebp{p['player_id'] or p['name'].replace(' ', '')}",
            "teamId": f"sfeb{p['team_ref']}",
            "name": p["name"],
            "position": position,
            "age": age,
            "nationality": p["nationality"],
            "heightCm": p["height_cm"],
            "ratings": {
                "shooting": overall,
                "defense": overall,
                "passing": overall,
                "rebounding": overall,
                "physical": overall,
            },
            "overall": overall,
            "potential": clamp(overall + max(0, 24 - age), 30, 99),
        })

    result = {
        "season": raw["season"],
        "competition": raw["competition"],
        "teams": out_teams,
        "players": out_players,
    }

    with open("segunda_feb_league_data.json", "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"{len(out_teams)} teams, {len(out_players)} players -> segunda_feb_league_data.json")
    print(f"  with real stats: {len(has_stats)}, without: {len(no_stats)}")
    overalls = sorted(p["overall"] for p in out_players)
    print(f"  overall range: {overalls[0]}-{overalls[-1]}, median: {overalls[len(overalls)//2]}")


if __name__ == "__main__":
    main()
