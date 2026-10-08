export type Language = "pl" | "en";

export type Booking = {
  id: number;
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
  "home" | "news" | "post" | "schedule" | "profile" | "admin";
export type AdminView =
  "overview" | "posts" | "users" | "activity" | "settings";
