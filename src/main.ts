import { audioPlay, displayClear, displayDraw, getAppSettings } from "@shared/device";
import manifest from "./appmeta/manifest.json";
import { cueFor, type Cue } from "./cues.ts";
import { isLow, msUntilNextChange } from "./format.ts";
import { newGame, remainingMs, step, type Action, type Game } from "./game.ts";
import { toAction } from "./input.ts";
import { Latency } from "./latency.ts";
import { Painter } from "./painter.ts";
import { DEFAULTS, readSettings, SETTINGS_VERSION, type Settings } from "./settings.ts";
import { buildControls, controlIndex } from "./timeControls.ts";
import { frame } from "./view.ts";

/** The name the app draws under; the device clears elements by this id. */
const APP = manifest.id;

/** The runtime does not fire a timer sooner than this. */
const MIN_TIMER_MS = 10;

/** How long after a request the device did not take the frame is sent again. */
const RETRY_MS = 1000;

/**
 * Tenths need a redraw every 100 ms. When the device takes longer than this to answer a draw, it
 * cannot keep up, and the last ten seconds are drawn in whole seconds instead.
 */
const TENTHS_BUDGET_MS = 70;

/** Draws to see before judging the device: the first frame is the largest and by far the slowest. */
const TENTHS_MIN_DRAWS = 8;

/** What the device answers when asked to clear elements it is not showing. */
const ALREADY_GONE = "HTTP 400";

const SOUNDS: Record<Cue, string> = {
  flag: "sounds/flag.snd",
  low: "sounds/low.snd",
};

/** Read once at startup; a change takes effect when the app is restarted. */
let settings: Settings = DEFAULTS;

let game: Game = newGame(buildControls({ minutes: DEFAULTS.customMinutes, increment: DEFAULTS.customIncrement }), 0);

/** False until the settings are in: nothing is drawn and no game input is taken before that. */
let loaded = false;
let stopped = false;

/** Whether the last ten seconds are drawn in tenths. Dropped for good once the device proves too slow. */
let tenths = true;

/** Whether the running clock displayed under ten seconds when last looked at. */
let wasLow = false;

/** Fires when the running clock's reading next changes, or when its flag falls. */
let clockTimer: ReturnType<typeof setTimeout> | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let unbindInput: BusyUnbind | undefined;

/** How long the device takes to answer a draw. */
const drawTime = new Latency();
/** From the big button going down to the device confirming the frame that shows it. */
const pressToScreen = new Latency();
/** When the press whose frame is not confirmed yet happened. */
let pressedAt: number | undefined;

function report(what: string, error: unknown): void {
  console.error(`${APP}: ${what}: ${error instanceof Error ? error.message : String(error)}`);
}

const painter = new Painter({
  draw(elements) {
    const sentAt = Date.now();
    displayDraw(APP, elements, (error) => {
      if (error === undefined) drawTime.add(Date.now() - sentAt);
      settled("draw", error);
    });
  },
  clear(ids) {
    // A 400 on a clear means the device no longer has those elements, which is what was asked for.
    displayClear(APP, ids, (error) => settled("clear", error === ALREADY_GONE ? undefined : error));
  },
});

/** The device answered a draw or a clear. */
function settled(what: string, error: string | undefined): void {
  if (error !== undefined) report(what, error);

  painter.settled(error !== undefined);
  if (stopped) return;

  if (error !== undefined) {
    // Not right away: a device in trouble gets a moment before the frame is sent again.
    if (retryTimer === undefined) {
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        paint(Date.now());
      }, RETRY_MS);
    }
    return;
  }

  // Nothing left in flight: the frame for the last press is on screen.
  if (pressedAt !== undefined && !painter.busy()) {
    pressToScreen.add(Date.now() - pressedAt);
    pressedAt = undefined;
  }

  const typical = drawTime.smoothed();
  if (tenths && typical !== undefined && drawTime.count >= TENTHS_MIN_DRAWS && typical > TENTHS_BUDGET_MS) {
    tenths = false;
    console.info(`${APP}: draws take about ${Math.round(typical)} ms, showing whole seconds only`);
    schedule();
  }
}

function paint(now: number): void {
  if (stopped || !loaded) return;
  painter.paint(frame(game, now, tenths));
}

function play(cue: Cue): void {
  audioPlay(APP, SOUNDS[cue], (error) => {
    if (error !== undefined) report(`sound ${cue}`, error);
  });
}

