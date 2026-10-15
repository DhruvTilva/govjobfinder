import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { LANG_COOKIE, makeT, parseLang } from "./i18n";

/** Current interface language (from the visitor's cookie) and its translator. Cached per request. */
export const getI18n = cache(async () => {
  const lang = parseLang((await cookies()).get(LANG_COOKIE)?.value);
  return { lang, t: makeT(lang) };
});
