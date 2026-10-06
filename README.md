# Plan

Plan is a static, mobile-first NFL stats site. It lists Week 5 matchups, per-game hit-rate ladders, and individual player pages. There is no framework and no Bootstrap — just HTML, CSS, and JavaScript.

The site shows stats and hit rates only. It does not show odds. Figures are through 2026 week 4.

Stats come from [nflverse](https://github.com/nflverse/nflverse-data).

## View locally

From the repo root:

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000/](http://localhost:8000/).

## Regenerating pages

`build.py` rebuilds the HTML from CSVs. It expects the data folder at `/workspace/plan-nfl-data/`. That folder is not in this repo. The committed HTML is the source of truth.
