import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  getData,
  getSessionUser,
  getStoredLanguage,
  saveBookings,
  saveLanguage,
  savePosts,
  saveSession,
  saveSettings,
  updateUser,
  type GymSettings,
  type Post,
  type User,
} from "./services/storage";
import { isCurrentWeekDate } from "./lib/date";
import type { Booking, Language } from "./types";
import type { AppView } from "./types";
import useMediaQuery from "./hooks/useMediaQuery";
import { Sidebar, Topbar } from "./components/Navigation";
import { bookingError } from "./lib/booking";
const LoginScreen = lazy(() => import("./pages/LoginScreen"));
const HomePage = lazy(() => import("./pages/HomePage"));
const SchedulePage = lazy(() => import("./pages/SchedulePage"));
const BookingModal = lazy(() => import("./pages/BookingModal"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const NewsPage = lazy(() =>
  import("./pages/NewsPages").then((m) => ({ default: m.NewsPage })),
);
const PostDetailPage = lazy(() =>
  import("./pages/NewsPages").then((m) => ({ default: m.PostDetailPage })),
);
function GymApp() {
  const [initialData] = useState(getData);
  const [language, setLanguageState] = useState<Language>(getStoredLanguage);
  const [currentUser, setCurrentUser] = useState<User | null>(getSessionUser);
  const [users, setUsers] = useState<User[]>(() => initialData.users);
  const [view, setViewState] = useState<AppView>(() => {
    const sessionUser = getSessionUser();
    if (!sessionUser) return "home";
    if (!sessionUser.verified && sessionUser.role === "user") return "profile";
    return sessionUser.role === "admin" ? "admin" : "home";
  });
  const [bookings, setBookings] = useState<Booking[]>(() => {
    const sessionUser = getSessionUser();
    return initialData.bookings.map((booking) => ({
      ...booking,
      mine: booking.userId === sessionUser?.id,
    }));
  });
  const [posts, setPosts] = useState<Post[]>(() => initialData.posts);
  const [settings, setSettings] = useState<GymSettings>(
    () => initialData.settings,
  );
  const [bookingModal, setBookingModal] = useState<{
    date: string;
    bookingId?: number;
  } | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const mobile = useMediaQuery("(max-width: 820px)");
  const admin = currentUser?.role === "admin";
  const setView = (next: AppView) => {
    const hash = "#" + next;
    if (window.location.hash !== hash) window.history.pushState(null, "", hash);
    setViewState(next);
  };
  useEffect(() => {
    const sync = () => {
      const next = window.location.hash.slice(1);
      const allowed = [
        "home",
        "news",
        "schedule",
        "profile",
        ...(admin ? ["admin"] : []),
      ];
      if (currentUser && allowed.includes(next)) {
        setViewState(
          !currentUser.verified && !admin ? "profile" : (next as AppView),
        );
      }
    };
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, [currentUser, admin]);

  const setLanguage = (next: Language) => {
    setLanguageState(next);
    saveLanguage(next);
  };
  useEffect(() => {
    saveBookings(bookings);
  }, [bookings]);
  useEffect(() => {
    savePosts(posts);
  }, [posts]);
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);
  const appTitle = useMemo(
    () =>
      view === "schedule"
        ? "Terminarz"
        : view === "post"
          ? "Aktualność"
          : view === "news"
            ? "Aktualności"
            : view === "profile"
              ? "Profil"
              : view === "admin"
                ? "Panel administratora"
                : settings.gymName,
    [view, settings.gymName],
  );
  useEffect(() => {
    document.title = appTitle;
    document.documentElement.lang = language;
  }, [appTitle, language]);
  const startSession = (user: User, isNew = false) => {
    setCurrentUser(user);
    setUsers(getData().users);
    saveSession(user.id);
    setBookings(
      getData().bookings.map((booking) => ({
        ...booking,
        mine: booking.userId === user.id,
      })),
    );
    setView(
      isNew || (!user.verified && user.role === "user")
        ? "profile"
        : user.role === "admin"
          ? "admin"
          : "home",
    );
  };
  if (!currentUser)
    return (
      <LoginScreen
        language={language}
        setLanguage={setLanguage}
        onLogin={(user) => startSession(user)}
        onRegister={(user) => startSession(user, true)}
        gymName={settings.gymName}
        registrationEnabled={settings.registrationEnabled}
      />
    );
  const openBookingModal = (date: string, bookingId?: number) => {
    if (!admin && (!currentUser.verified || !isCurrentWeekDate(date))) return;
    if (
      bookingId &&
      !admin &&
      !bookings.some((b) => b.id === bookingId && b.userId === currentUser.id)
    )
      return;
    setBookingModal({ date, bookingId });
  };
  const saveBooking = (start: string, end: string, bookingId?: number) => {
    if (!bookingModal || (!admin && !isCurrentWeekDate(bookingModal.date)))
      return;
    if (!admin && !currentUser.verified) return;
    const target = bookingId
      ? bookings.find((b) => b.id === bookingId)
      : bookings.find(
          (b) => b.date === bookingModal.date && b.userId === currentUser.id,
        );
    if (target && !admin && target.userId !== currentUser.id) return;
    if (
      bookingError(
        bookings,
        { date: bookingModal.date, start, end },
        settings.maxConcurrent,
        target?.id,
      )
    )
      return;
    setBookings((all) => {
      const existing = bookingId
        ? all.find((booking) => booking.id === bookingId)
        : all.find(
            (booking) =>
              booking.date === bookingModal.date && booking.mine && !admin,
          );
      if (existing)
        return all.map((booking) =>
          booking.id === existing.id
            ? { ...booking, start, end, cancelled: false }
            : booking,
        );
      return [
        ...all,
        {
          id: Date.now(),
          userId: currentUser.id,
          date: bookingModal.date,
          name: `${currentUser.firstName} ${currentUser.lastName}`,
          initials:
            `${currentUser.firstName[0] ?? ""}${currentUser.lastName[0] ?? ""}`.toUpperCase(),
          start,
          end,
          color: "green",
          mine: true,
        },
      ];
    });
    setBookingModal(null);
  };
  const selectedPost = posts.find((post) => post.id === selectedPostId);
  return (
    <div className="app-shell flex min-h-dvh">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3"
      >
        {language === "pl" ? "Przejdz do tresci" : "Skip to content"}
      </a>
      <Sidebar
        view={view}
        setView={setView}
        language={language}
        admin={admin}
        verified={currentUser.verified || currentUser.role === "admin"}
        gymName={settings.gymName}
        logout={() => {
          saveSession(null);
          setCurrentUser(null);
          setView("home");
        }}
        open={menuOpen}
        setOpen={setMenuOpen}
      />
      {menuOpen && (
        <div
          className="sidebar-scrim fixed inset-0 z-20 hidden bg-black/45 max-[820px]:block"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <main
        id="main-content"
        tabIndex={-1}
        inert={mobile && menuOpen}
        className="app-main ml-[246px] min-w-0 w-[calc(100%-246px)] max-[820px]:ml-0 max-[820px]:w-full"
      >
        <Topbar
          language={language}
          setLanguage={setLanguage}
          user={currentUser}
          setOpen={setMenuOpen}
          openProfile={() => setView("profile")}
        />
        {view === "home" && (
          <HomePage
            language={language}
            bookings={bookings}
            user={currentUser}
            posts={posts}
            settings={settings}
            openBooking={openBookingModal}
            openSchedule={() => setView("schedule")}
            openNews={() => setView("news")}
            openPost={(postId) => {
              setSelectedPostId(postId);
              setView("post");
            }}
          />
        )}
        {view === "news" && (
          <NewsPage
            language={language}
            posts={posts}
            openPost={(postId) => {
              setSelectedPostId(postId);
              setView("post");
            }}
          />
        )}
        {view === "post" && selectedPost && (
          <PostDetailPage
            language={language}
            post={selectedPost}
            user={currentUser}
            back={() => setView("news")}
            addComment={(comment) =>
              setPosts((all) =>
                all.map((entry) =>
                  entry.id === selectedPost.id
                    ? {
                        ...entry,
                        comments: [...entry.comments, comment],
                      }
                    : entry,
                ),
              )
            }
          />
        )}
        {view === "profile" && (
          <ProfilePage
            language={language}
            user={currentUser}
            onSave={(updated) => {
              const saved = updateUser(updated);
              setCurrentUser(saved);
              setUsers((all) =>
                all.map((user) => (user.id === saved.id ? saved : user)),
              );
              setBookings((all) =>
                all.map((booking) =>
                  booking.userId === saved.id
                    ? {
                        ...booking,
                        name: `${saved.firstName} ${saved.lastName}`,
                        initials:
                          `${saved.firstName[0] ?? ""}${saved.lastName[0] ?? ""}`.toUpperCase(),
                      }
                    : booking,
                ),
              );
            }}
          />
        )}
        {view === "schedule" && (
          <SchedulePage
            language={language}
            bookings={bookings}
            setBookings={setBookings}
            openBooking={openBookingModal}
            settings={settings}
            isAdmin={admin}
          />
        )}
        {view === "admin" && admin && (
          <AdminPage
            language={language}
            users={users}
            bookings={bookings}
            posts={posts}
            setPosts={setPosts}
            settings={settings}
            setSettings={setSettings}
            onVerify={(user) => {
              const saved = updateUser(user);
              setUsers((all) =>
                all.map((entry) => (entry.id === saved.id ? saved : entry)),
              );
            }}
          />
        )}
      </main>
      {bookingModal && (
        <BookingModal
          date={bookingModal.date}
          bookingId={bookingModal.bookingId}
          bookings={bookings}
          close={() => setBookingModal(null)}
          save={saveBooking}
          language={language}
          isAdmin={admin}
          maxConcurrent={settings.maxConcurrent}
        />
      )}
    </div>
  );
}
export default function App() {
  return (
    <Suspense
      fallback={
        <div
          className="loading-state grid min-h-dvh place-items-center"
          role="status"
        >
          {"Loading Campus Gym\u2026"}
        </div>
      }
    >
      <GymApp />
    </Suspense>
  );
}
