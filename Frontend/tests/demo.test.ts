import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mockRequest,
  resetDemo,
  DEMO_PASSWORD,
  DEMO_STORAGE_KEY,
} from "../src/services/mock.ts";
import { ApiError } from "../src/services/http.ts";
import {
  userSchema,
  settingsSchema,
  bookingSchema,
  postSchema,
} from "../src/services/contracts.ts";
import { gymToday, dateFromIso, addDays, toIsoDate } from "../src/lib/date.ts";

function storage() {
  const values = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
  };
}
const login = async (email = "admin@demo.example", password = DEMO_PASSWORD) =>
  userSchema.parse(
    await mockRequest("auth/login", {
      method: "POST",
      body: { email, password },
    }),
  );
const code = (expected: string) => (error: unknown) =>
  error instanceof ApiError && error.code === expected;

test("demo persists sessions and settings without HTTP or plaintext passwords", async () => {
  storage();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("Demo must not use HTTP");
  };
  try {
    const settings = settingsSchema.parse(await mockRequest("public"));
    assert.equal(await mockRequest("auth/me"), null);
    const admin = await login();
    assert.equal(userSchema.parse(await mockRequest("auth/me")).id, admin.id);
    await mockRequest("settings", {
      method: "PATCH",
      body: { ...settings, gymName: "My demo gym" },
    });
    assert.equal(
      settingsSchema.parse(await mockRequest("public")).gymName,
      "My demo gym",
    );
    await assert.rejects(
      mockRequest("settings", { method: "PATCH", body: settings }),
      code("CONFLICT_REFRESH"),
    );
    const raw = localStorage.getItem(DEMO_STORAGE_KEY)!;
    assert.ok(!raw.includes(DEMO_PASSWORD));
    await mockRequest("auth/logout", { method: "POST" });
    assert.equal(await mockRequest("auth/me"), null);
    await resetDemo();
    assert.equal(
      settingsSchema.parse(await mockRequest("public")).gymName,
      "Lift Together · Demo",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("demo enforces registration, verification, ownership, capacity and stale cancellation", async () => {
  storage();
  const registered = userSchema.parse(
    await mockRequest("auth/register", {
      method: "POST",
      body: {
        firstName: "Demo",
        lastName: "Member",
        email: "new@demo.example",
        dormitory: "DS 3",
        room: "1",
        facebookUrl: "",
        password: "Registered-password!",
        role: "admin",
        verified: true,
      },
    }),
  );
  assert.equal(registered.role, "user");
  assert.equal(registered.verified, false);
  await assert.rejects(mockRequest("bookings"), code("FORBIDDEN"));
  await login();
  const settings = settingsSchema.parse(await mockRequest("public"));
  await mockRequest("settings", {
    method: "PATCH",
    body: { ...settings, maxDaily: 1 },
  });
  await mockRequest(`users/${registered.id}/verification`, {
    method: "PATCH",
    body: { verified: true, version: registered.version },
  });
  const member = await login("member@demo.example");
  const date = gymToday();
  const booking = bookingSchema.parse(
    await mockRequest("bookings", {
      method: "POST",
      body: { date, start: "07:00", end: "08:00" },
    }),
  );
  assert.equal(booking.userId, member.id);
  await login("new@demo.example", "Registered-password!");
  await assert.rejects(
    mockRequest(`bookings/${booking.id}/cancel`, {
      method: "POST",
      body: { version: booking.version },
    }),
    code("FORBIDDEN"),
  );
  await assert.rejects(
    mockRequest("bookings", {
      method: "POST",
      body: { date, start: "10:00", end: "11:00" },
    }),
    code("DAILY_CAPACITY_FULL"),
  );
  await login("member@demo.example");
  await assert.rejects(
    mockRequest(`bookings/${booking.id}/cancel`, {
      method: "POST",
      body: { version: 0 },
    }),
    code("CONFLICT_REFRESH"),
  );
  await mockRequest(`bookings/${booking.id}/cancel`, {
    method: "POST",
    body: { version: booking.version },
  });
  await login("new@demo.example", "Registered-password!");
  bookingSchema.parse(
    await mockRequest("bookings", {
      method: "POST",
      body: { date, start: "10:00", end: "11:00" },
    }),
  );
  await mockRequest("auth/password", {
    method: "POST",
    body: {
      currentPassword: "Registered-password!",
      newPassword: " New demo password! ",
    },
  });
  await assert.rejects(
    login("new@demo.example", "Registered-password!"),
    code("INVALID_CREDENTIALS"),
  );
  await login("new@demo.example", " New demo password! ");
});

test("demo keeps drafts private and reports full storage without losing saved data", async () => {
  storage();
  await login();
  const draft = postSchema.parse(
    await mockRequest("posts", {
      method: "POST",
      body: {
        titlePl: "Draft",
        titleEn: "Draft",
        contentPl: "Private",
        contentEn: "Private",
        status: "draft",
        important: false,
      },
    }),
  );
  await login("member@demo.example");
  await assert.rejects(mockRequest(`posts/${draft.id}`), code("NOT_FOUND"));
  const saved = localStorage.getItem(DEMO_STORAGE_KEY);
  const originalSet = localStorage.setItem;
  localStorage.setItem = () => {
    throw new Error("Quota exceeded");
  };
  await assert.rejects(
    mockRequest("auth/logout", { method: "POST" }),
    code("DEMO_STORAGE_FULL"),
  );
  localStorage.setItem = originalSet;
  assert.equal(localStorage.getItem(DEMO_STORAGE_KEY), saved);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(mockRequest("public", { signal: controller.signal }));
});

test("demo reports corrupt or disabled storage and serializes reset", async () => {
  storage();
  localStorage.setItem(DEMO_STORAGE_KEY, "broken JSON");
  await assert.rejects(mockRequest("public"), code("DEMO_STORAGE_INVALID"));
  await resetDemo();
  settingsSchema.parse(await mockRequest("public"));
  const originalGet = localStorage.getItem;
  localStorage.getItem = () => {
    throw new Error("Storage disabled");
  };
  await assert.rejects(mockRequest("public"), code("DEMO_STORAGE_UNAVAILABLE"));
  localStorage.getItem = originalGet;
  await Promise.all([mockRequest("public"), resetDemo()]);
  assert.equal(localStorage.getItem(DEMO_STORAGE_KEY), null);
});

test("admin creates and edits members and activity records actual actions", async () => {
  storage();
  const admin = await login();
  const input = {
    firstName: "Created",
    lastName: "Member",
    email: "created@demo.example",
    dormitory: "DS 3",
    room: "123",
    facebookUrl: "",
    phone: "",
    verified: true,
    password: "Created-password-2026!",
    version: 0,
    role: "admin",
  };
  const created = userSchema.parse(
    await mockRequest("users", { method: "POST", body: input }),
  );
  assert.equal(created.role, "user");
  const updated = userSchema.parse(
    await mockRequest(`users/${created.id}`, {
      method: "PATCH",
      body: { ...created, room: "456", password: "" },
    }),
  );
  assert.equal(updated.room, "456");
  await assert.rejects(
    mockRequest(`users/${created.id}`, {
      method: "PATCH",
      body: { ...created, password: "" },
    }),
    code("CONFLICT_REFRESH"),
  );
  const { auditPageSchema, forumSchema } =
    await import("../src/services/contracts.ts");
  const audit = auditPageSchema.parse(await mockRequest("audit"));
  assert.deepEqual(
    audit.entries.slice(0, 2).map((entry) => entry.action),
    ["member.update", "member.create"],
  );
  assert.equal(audit.entries[0].actorId, admin.id);
  assert.ok(
    forumSchema
      .parse(await mockRequest("forum"))
      .discussions.some(
        (topic) => topic.pinned && topic.title.includes("Gym regulations"),
      ),
  );
  await login(created.email, input.password);
  await assert.rejects(
    mockRequest("users", { method: "POST", body: input }),
    code("FORBIDDEN"),
  );
  await assert.rejects(mockRequest("audit"), code("FORBIDDEN"));
  await login();
  await mockRequest(`users/${updated.id}`, {
    method: "PATCH",
    body: { ...updated, password: "Reset-password-2026!" },
  });
  await assert.rejects(
    login(created.email, input.password),
    code("INVALID_CREDENTIALS"),
  );
  await login(created.email, "Reset-password-2026!");
});

test("past dates are blocked for members; dashboard counts all records and excludes drafts", async () => {
  storage();
  const member = await login("member@demo.example");
  const yesterday = toIsoDate(addDays(dateFromIso(gymToday()), -1));
  await assert.rejects(
    mockRequest("bookings", {
      method: "POST",
      body: { date: yesterday, start: "07:00", end: "08:00" },
    }),
    code("BOOKING_WINDOW_CLOSED"),
  );
  await login();
  const pastBooking = bookingSchema.parse(
    await mockRequest("bookings", {
      method: "POST",
      body: { date: yesterday, start: "07:00", end: "08:00" },
    }),
  );
  assert.equal(pastBooking.date, yesterday);
  const state = JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY)!);
  state.bookings = [
    {
      ...pastBooking,
      id: 10,
      date: "2026-10-01",
      userId: member.id,
      cancelled: false,
    },
    {
      ...pastBooking,
      id: 11,
      date: "2026-10-08",
      userId: member.id,
      cancelled: false,
    },
    {
      ...pastBooking,
      id: 12,
      date: "2026-10-15",
      userId: state.users[0].id,
      cancelled: true,
    },
  ];
  const topic = state.discussions[0];
  for (let index = 0; index < 60; index++)
    state.discussions.push({ ...topic, id: crypto.randomUUID() });
  state.posts.push({
    ...state.posts[0],
    id: 2,
    status: "draft",
    titlePl: "Hidden draft",
    titleEn: "Hidden draft",
  });
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
  const { statisticsSchema, dashboardSchema } =
    await import("../src/services/contracts.ts");
  const statistics = statisticsSchema.parse(
    await mockRequest("admin/statistics", {
      query: { period: "month", date: "2026-10-01" },
    }),
  );
  assert.equal(statistics.totalUsers, 2);
  assert.equal(statistics.forumTopics, 62);
  assert.equal(statistics.daily.length, 31);
  assert.equal(statistics.bookings, 2);
  assert.equal(statistics.cancelledBookings, 1);
  assert.equal(statistics.trainingMembers, 1);
  assert.equal(statistics.busiestWeekday, 4);
  assert.equal(
    statistics.weekdays.find((day) => day.weekday === 4)!.average,
    0.4,
  );
  assert.equal(statistics.averageDailyBookings, 0.06);
  const summary = dashboardSchema.parse(await mockRequest("dashboard"));
  assert.equal(summary.forumTopics, 62);
  assert.equal(summary.newsPosts, 1);
  assert.ok(
    !summary.latestNews.some((post) => post.titleEn === "Hidden draft"),
  );
  await login("member@demo.example");
  await assert.rejects(mockRequest("admin/statistics"), code("FORBIDDEN"));
});
