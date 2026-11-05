// The device's HTTP API. Everything the app sends to the BUSY Bar goes through here, and only to
// endpoints an app is allowed to call: display/draw, audio/play and apps/settings.

/** Fonts the display accepts. */
export type DeviceFont =
  | "tiny"
  | "small"
  | "normal"
  | "condensed"
  | "bold"
  | "large"
  | "extra_large"
  | "global"
  | "superscript";

/** Which point of the element sits at (x, y). */
export type Align =
  | "top_left"
  | "top_mid"
  | "top_right"
  | "mid_left"
  | "center"
  | "mid_right"
  | "bottom_left"
  | "bottom_mid"
  | "bottom_right";

export interface TextElement {
  type: "text";
  /** Unique identifier; the device replaces an element with the same id. */
  id: string;
  /** Printable ASCII only. */
  text: string;
  font: DeviceFont;
  /** #RRGGBBAA. */
  color: string;
  x: number;
  y: number;
  align?: Align;
  /** The 72×16 LED front, or the 160×80 greyscale back. */
  display: "front" | "back";
}

export interface RectangleElement {
  type: "rectangle";
  id: string;
  /** Top-left corner. */
  x: number;
  y: number;
  width: number;
  height: number;
  fill: "solid";
  /** One #RRGGBBAA colour for a solid fill. */
  fill_colors: [string];
  /** 0: the firmware draws a 1-pixel white border by default. */
  border_width: 0;
  display: "front" | "back";
}

export interface ImageElement {
  type: "image";
  id: string;
  /** Path of a .png inside the app's package, e.g. "appmeta/icon_front_8x8.png". */
  path: string;
  /** Top-left corner. */
  x: number;
  y: number;
  display: "front" | "back";
}

export type DisplayElement = TextElement | RectangleElement | ImageElement;

export interface AppSettingsDocument {
  version: number;
  /** Keyed by field id. */
  values: Record<string, unknown>;
}

/** Device address, set at build time with `busy-cli build --addr`; `localhost` on the bar itself. */
const addr = __BUSY_ADDR__;
const API = `${/^https?:\/\//i.test(addr) ? addr : `http://${addr}`}/api`;

const JSON_HEADERS = { "Content-Type": "application/json" };

/** A request the device has not answered after this long is counted as failed. */
const REPLY_TIMEOUT_MS = 5000;

/**
 * Hands a request to the device without waiting for the reply, and reports how it went exactly once.
 * @param done - Called with an error message on failure, undefined on success.
 */
function send(path: string, method: string, body: string, done: (error: string | undefined) => void): void {
  let settled = false;

  const settle = (error: string | undefined) => {
    if (settled) return;

    settled = true;
    clearTimeout(timer);
    done(error);
  };

  const timer = setTimeout(() => settle(`no reply in ${REPLY_TIMEOUT_MS} ms`), REPLY_TIMEOUT_MS);

  fetch(`${API}${path}`, { method, headers: JSON_HEADERS, body }).then(
    (res) => settle(res.ok ? undefined : `HTTP ${res.status}`),
    (err) => settle(err instanceof Error ? err.message : String(err)),
  );
}

/** Draws elements. Elements are replaced by id, so only what changed needs to be sent. */
export function displayDraw(app: string, elements: DisplayElement[], done: (error: string | undefined) => void): void {
  send("/display/draw", "POST", JSON.stringify({ application_name: app, priority: 50, elements }), done);
}

/** Removes the app's elements: the ones listed, or all of them when `ids` is omitted. */
export function displayClear(app: string, ids: string[] | undefined, done: (error: string | undefined) => void): void {
  const body = ids === undefined ? { application_name: app } : { application_name: app, element_ids: ids };
  send("/display/draw", "DELETE", JSON.stringify(body), done);
}

/** Plays a sound packaged with the app, e.g. "sounds/flag.snd". */
export function audioPlay(app: string, path: string, done: (error: string | undefined) => void): void {
  send("/audio/play", "POST", JSON.stringify({ application_name: app, path }), done);
}

/** The app's stored settings; the first read fills in the defaults from appmeta/settings.json. */
export async function getAppSettings(app: string): Promise<AppSettingsDocument> {
  const res = await fetch(`${API}/apps/settings?app_id=${encodeURIComponent(app)}`);

  if (!res.ok) {
    throw new Error(`apps/settings: HTTP ${res.status}`);
  }

  return (await res.json()) as AppSettingsDocument;
}
