#!/usr/bin/env python3
"""
Test free sports APIs v2 - detailed output for EdgeCheck integration
Focus on: moneyline, spread, totals, player props
"""

import urllib.request
import json
import ssl
from datetime import datetime, timedelta

ssl._create_default_https_context = ssl._create_unverified_context

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
}

def fetch(url, timeout=15):
    """Fetch URL and return JSON"""
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        return {"error": str(e)}

def test_espn_detailed():
    """Test ESPN APIs with full odds extraction"""
    print("\n" + "=" * 60)
    print("ESPN CORE API - MONEYLINE / SPREAD / TOTALS")
    print("=" * 60)

    today = datetime.now().strftime("%Y%m%d")
    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y%m%d")

    sports = [
        ("NBA", "basketball", "nba"),
        ("MLB", "baseball", "mlb"),
        ("NHL", "hockey", "nhl"),
        ("NFL", "football", "nfl"),
    ]

    results = {}

    for name, sport, league in sports:
        print(f"\n--- {name} ---")

        # Try today and tomorrow
        for date_str in [today, tomorrow]:
            events_url = f"https://sports.core.api.espn.com/v2/sports/{sport}/leagues/{league}/events?dates={date_str}"
            events_data = fetch(events_url)

            if "error" in events_data:
                continue

            items = events_data.get("items", [])
            if not items:
                continue

            print(f"  Found {len(items)} events for {date_str}")

            # Get odds for first 3 games
            for i, item in enumerate(items[:3]):
                ref = item.get("$ref", "")
                if "/events/" not in ref:
                    continue

                event_id = ref.split("/events/")[1].split("?")[0]
                odds_url = f"https://sports.core.api.espn.com/v2/sports/{sport}/leagues/{league}/events/{event_id}/competitions/{event_id}/odds"
                odds_data = fetch(odds_url)

                if "error" in odds_data:
                    print(f"    Game {i+1}: Failed to fetch odds")
                    continue

                odds_items = odds_data.get("items", [])
                if not odds_items:
                    print(f"    Game {i+1}: No odds available")
                    continue

                odds = odds_items[0]
                provider = odds.get("provider", {}).get("name", "Unknown")
                spread = odds.get("spread")
                total = odds.get("overUnder")
                home_ml = odds.get("homeTeamOdds", {}).get("moneyLine")
                away_ml = odds.get("awayTeamOdds", {}).get("moneyLine")

                print(f"    Game {i+1} ({provider}):")
                print(f"      Spread: {spread}")
                print(f"      Total: {total}")
                print(f"      Moneyline: Home {home_ml}, Away {away_ml}")

                results[name] = True
            break  # Found games, stop checking dates

        if name not in results:
            print(f"  No games or odds found")

    return results

def test_underdog_detailed():
    """Test Underdog Fantasy with categorized props"""
    print("\n" + "=" * 60)
    print("UNDERDOG FANTASY API - PLAYER PROPS")
    print("=" * 60)

    url = "https://api.underdogfantasy.com/beta/v5/over_under_lines"
    data = fetch(url, timeout=30)

    if "error" in data:
        print(f"FAILED: {data['error']}")
        return False

    lines = data.get("over_under_lines", [])
    print(f"\nTotal prop lines: {len(lines)}")

    # Categorize by appearance info
    categories = {}
    for line in lines:
        options = line.get("options", [])
        if not options:
            continue

        # Extract category from subheader
        subheader = options[0].get("selection_subheader", "")
        if "Points" in subheader:
            cat = "Points"
        elif "Rebound" in subheader:
            cat = "Rebounds"
        elif "Assist" in subheader:
            cat = "Assists"
        elif "Hit" in subheader:
            cat = "Hits"
        elif "Strikeout" in subheader:
            cat = "Strikeouts"
        elif "Goal" in subheader:
            cat = "Goals"
        elif "Save" in subheader:
            cat = "Saves"
        elif "Home Run" in subheader:
            cat = "Home Runs"
        else:
            cat = "Other"

        if cat not in categories:
            categories[cat] = []
        categories[cat].append(line)

    print("\nProps by category:")
    for cat, props in sorted(categories.items(), key=lambda x: -len(x[1])):
        print(f"  {cat}: {len(props)}")

    # Show samples
    print("\nSample props:")
    shown = 0
    for line in lines:
        if shown >= 5:
            break
        options = line.get("options", [])
        if len(options) >= 2:
            player = options[0].get("selection_header", "?")
            over_sub = options[0].get("selection_subheader", "")
            over_price = options[0].get("american_price", "?")
            under_price = options[1].get("american_price", "?")
            stat = line.get("stat_value", "?")

            print(f"  {player}: {over_sub}")
            print(f"    Over {stat}: {over_price} | Under: {under_price}")
            shown += 1

    return True

def test_nhl_detailed():
    """Test NHL API with odds"""
    print("\n" + "=" * 60)
    print("NHL WEB API - SCHEDULE WITH ODDS")
    print("=" * 60)

    today = datetime.now().strftime("%Y-%m-%d")
    url = f"https://api-web.nhle.com/v1/schedule/{today}"
    data = fetch(url)

    if "error" in data:
        print(f"FAILED: {data['error']}")
        return False

    game_week = data.get("gameWeek", [])
    print(f"\nDays in schedule: {len(game_week)}")

    games_with_odds = 0
    for day in game_week:
        date = day.get("date", "?")
        games = day.get("games", [])

        for game in games:
            away = game.get("awayTeam", {})
            home = game.get("homeTeam", {})
            away_name = away.get("abbrev", "?")
            home_name = home.get("abbrev", "?")
            away_odds = away.get("odds", [])
            home_odds = home.get("odds", [])

            if away_odds or home_odds:
                games_with_odds += 1
                print(f"\n  {date}: {away_name} @ {home_name}")
                if away_odds:
                    for o in away_odds[:2]:
                        print(f"    Away odds: {o.get('value', '?')} (provider {o.get('providerId', '?')})")
                if home_odds:
                    for o in home_odds[:2]:
                        print(f"    Home odds: {o.get('value', '?')} (provider {o.get('providerId', '?')})")

                if games_with_odds >= 3:
                    break
        if games_with_odds >= 3:
            break

    print(f"\nGames with odds: {games_with_odds}")
    return games_with_odds > 0

def test_sleeper():
    """Test Sleeper API for player data"""
    print("\n" + "=" * 60)
    print("SLEEPER API - PLAYER DATABASE")
    print("=" * 60)

    # Test state endpoint
    for sport in ["nfl", "nba"]:
        url = f"https://api.sleeper.app/v1/state/{sport}"
        data = fetch(url)

        if "error" in data:
            print(f"  {sport.upper()} state: FAILED - {data['error']}")
        else:
            season = data.get("season", "?")
            week = data.get("week", data.get("leg", "?"))
            print(f"  {sport.upper()}: Season {season}, Week/Leg {week}")

    return True

if __name__ == "__main__":
    print("=" * 60)
    print("FREE SPORTS API TESTER v2")
    print("Detailed output for EdgeCheck integration")
    print("=" * 60)

    results = {
        "ESPN": test_espn_detailed(),
        "Underdog": test_underdog_detailed(),
        "NHL": test_nhl_detailed(),
        "Sleeper": test_sleeper(),
    }

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)

    for api, success in results.items():
        status = "OK" if success else "FAILED"
        print(f"  {api}: {status}")

    all_ok = all(v for v in results.values() if v is not None)
    print(f"\nOverall: {'ALL TESTS PASSED' if all_ok else 'SOME TESTS FAILED'}")
