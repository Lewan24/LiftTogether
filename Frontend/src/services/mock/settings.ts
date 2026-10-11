import { requireValue, text, version, type MemberContext } from "./state.ts";

export async function handleSettings(context: MemberContext): Promise<unknown> {
  const { state, body, user } = context;
  const admin = () => requireValue(user.role === "admin", "FORBIDDEN", 403);
  admin();
  version(body, state.settings);
  requireValue(
    Number.isInteger(body.nextWeekReleaseDay) &&
      Number(body.nextWeekReleaseDay) >= 0 &&
      Number(body.nextWeekReleaseDay) <= 6 &&
      typeof body.nextWeekReleaseTime === "string" &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(body.nextWeekReleaseTime) &&
      Number.isInteger(body.maxDaily) &&
      Number(body.maxDaily) >= 1 &&
      Number(body.maxDaily) <= 100 &&
      ["week", "month"].includes(String(body.defaultCalendarView)) &&
      typeof body.registrationEnabled === "boolean",
  );
  Object.assign(state.settings, {
    gymName: text(body.gymName, 100),
    dormitoryName: text(body.dormitoryName, 100),
    maxDaily: Number(body.maxDaily),
    nextWeekReleaseDay: Number(body.nextWeekReleaseDay),
    nextWeekReleaseTime: body.nextWeekReleaseTime,
    defaultCalendarView: body.defaultCalendarView,
    registrationEnabled: body.registrationEnabled,
    version: state.settings.version + 1,
  });
  return state.settings;
}
