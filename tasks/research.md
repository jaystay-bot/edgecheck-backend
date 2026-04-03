# API Research: FanDuel & DraftKings Odds Endpoints

## Summary

FanDuel and DraftKings do NOT provide official public APIs for odds data. However, there are two approaches:

1. **The Odds API** (RECOMMENDED) - Already integrated in EdgeCheck, supports both FanDuel and DraftKings
2. **Direct DraftKings endpoints** (UNOFFICIAL) - Reverse-engineered, may be blocked, against ToS

---

## Option 1: The Odds API (Recommended)

EdgeCheck already uses The Odds API. It aggregates odds from 40+ bookmakers including FanDuel and DraftKings.

### Bookmaker Keys
```
fanduel    - FanDuel Sportsbook
draftkings - DraftKings Sportsbook
```

### Endpoints

**Get Odds with Specific Bookmakers:**
```
GET https://api.the-odds-api.com/v4/sports/{sport}/odds
  ?apiKey={key}
  &regions=us
  &bookmakers=fanduel,draftkings
  &markets=h2h,spreads,totals
  &oddsFormat=american
```

**Get Player Props (per event):**
```
GET https://api.the-odds-api.com/v4/sports/{sport}/events/{eventId}/odds
  ?apiKey={key}
  &regions=us
  &bookmakers=fanduel,draftkings
  &markets={prop_market}
  &oddsFormat=american
```

### Sport Keys
| Sport | Key |
|-------|-----|
| NFL | `americanfootball_nfl` |
| NBA | `basketball_nba` |
| MLB | `baseball_mlb` |
| NHL | `icehockey_nhl` |
| NCAAF | `americanfootball_ncaaf` |
| NCAAB | `basketball_ncaab` |

### Game Line Markets
- `h2h` - Moneyline
- `spreads` - Point spread
- `totals` - Over/under

### Player Prop Markets

**MLB:**
- `batter_home_runs` - Home runs
- `batter_hits` - Hits
- `batter_total_bases` - Total bases
- `batter_rbis` - RBIs
- `batter_runs_scored` - Runs scored
- `batter_strikeouts` - Strikeouts
- `pitcher_strikeouts` - Pitcher strikeouts
- `pitcher_hits_allowed` - Hits allowed
- `pitcher_earned_runs` - Earned runs

**NBA:**
- `player_points` - Points
- `player_rebounds` - Rebounds
- `player_assists` - Assists
- `player_threes` - 3-pointers made
- `player_blocks` - Blocks
- `player_steals` - Steals
- `player_turnovers` - Turnovers
- `player_points_rebounds_assists` - PRA combo
- `player_points_rebounds` - Points + Rebounds
- `player_points_assists` - Points + Assists
- `player_rebounds_assists` - Rebounds + Assists
- `player_double_double` - Double-double
- `player_triple_double` - Triple-double

**NFL:**
- `player_pass_yds` - Passing yards
- `player_pass_tds` - Passing TDs
- `player_pass_attempts` - Pass attempts
- `player_pass_completions` - Completions
- `player_pass_interceptions` - Interceptions
- `player_rush_yds` - Rushing yards
- `player_rush_tds` - Rushing TDs
- `player_rush_attempts` - Rush attempts
- `player_receptions` - Receptions
- `player_reception_yds` - Receiving yards
- `player_reception_tds` - Receiving TDs
- `player_anytime_td` - Anytime TD scorer
- `player_1st_td` - First TD scorer
- `player_last_td` - Last TD scorer

**NHL:**
- `player_goals` - Goals
- `player_assists` - Assists
- `player_points` - Points (G+A)
- `player_shots_on_goal` - Shots on goal
- `player_blocked_shots` - Blocked shots
- `player_total_saves` - Goalie saves
- `player_goal_scorer_anytime` - Anytime goal scorer
- `player_goal_scorer_first` - First goal scorer
- `player_goal_scorer_last` - Last goal scorer

