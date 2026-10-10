export type Language = "pl" | "en";

export type Booking = {
  id: number;
  version?: number;
  userId: string;
  date: string;
  name: string;
  initials: string;
  start: string;
  end: string;
  color: string;
  mine?: boolean;
  cancelled?: boolean;
};

export type AppView =
  "home" | "news" | "post" | "schedule" | "profile" | "admin" | "forum";
export type AdminView =
  | "overview"
  | "posts"
  | "users"
  | "activity"
  | "settings"
  | "forum"
  | "categories";
