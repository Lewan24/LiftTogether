import { validateProfile } from "../lib/validation";
export type UserRole = "user" | "admin";

export type User = {
  id: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  email: string;
  dormitory: string;
  room: string;
  facebookUrl: string;
  verified: boolean;
  phone?: string;
};

export type StoredBooking = {
  id: number;
  userId: string;
  date: string;
  name: string;
  initials: string;
  start: string;
  end: string;
  color: string;
  cancelled?: boolean;
};

export type Post = {
  id: number;
  titlePl: string;
  titleEn: string;
  contentPl: string;
  contentEn: string;
  createdAt: string;
  author: string;
  important?: boolean;
  comments: PostComment[];
  status: "published" | "draft";
};

export type PostComment = {
  id: number;
  userId: string;
  author: string;
  initials: string;
  content: string;
  createdAt: string;
};

export type GymSettings = {
  gymName: string;
  dormitoryName: string;
  maxConcurrent: number;
  registrationEnabled: boolean;
  defaultCalendarView: "week" | "month";
};

export type AppData = {
  version: number;
  users: User[];
  bookings: StoredBooking[];
  posts: Post[];
  settings: GymSettings;
};

const DATA_KEY = "campus-gym-data-v4";
const SESSION_KEY = "campus-gym-session-v1";
const LANGUAGE_KEY = "campus-gym-language";

const users: User[] = [
  {
    id: "user-demo",
    role: "user",
    firstName: "Aleksandra",
    lastName: "Nowak",
    email: "demo@campus.pl",
    dormitory: "DS 3",
    room: "214",
    facebookUrl: "https://facebook.com/aleksandra.nowak",
    verified: true,
    phone: "+48 500 200 100",
  },
  {
    id: "admin-demo",
    role: "admin",
    firstName: "Michał",
    lastName: "Kowalski",
    email: "admin@campus.pl",
    dormitory: "DS 3",
    room: "Administracja",
    facebookUrl: "",
    verified: true,
    phone: "+48 500 100 200",
  },
  {
    id: "user-marek",
    role: "user",
    firstName: "Marek",
    lastName: "Krawczyk",
    email: "marek@campus.pl",
    dormitory: "DS 3",
    room: "102",
    facebookUrl: "https://facebook.com/marek.krawczyk",
    verified: true,
  },
  {
    id: "user-zofia",
    role: "user",
    firstName: "Zofia",
    lastName: "Wójcik",
    email: "zofia@campus.pl",
    dormitory: "DS 3",
    room: "18",
    facebookUrl: "https://facebook.com/zofia.wojcik",
    verified: true,
  },
  {
    id: "user-maria",
    role: "user",
    firstName: "Maria",
    lastName: "Sowa",
    email: "maria@campus.pl",
    dormitory: "DS 3",
    room: "108",
    facebookUrl: "https://facebook.com/maria.sowa",
    verified: false,
  },
  {
    id: "user-igor",
    role: "user",
    firstName: "Igor",
    lastName: "Lis",
    email: "igor@campus.pl",
    dormitory: "DS 3",
    room: "312",
    facebookUrl: "https://facebook.com/igor.lis",
    verified: false,
  },
];

const seedData: AppData = {
  version: 4,
  users,
  bookings: [
    {
      id: 1,
      userId: "user-marek",
      date: "2026-10-05",
      name: "Marek Krawczyk",
      initials: "MK",
      start: "07:00",
      end: "08:30",
      color: "blue",
    },
    {
      id: 2,
      userId: "user-zofia",
      date: "2026-10-05",
      name: "Zofia Wójcik",
      initials: "ZW",
      start: "17:30",
      end: "19:30",
      color: "yellow",
    },
    {
      id: 3,
      userId: "user-demo",
      date: "2026-10-06",
      name: "Aleksandra Nowak",
      initials: "AN",
      start: "18:00",
      end: "19:30",
      color: "green",
    },
    {
      id: 4,
      userId: "user-marek",
      date: "2026-10-06",
      name: "Marek Krawczyk",
      initials: "MK",
      start: "20:00",
      end: "21:00",
      color: "blue",
    },
    {
      id: 5,
      userId: "user-zofia",
      date: "2026-10-07",
      name: "Zofia Wójcik",
      initials: "ZW",
      start: "08:30",
      end: "10:00",
      color: "peach",
    },
    {
      id: 6,
      userId: "user-marek",
      date: "2026-10-08",
      name: "Marek Krawczyk",
      initials: "MK",
      start: "17:00",
      end: "19:00",
      color: "yellow",
    },
    {
      id: 7,
      userId: "user-zofia",
      date: "2026-10-09",
      name: "Zofia Wójcik",
      initials: "ZW",
      start: "15:30",
      end: "17:00",
      color: "blue",
    },
    {
      id: 8,
      userId: "user-marek",
      date: "2026-10-10",
      name: "Marek Krawczyk",
      initials: "MK",
      start: "10:00",
      end: "12:00",
      color: "green",
    },
  ],
  posts: [
    {
      id: 1,
      titlePl: "Nowe godziny otwarcia siłowni DS 3",
      titleEn: "New DS 3 gym opening hours",
      contentPl:
        "Od tego tygodnia siłownia jest dostępna codziennie od 6:00 do 24:00. Pamiętaj o zapisach w terminarzu.",
      contentEn:
        "Starting this week, the gym is open daily from 6 AM to midnight. Remember to book your session.",
      createdAt: "2026-10-04T10:00:00",
      author: "Administracja DS 3",
      important: true,
      comments: [
        {
          id: 101,
          userId: "user-marek",
          author: "Marek Krawczyk",
          initials: "MK",
          content: "Super, późniejsze godziny bardzo się przydadzą.",
          createdAt: "2026-10-04T12:15:00",
        },
        {
          id: 102,
          userId: "user-zofia",
          author: "Zofia Wójcik",
          initials: "ZW",
          content: "Dzięki za informację!",
          createdAt: "2026-10-04T13:40:00",
        },
      ],
      status: "published",
    },
    {
      id: 2,
      titlePl: "Przerwa techniczna — sobota 10.10",
      titleEn: "Maintenance break — Saturday, Oct 10",
      contentPl:
        "W godzinach 13:00–15:00 siłownia będzie niedostępna z powodu przeglądu sprzętu.",
      contentEn:
        "The gym will be closed from 1–3 PM for equipment maintenance.",
      createdAt: "2026-10-02T16:30:00",
      author: "Administracja DS 3",
      comments: [
        {
          id: 201,
          userId: "user-demo",
          author: "Aleksandra Nowak",
          initials: "AN",
          content:
            "Czy zapisy z tego przedziału zostaną automatycznie anulowane?",
          createdAt: "2026-10-02T18:10:00",
        },
      ],
      status: "published",
    },
    {
      id: 3,
      titlePl: "Dbajmy wspólnie o porządek",
      titleEn: "Let's keep the gym tidy",
      contentPl:
        "Po treningu odłóż sprzęt na miejsce i pozostaw stanowisko gotowe dla kolejnej osoby.",
      contentEn:
        "After your workout, return equipment and leave the station ready for the next person.",
      createdAt: "2026-09-29T09:00:00",
      author: "Administracja DS 3",
      comments: [],
      status: "published",
    },
  ],
  settings: {
    gymName: "Siłownia DS 3",
    dormitoryName: "Dom Studencki nr 3",
    maxConcurrent: 8,
    registrationEnabled: true,
    defaultCalendarView: "week",
  },
};

