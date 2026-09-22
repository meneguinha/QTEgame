# Researcher vs Rogue AI

A cinematic FMV fighting game built as a proof of concept: pre-rendered video
clips freeze on a dramatic frame, a Quick Time Event takes over, and the fight
continues based on how well you hit it.

**Play it:** open `index.html` — no build step, no dependencies, no server needed.

## How the fight works

Four strikes, each a different kind of QTE:

| # | Strike | Keys | Mechanic |
|---|--------|------|----------|
| 1 | High Block | `W` | Hold, release inside the green zone |
| 2 | Side Dodge | `D` | Same, faster |
| 3 | Stance Break | `W` + `S` | Two independent bars, each with its own target and window |
| 4 | Finishing Blow | `W S S S A S W D` | No bars — hammer the sequence before the clock runs out |

On the hold strikes, the bar and the green zone **shrink in real time while you
hesitate**. React fast and you lock in a generous window; stall and it gets
brutal. Each key freezes its own tolerance the moment you press it.

## What's inside

```
index.html          Markup for the video stage, HUD and overlay screens
style.css           All styling, including the Cyberdyne-terminal start screen
js/main.js          Game orchestrator + dual-<video> seamless playback
js/qte.js           QTE engine: hold lanes, dual-key strikes, key sequences
js/audio.js         All sound synthesized live via the Web Audio API
js/particles.js     Sparks, shockwaves and slashes on a canvas over the video
videos/             The six fight clips
```

There are no audio sample files: every impact, whoosh, heartbeat and the whole
layered death scene is generated at runtime by `js/audio.js`. The only media is
the soundtrack and the video clips.

## Notes

- Sound starts on the first click or keypress — browsers block autoplay until
  the user interacts with the page.
- Tested on current Chromium-based browsers. Needs Web Audio and `clip-path`.
