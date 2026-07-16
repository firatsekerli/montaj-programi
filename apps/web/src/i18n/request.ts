import { getRequestConfig } from "next-intl/server";
import tr from "../../messages/tr.json";

/**
 * Single-locale setup (Turkish) — no locale prefix in the URL. Adding another
 * language later means loading a different catalog here; no UI code changes,
 * because every string already goes through next-intl.
 */
export const DEFAULT_LOCALE = "tr" as const;
export const APP_TIMEZONE = "Europe/Istanbul";

export default getRequestConfig(async () => ({
  locale: DEFAULT_LOCALE,
  timeZone: APP_TIMEZONE,
  messages: tr,
}));