// Demo-only repository. Never persist credentials, profiles or sessions in browser storage.
let memory: AppData | undefined;
let sessionId: string | null = null;
const credentials = new Map(
  users.map((user) => [
    user.id,
    user.role === "admin" ? "admin123" : "demo123",
  ]),
);
function saveData(data: AppData) {
  memory = structuredClone(data);
}
export function getData(): AppData {
  if (!memory) {
    memory = structuredClone(seedData);
    try {
      localStorage.removeItem(DATA_KEY);
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* Storage may be disabled. */
    }
  }
  return structuredClone(memory);
}

export function authenticate(email: string, password: string): User | null {
  const normalized = email.trim().toLowerCase();
  return (
    getData().users.find(
      (user) =>
        user.email.toLowerCase() === normalized &&
        credentials.get(user.id) === password,
    ) ?? null
  );
}

export function createUser(
  input: Omit<User, "id" | "role" | "verified"> & { password: string },
): User {
  const data = getData();
  validateProfile(input);
  if (
    !data.settings.registrationEnabled ||
    input.password.length < 8 ||
    input.password.length > 128
  )
    throw new Error("INVALID_REGISTRATION");
  if (
    data.users.some(
      (user) => user.email.toLowerCase() === input.email.toLowerCase(),
    )
  )
    throw new Error("EMAIL_EXISTS");
  const { password, ...profile } = input;
  const user: User = {
    ...profile,
    id: `user-${crypto.randomUUID()}`,
    role: "user",
    verified: false,
  };
  credentials.set(user.id, password);
  data.users.push(user);
  saveData(data);
  return user;
}

export function updateUser(updated: User): User {
  validateProfile(updated);
  const data = getData();
  const original = data.users.find((user) => user.id === updated.id);
  const actor = data.users.find((user) => user.id === sessionId);
  if (
    !original ||
    !actor ||
    (actor.id !== updated.id && actor.role !== "admin")
  )
    throw new Error("FORBIDDEN");
  if (
    data.users.some(
      (user) =>
        user.id !== updated.id &&
        user.email.toLowerCase() === updated.email.toLowerCase(),
    )
  )
    throw new Error("EMAIL_EXISTS");
  updated = {
    ...updated,
    role: original.role,
    verified: actor.role === "admin" ? updated.verified : original.verified,
  };
  data.users = data.users.map((user) =>
    user.id === updated.id ? updated : user,
  );
  data.bookings = data.bookings.map((booking) =>
    booking.userId === updated.id
      ? {
          ...booking,
          name: `${updated.firstName} ${updated.lastName}`,
          initials:
            `${updated.firstName[0] ?? ""}${updated.lastName[0] ?? ""}`.toUpperCase(),
        }
      : booking,
  );
  saveData(data);
  return updated;
}

export function saveBookings(
  bookings: Array<StoredBooking & { mine?: boolean }>,
) {
  const data = getData();
  data.bookings = bookings.map(({ mine: _mine, ...booking }) => booking);
  saveData(data);
}

export function savePosts(posts: Post[]) {
  const data = getData();
  data.posts = posts;
  saveData(data);
}

export function saveSettings(settings: GymSettings) {
  const data = getData();
  data.settings = settings;
  saveData(data);
}

export function saveSession(userId: string | null) {
  sessionId = userId;
}
export function getSessionUser(): User | null {
  return sessionId
    ? (getData().users.find((user) => user.id === sessionId) ?? null)
    : null;
}

export function getStoredLanguage(): "pl" | "en" {
  try {
    return localStorage.getItem(LANGUAGE_KEY) === "en" ? "en" : "pl";
  } catch {
    return "pl";
  }
}

export function saveLanguage(language: "pl" | "en") {
  try {
    localStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    // Polish remains the default.
  }
}

export const demoAccounts = {
  user: { email: "demo@campus.pl", password: "demo123" },
  admin: { email: "admin@campus.pl", password: "admin123" },
};
