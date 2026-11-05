# Chess Clock

A chess clock for the BUSY Bar. The app runs entirely on the bar (on-device JavaScript, written in TypeScript) and only talks to the local API at `http://localhost/api/...`: it makes no external network request.

App id: `com.thomascarvalho.chessclock`.

## Controls

One big button serves both players: each press stops the running clock and starts the other one.

| State | Big button | Wheel click (OK) | Wheel | Back (short) |
| --- | --- | --- | --- | --- |
| `SETUP` | confirms the time control | confirms the time control | changes the time control | quits the app |
| `READY` | starts the clock of the side that moves first | — | picks the side that moves first | back to setup |
| `RUNNING` | ends the move: adds the increment, passes the turn | pause | — | ignored |
| `PAUSED` | ignored | resume | — | back to setup |
| `FINISHED` | ignored | — | — | back to setup |

- The left clock starts by default. In `READY`, one click of the wheel hands the first move to the other side; the clock that will start is shown in green.
- The big button acts when it goes down, not when it is released: time stops the moment the button is hit.
- Back is ignored while a clock is running, to avoid accidental resets. Pause first.
- A long press of Back is reserved by the system: it force-quits the app.

## Display

- **Front:** both times side by side, player 1 on the left. The running clock (or the one that will start) is bright green, the other is dimmed, a paused clock is orange, and any time under 10 seconds is red. Times read `M:SS`, then seconds and tenths (`9.9`) under 10 seconds. If the bar takes too long to redraw, the app falls back to whole seconds on its own.
- **Back:** time control, state, move number, who lost on time, and a reminder of the controls that apply in the current state.

When a flag falls the game freezes, the loser's time reads zero in red and a sound is played.

## Time controls

`1+0`, `3+0`, `3+2`, `5+0`, `5+3`, `10+0`, `10+5`, `15+10`, `30+0`, then the `Custom` time control defined in the settings. The first number is the starting time in minutes, the second the increment in seconds added after each move (Fischer increment, credited after the move: a 3+2 game starts at 3:00).

## Settings

Editable on the bar or in its web interface. They are read at launch: restart the app after a change.

| Setting | Type | Default | Purpose |
| --- | --- | --- | --- |
| Default time control | list | `5+3` | time control selected when the app opens |
| Custom: minutes | integer, 1 to 180 | 7 | starting time of the Custom time control |
| Custom: increment (s) | integer, 0 to 60 | 3 | increment of the Custom time control |
| Sound | on/off | on | turns every sound of the app on or off |
| Beep under 10 s | on/off | on | one beep when the running clock drops under 10 seconds |

## Installation

Requires Node 24 (not Node 26), pnpm, and a BUSY Bar connected over USB or reachable over Wi-Fi.

```sh
pnpm install
pnpm build          # produces dist/com.thomascarvalho.chessclock.tgz
pnpm app:install    # uploads the package to the bar (USB, 10.0.4.20)
pnpm app:run        # launches the app
```

Over Wi-Fi, add `--addr <host>` (and `--password <password>` if password protection is enabled) to the `app:*` commands. Never pass `--addr` to `pnpm build`.

## Development

```sh
pnpm test           # unit tests, on Node, no bar needed
pnpm typecheck
pnpm sounds         # regenerates src/sounds/*.snd
pnpm app:stop       # quits the app on the bar
pnpm app:uninstall  # removes it (settings are kept)
```

| File | Role |
| --- | --- |
| `src/game.ts` | the clock: state machine, time, increment, flag. Pure, no I/O |
| `src/format.ts` | how a clock reads, and when that reading next changes |
| `src/view.ts` | game state → elements for both displays |
| `src/painter.ts` | sends the bar only the elements that changed, one request at a time |
| `src/input.ts` | bar keys → game actions |
| `src/cues.ts` | which sound a change of state calls for |
| `src/settings.ts`, `src/timeControls.ts` | settings and the list of time controls |
| `src/main.ts` | wiring: input, timer, sounds, cleanup on exit |
| `shared/device.ts` | HTTP client for the bar |

Remaining time is always computed from the difference between timestamps taken at each press; the timer only decides when to redraw.

## Known limits

- The bar only exposes a wall clock: if it resets its time mid-game (network sync), the running clock jumps by the same amount. A clock that moves backwards never gives time back.
- No Bronstein delay, no handicap, no time correction while paused, no multi-period time controls.
