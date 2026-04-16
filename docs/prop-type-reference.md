# Prop Type Reliability Reference

Source of truth for reliability labels in EdgeCheck.

Reliability reflects how predictable and consistent a prop type is based on volume, variance, and data availability. It does NOT affect scoring, sorting, or Best Play selection.

---

## HIGH RELIABILITY (A)

| Sport | Category ID / Market Key | Name |
|-------|--------------------------|------|
| MLB | `hits` | Hits |
| NBA | `rebounds` | Rebounds |
| NBA | `assists` | Assists |
| NHL | `player_shots_on_goal` | Shots on Goal |
| NHL | `player_assists` | Assists |

## MEDIUM RELIABILITY (B)

| Sport | Category ID / Market Key | Name |
|-------|--------------------------|------|
| MLB | `pitcher_strikeouts` | Strikeouts (Pitcher) |
| MLB | `walks` | Walks (Batter) |
| NBA | `points` | Points |
| NHL | `player_points` | Points |

## LOW RELIABILITY (C)

| Sport | Category ID / Market Key | Name |
|-------|--------------------------|------|
| MLB | `home_runs` | Home Runs |
| NBA | `threes` | 3-Point Shots |
| NBA | `blocks` | Blocks |
| NBA | `steals` | Steals |
| NHL | `player_goals` | Goals |

## AVOID / VERY LOW (D)

Not currently served by EdgeCheck. Reserved for future filtering:

- First inning props
- Alt-line extreme props
- Any volatile, low-frequency markets
