export type UserRole = "user" | "admin";

export type User = {
  id: string;
  version: number;
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
  version?: number;
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
  version: number;
  commentCount: number;
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
  version: number;
  gymName: string;
  dormitoryName: string;
  maxDaily: number;
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

const LANGUAGE_KEY = "campus-gym-language";
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
    /* Optional preference. */
  }
}