/** Arms the one timer the app runs on: the next moment the running clock reads differently, or flags. */
function schedule(): void {
  if (clockTimer !== undefined) {
    clearTimeout(clockTimer);
    clockTimer = undefined;
  }

  if (stopped || game.phase !== "running") return;

  // Always from the timestamps, so a late timer shortens the next wait instead of adding up.
  const left = remainingMs(game, game.active, Date.now());

  clockTimer = setTimeout(
    () => {
      clockTimer = undefined;
      dispatch({ type: "tick" }, Date.now());
    },
    Math.max(MIN_TIMER_MS, msUntilNextChange(left, tenths)),
  );
}

/** Presses already covered by a latency line, so the same figures are not logged twice. */
let reportedPresses = 0;

function logLatency(): void {
  if (pressToScreen.count === reportedPresses) return;
  reportedPresses = pressToScreen.count;

  console.info(
    `${APP}: press to screen ${pressToScreen.average()} ms avg, ${pressToScreen.max} ms max over ${pressToScreen.count} presses; ` +
      `draw ${drawTime.average()} ms avg, ${drawTime.max} ms max over ${drawTime.count} draws; tenths ${tenths ? "on" : "off"}`,
  );
}

/**
 * Applies an input or a tick that happened at `now`, then brings the sound, the screen and the timer in line.
 * @param redraw - Redraw even if the action changed nothing.
 */
function dispatch(action: Action, now: number, redraw = false): void {
  const before = game;
  game = step(game, action, now);

  // An input that changes nothing needs no redraw; a tick always does, the clock moved on.
  if (game === before && action.type !== "tick" && !redraw) return;

  const low = game.phase === "running" && isLow(remainingMs(game, game.active, now), tenths);
  const cue = cueFor(before, game, wasLow, low, settings);
  wasLow = low;
  if (cue !== null) play(cue);

  if (action.type === "start" && game !== before) pressedAt = now;

  // Back to setup: the game is over, say how the device kept up with it.
  if (game.phase === "setup" && before.phase !== "setup") logLatency();

  paint(now);
  schedule();
}

/**
 * Stops the app: clears every timer, wipes both displays and detaches the input handler.
 *
 * The request that clears the displays is not waited for: the runtime keeps the app alive until it
 * settles. The unbind waits for a timer: it is the last handle, and this is called from inside the
 * input handler, which is still running.
 */
function stop(): void {
  if (stopped) return;

  stopped = true;

  if (clockTimer !== undefined) clearTimeout(clockTimer);
  if (retryTimer !== undefined) clearTimeout(retryTimer);
  clockTimer = undefined;
  retryTimer = undefined;

  painter.stop();
  logLatency();

  displayClear(APP, undefined, (error) => {
    if (error !== undefined) report("clear on exit", error);
  });

  const unbind = unbindInput;
  unbindInput = undefined;
  if (unbind !== undefined) {
    setTimeout(unbind, 0);
  }
}

/** Reads the settings document. A failure or a version mismatch falls back to the defaults, so the app still runs. */
async function loadSettings(): Promise<Settings> {
  try {
    const { version, values } = await getAppSettings(APP);

    if (version !== SETTINGS_VERSION) {
      console.info(`${APP}: settings version ${version} != ${SETTINGS_VERSION}, using defaults`);
      return DEFAULTS;
    }

    return readSettings(values);
  } catch (error) {
    report("settings unavailable, using defaults", error);
    return DEFAULTS;
  }
}

/**
 * Entry point, called at the end of the file: the device runs this script from top to bottom and starts nothing by itself.
 */
function main(): void {
  unbindInput = listen("input", (event) => {
    // Before anything else: this is the moment the press counts from.
    const now = Date.now();

    if (stopped) return;

    const action = toAction(event);
    if (action === null) return;

    // The clock only resets from a pause or a finished game, so setup is the one place Back can leave from.
    if (action.type === "back" && game.phase === "setup") {
      stop();
      return;
    }

    if (!loaded) return;

    if (action.type === "back") {
      // On a short press of Back the firmware wipes everything the app has drawn, whether or not
      // the app acts on the key. Everything is drawn again, including when Back is ignored mid-game.
      painter.invalidate();
      dispatch(action, now, true);
      return;
    }

    dispatch(action, now);
  });

  void loadSettings().then((stored) => {
    if (stopped) return;

    settings = stored;

    const controls = buildControls({ minutes: stored.customMinutes, increment: stored.customIncrement });
    game = newGame(controls, controlIndex(controls, stored.defaultControl));
    loaded = true;

    paint(Date.now());
  });
}

main();
