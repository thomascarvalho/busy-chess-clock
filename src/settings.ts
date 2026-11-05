// The settings described by appmeta/settings.json. Pure: reading them from the device is main.ts's job.

/** Must match "version" in appmeta/settings.json. */
export const SETTINGS_VERSION = 1;

export interface Settings {
  /** A preset label such as "5+3", or "custom". */
  defaultControl: string;
  customMinutes: number;
  /** Seconds added per move. */
  customIncrement: number;
  sound: boolean;
  lowTimeBeep: boolean;
}

/** Mirrors the "default" of every field in appmeta/settings.json; used when the device has no settings to give. */
export const DEFAULTS: Settings = {
  defaultControl: "5+3",
  customMinutes: 7,
  customIncrement: 3,
  sound: true,
  lowTimeBeep: true,
};

/** Same bounds as "min" and "max" in appmeta/settings.json. */
const MINUTES = { min: 1, max: 180 };
const INCREMENT = { min: 0, max: 60 };

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readInteger(value: unknown, fallback: number, range: { min: number; max: number }): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(range.max, Math.max(range.min, Math.round(value)));
}

/** Reads the stored values; anything missing or of the wrong type falls back to its default. */
export function readSettings(values: Record<string, unknown> | null | undefined): Settings {
  const stored = values ?? {};
  const control = stored["default_time_control"];

  return {
    defaultControl: typeof control === "string" ? control : DEFAULTS.defaultControl,
    customMinutes: readInteger(stored["custom_minutes"], DEFAULTS.customMinutes, MINUTES),
    customIncrement: readInteger(stored["custom_increment"], DEFAULTS.customIncrement, INCREMENT),
    sound: readBoolean(stored["sound"], DEFAULTS.sound),
    lowTimeBeep: readBoolean(stored["low_time_beep"], DEFAULTS.lowTimeBeep),
  };
}
