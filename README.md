# Chess Clock

A chess clock for the BUSY Bar. The app runs entirely on the bar (on-device JavaScript, written in TypeScript) and only talks to the local API at `http://localhost/api/...`: it makes no external network request.

App id: `com.thomascarvalho.chessclock`. It needs a bar with HTTP API 27.12.0 or later, and was developed and tested on firmware 1.3.1 (HTTP API 27.14.0).

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

- **Front, in setup:** the knight next to the time control, with two dim arrows as a reminder that the wheel changes it.
- **Front, during a game:** both times side by side, player 1 on the left, each above a one-pixel gauge that empties as its time runs out. The running clock (or the one that will start) is bright green, the other is dimmed, a paused clock is orange, and any time under 10 seconds is red. Times read `M:SS`, then seconds and tenths (`9.9`) under 10 seconds. If the bar takes too long to redraw, the app falls back to whole seconds on its own.
- **Front, between the clocks:** a thin divider, replaced by a pause sign while paused.
- **Back:** the knight, the time control and the state at the top; then whose move it is, pushed to that player's side with an arrow; the move number; and a reminder of the controls that apply in the current state.

When a flag falls the game freezes, the loser's time reads zero in red and flashes for a few seconds, the back says who lost on time, and a sound is played.

## Time controls

The wheel steps through `1+0`, `3+0`, `3+2`, `5+0`, `5+3`, `10+0`, `10+5`, `15+10`, `30+0`, then a tenth time control of your own, defined in the settings (`7+3` unless you change it). The first number is the starting time in minutes, the second the bonus in seconds added to a player's clock after each of their moves (Fischer increment, credited after the move: a 3+2 game starts at 3:00).

The app opens on the time control of the last game played, `10+0` the first time. Turn the wheel in `SETUP` to pick another one; it becomes the new starting point as soon as a game is started with it.

## Settings

Editable on the bar (app menu, then Setup) or in its web interface. They are read at launch: restart the app after a change.

| Setting | Type | Default | Purpose |
| --- | --- | --- | --- |
| Custom time (min) | integer, 1 to 180 | 7 | starting time of your own time control, the tenth entry of the wheel |
| Custom bonus per move (s) | integer, 0 to 60 | 3 | seconds added after each move in that time control; 0 for none |
| Sound | on/off | on | turns every sound of the app on or off |
| Beep under 10 s | on/off | on | one beep when the running clock drops under 10 seconds; needs Sound on |

With the defaults, the tenth entry of the wheel reads `7+3`. Set the two custom values to 20 and 5 and it reads `20+5`.

## Installation

### From a release

No build needed. Download `com.thomascarvalho.chessclock-<version>.tgz` from the [latest release](https://github.com/thomascarvalho/busy-chess-clock/releases/latest), then send it to the bar connected over USB, either way:

With the official CLI (needs Node 20 or later):

```sh
npx -p @busy-app/cli busy-cli app install com.thomascarvalho.chessclock-0.1.0.tgz
```

Or with nothing but curl, in two requests; the second takes the `install_key` the first one answers with:

```sh
curl -X POST 'http://10.0.4.20/api/apps/stage' --data-binary '@com.thomascarvalho.chessclock-0.1.0.tgz'
curl -X POST 'http://10.0.4.20/api/apps/install?install_key=<install_key>'
```

The app then shows up in the bar's Apps menu.

Over Wi-Fi, HTTP API access must be enabled in the bar's web interface (Network, then HTTP API). Add `--addr <host>` to the CLI command, plus `--password <password>` if password protection is on. With curl, use the bar's address instead of `10.0.4.20` and send the password in an `X-API-Token` header.

### From source

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
pnpm icons          # regenerates the two app icons in src/appmeta/
pnpm app:stop       # quits the app on the bar
pnpm app:uninstall  # removes it (settings are kept)
```

| File | Role |
| --- | --- |
| `src/game.ts` | the clock: state machine, time, increment, flag. Pure, no I/O |
| `src/format.ts` | how a clock reads, and when that reading next changes |
| `src/redraw.ts` | how long to wait before the display has to be drawn again |
| `src/view.ts` | game state → elements for both displays |
| `src/painter.ts` | sends the bar only the elements that changed, one request at a time |
| `src/input.ts` | bar keys → game actions |
| `src/cues.ts` | which sound a change of state calls for |
| `src/latency.ts` | bookkeeping for how long the bar takes to answer |
| `src/settings.ts`, `src/timeControls.ts` | settings and the list of time controls |
| `src/memory.ts` | remembers the time control of the last game across launches |
| `src/main.ts` | wiring: input, timer, sounds, cleanup on exit |
| `shared/device.ts` | HTTP client for the bar |
| `tools/` | scripts that generate the sounds and the icons |
| `test/` | unit tests for everything above except `main.ts` and `device.ts` |

Remaining time is always computed from the difference between timestamps taken at each press; the timer only decides when to redraw.

When you go back to setup after a game, or quit the app, it writes one line to the bar's log with the delay between a press and the screen showing it, how long draws took and how late its timer fired. It also logs any draw or timer more than 250 ms late.

## Known limits

- The bar only exposes a wall clock: if it resets its time mid-game (network sync), the running clock jumps by the same amount. A clock that moves backwards never gives time back.
- No Bronstein delay, no handicap, no time correction while paused, no multi-period time controls.

## License

[MIT](LICENSE)