### Example: Get FanDuel + DraftKings NBA Props
```javascript
const response = await fetch(
  `https://api.the-odds-api.com/v4/sports/basketball_nba/events/${eventId}/odds` +
  `?apiKey=${API_KEY}` +
  `&regions=us` +
  `&bookmakers=fanduel,draftkings` +
  `&markets=player_points,player_rebounds,player_assists` +
  `&oddsFormat=american`
);
```

---

## Option 2: Direct DraftKings Endpoints (Unofficial)

**WARNING:** These endpoints are unofficial, may be geo-blocked, rate-limited, or change without notice. Against DraftKings ToS.

### Sportsbook Odds Endpoints

**Get Event Groups (all games for a sport):**
```
GET https://sportsbook.draftkings.com/sites/US-SB/api/v5/eventgroups/{sportId}?format=json
```

**Sport IDs:**
| Sport | ID |
|-------|-----|
| NFL | `88808` |
| CFB | `87637` |
| NBA | `42648` |
| MLB | `84240` |
| NHL | `42133` |

**Get Categories (market types for a sport):**
```
GET https://sportsbook.draftkings.com/sites/US-SB/api/v5/eventgroups/{sportId}/categories/{categoryId}?format=json
```

**Get Props (specific market):**
```
GET https://sportsbook.draftkings.com/sites/US-SB/api/v5/eventgroups/{sportId}/categories/{categoryId}/subcategories/{marketId}?format=json
```

### DFS API Endpoints (Not Sportsbook)

```
GET https://api.draftkings.com/sites/US-DK/sports/v1/sports?format=json
GET https://api.draftkings.com/draftgroups/v1/draftgroups/{draftGroupId}/draftables
GET https://api.draftkings.com/contests/v1/contests/{contestId}?format=json
```

### Testing Results

Direct endpoint testing returned:
- **403 Forbidden** - Geo-blocked or requires specific headers
- **Timeout** - Rate limited or blocked

These endpoints require:
- US IP address
- Specific User-Agent headers
- May need cookies/session from logged-in browser

---

## Option 3: FanDuel Direct Endpoints (Unofficial)

No documented public endpoints found. FanDuel's internal APIs are not publicly accessible.

Third-party libraries exist (github.com/Setfive/fanduel-api) but:
- Against FanDuel ToS
- Require browser automation (Selenium)
- Not recommended for production

---

## Recommendation for EdgeCheck

**Use The Odds API** with `bookmakers=fanduel,draftkings` parameter to filter specifically to those books.

### Code Change to Filter by Bookmaker

In `src/app/api/props/route.js`, update the fetch URL:

```javascript
// Current (all US bookmakers):
const url = `https://api.the-odds-api.com/v4/sports/${oddsSport}/odds?apiKey=${apiKey}&regions=us&markets=${markets}&oddsFormat=american`;

// Updated (FanDuel + DraftKings only):
const url = `https://api.the-odds-api.com/v4/sports/${oddsSport}/odds?apiKey=${apiKey}&bookmakers=fanduel,draftkings&markets=${markets}&oddsFormat=american`;
```

**Note:** Using `bookmakers` instead of `regions` counts as 2 API calls (1 per bookmaker) vs 1 call for a region. Monitor API quota usage.

---

## Sources

- [The Odds API Documentation](https://the-odds-api.com/liveapi/guides/v4/)
- [The Odds API Betting Markets](https://the-odds-api.com/sports-odds-data/betting-markets.html)
- [DraftKings API Documentation (Unofficial)](https://github.com/SeanDrum/Draft-Kings-API-Documentation)
- [DKscraPy GitHub](https://github.com/agad495/DKscraPy)
- [DraftKings Props Scraper Gist](https://gist.github.com/Adeiko/4d63fb49e2878cb5fdc737aa3cb150fa)
- [OpticOdds DraftKings API](https://opticodds.com/sportsbooks/draftkings-api)
