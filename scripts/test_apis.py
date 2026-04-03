#!/usr/bin/env python3
"""
Test free sports betting APIs - no auth required
Tests: ESPN, NHL, MLB, NBA, Underdog Fantasy
"""

import urllib.request
import json
import ssl
from datetime import datetime

# Disable SSL verification for testing
ssl._create_default_https_context = ssl._create_unverified_context

def fetch(url, timeout=10):
    """Fetch URL and return JSON"""
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        return {"error": str(e)}

def test_espn_scoreboard():
    """Test ESPN scoreboard API for all sports"""
    print("\n=== ESPN SCOREBOARD API ===")
    sports = [
        ("NBA", "basketball", "nba"),
        ("NFL", "football", "nfl"),
        ("MLB", "baseball", "mlb"),
        ("NHL", "hockey", "nhl"),
    ]

    for name, sport, league in sports:
        url = f"https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard"
        data = fetch(url)

        if "error" in data:
            print(f"  {name}: FAILED - {data['error']}")
        else:
            events = data.get("events", [])
            print(f"  {name}: OK - {len(events)} games")
            if events:
                game = events[0]
                print(f"       Sample: {game.get('name', 'N/A')}")

def test_espn_odds():
    """Test ESPN Core API for odds"""
    print("\n=== ESPN ODDS API ===")

    # First get today's events
    today = datetime.now().strftime("%Y%m%d")
    sports = [
        ("NBA", "basketball", "nba"),
        ("MLB", "baseball", "mlb"),
        ("NHL", "hockey", "nhl"),
    ]

    for name, sport, league in sports:
        # Get events list
        events_url = f"https://sports.core.api.espn.com/v2/sports/{sport}/leagues/{league}/events?dates={today}"
        events_data = fetch(events_url)

        if "error" in events_data:
            print(f"  {name}: FAILED to get events - {events_data['error']}")
            continue

        items = events_data.get("items", [])
        if not items:
            print(f"  {name}: No games today")
            continue

        # Extract event ID from first game's $ref URL
        ref = items[0].get("$ref", "")
        if "/events/" in ref:
            event_id = ref.split("/events/")[1].split("?")[0]

            # Fetch odds for this event
            odds_url = f"https://sports.core.api.espn.com/v2/sports/{sport}/leagues/{league}/events/{event_id}/competitions/{event_id}/odds"
            odds_data = fetch(odds_url)

            if "error" in odds_data:
                print(f"  {name}: FAILED to get odds - {odds_data['error']}")
            else:
                odds_items = odds_data.get("items", [])
                if odds_items:
                    odds = odds_items[0]
                    spread = odds.get("spread", "N/A")
                    total = odds.get("overUnder", "N/A")
                    provider = odds.get("provider", {}).get("name", "Unknown")
                    print(f"  {name}: OK - Spread: {spread}, Total: {total} ({provider})")
                else:
                    print(f"  {name}: No odds data available")
        else:
            print(f"  {name}: Could not parse event ID")

def test_nhl_api():
    """Test NHL official API"""
    print("\n=== NHL API ===")

    today = datetime.now().strftime("%Y-%m-%d")
    url = f"https://api-web.nhle.com/v1/schedule/{today}"
    data = fetch(url)

    if "error" in data:
        print(f"  NHL: FAILED - {data['error']}")
        return

    game_week = data.get("gameWeek", [])
    total_games = 0
    has_odds = False

    for day in game_week:
        games = day.get("games", [])
        total_games += len(games)
        for game in games:
            away_odds = game.get("awayTeam", {}).get("odds", [])
            home_odds = game.get("homeTeam", {}).get("odds", [])
            if away_odds or home_odds:
                has_odds = True
                print(f"  NHL: OK - {total_games} games, has odds: {has_odds}")
                if away_odds:
                    print(f"       Sample odds: {away_odds[0]}")
                return

    print(f"  NHL: OK - {total_games} games, has odds: {has_odds}")

def test_mlb_api():
    """Test MLB Stats API"""
    print("\n=== MLB API ===")

    today = datetime.now().strftime("%Y-%m-%d")
    url = f"https://statsapi.mlb.com/api/v1/schedule?sportId=1&date={today}"
    data = fetch(url)

    if "error" in data:
        print(f"  MLB: FAILED - {data['error']}")
        return

    dates = data.get("dates", [])
    if not dates:
        print("  MLB: No games today")
        return

    games = dates[0].get("games", [])
    print(f"  MLB: OK - {len(games)} games")
    if games:
        game = games[0]
        away = game.get("teams", {}).get("away", {}).get("team", {}).get("name", "?")
        home = game.get("teams", {}).get("home", {}).get("team", {}).get("name", "?")
        print(f"       Sample: {away} @ {home}")

def test_nba_cdn():
    """Test NBA CDN API"""
    print("\n=== NBA CDN API ===")

    url = "https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json"
    data = fetch(url)

    if "error" in data:
        print(f"  NBA: FAILED - {data['error']}")
        return

    scoreboard = data.get("scoreboard", {})
    games = scoreboard.get("games", [])
    print(f"  NBA: OK - {len(games)} games")
    if games:
        game = games[0]
        home = game.get("homeTeam", {}).get("teamName", "?")
        away = game.get("awayTeam", {}).get("teamName", "?")
        print(f"       Sample: {away} @ {home}")

def test_underdog():
    """Test Underdog Fantasy API for props"""
    print("\n=== UNDERDOG FANTASY API (PROPS) ===")

    url = "https://api.underdogfantasy.com/beta/v5/over_under_lines"
    data = fetch(url, timeout=30)  # Large response

    if "error" in data:
        print(f"  Underdog: FAILED - {data['error']}")
        return

    lines = data.get("over_under_lines", [])
    print(f"  Underdog: OK - {len(lines)} prop lines")

    if lines:
        # Show sample by sport
        sports_seen = set()
        for line in lines[:100]:
            options = line.get("options", [])
            if options:
                header = options[0].get("selection_header", "")
                subheader = options[0].get("selection_subheader", "")
                if header and len(sports_seen) < 3:
                    sports_seen.add(header)
                    stat = line.get("stat_value", "?")
                    price = options[0].get("american_price", "?")
                    print(f"       {header}: {subheader} ({price})")

if __name__ == "__main__":
    print("=" * 50)
    print("FREE SPORTS API TESTER")
    print("=" * 50)

    test_espn_scoreboard()
    test_espn_odds()
    test_nhl_api()
    test_mlb_api()
    test_nba_cdn()
    test_underdog()

    print("\n" + "=" * 50)
    print("TESTING COMPLETE")
    print("=" * 50)
