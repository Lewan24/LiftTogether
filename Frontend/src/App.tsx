import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { z } from "zod";
import {
  getStoredLanguage,
  saveLanguage,
  type GymSettings,
  type Post,
  type User,
} from "./services/storage";
import {
  api,
  apiMessage,
  bookingSchema,
  clearCsrf,
  noContent,
  postDetailSchema,
  postPageSchema,
  postSchema,
  settingsSchema,
  userSchema,
  usersPageSchema,
} from "./services/api";
import { getForum, type ForumData } from "./services/forum";
import { addDays, isCurrentWeekDate, startOfWeek, toIsoDate } from "./lib/date";
import type { Booking, Language, AppView } from "./types";
import useMediaQuery from "./hooks/useMediaQuery";
import { Sidebar, Topbar } from "./components/Navigation";
import { Button } from "./components/ui";
import Pagination from "./components/Pagination";
const LoginScreen = lazy(() => import("./pages/LoginScreen"));
const HomePage = lazy(() => import("./pages/HomePage"));
const SchedulePage = lazy(() => import("./pages/SchedulePage"));
const BookingModal = lazy(() => import("./pages/BookingModal"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const ForumPage = lazy(() => import("./pages/ForumPage"));
const NewsPage = lazy(() =>
  import("./pages/NewsPages").then((m) => ({ default: m.NewsPage })),
);
const PostDetailPage = lazy(() =>
  import("./pages/NewsPages").then((m) => ({ default: m.PostDetailPage })),
);
function GymApp() {
  const [language, setLanguageState] = useState<Language>(getStoredLanguage);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<GymSettings | null>(null);
  const [users, setUsers] = useState<User[]>([]),
    [bookings, setBookings] = useState<Booking[]>([]),
    [posts, setPosts] = useState<Post[]>([]);
  const [forum, setForum] = useState<ForumData>({
    categories: [],
    discussions: [],
    page: 0,
    hasMore: false,
  });
  const [view, setViewState] = useState<AppView>("home"),
    [menuOpen, setMenuOpen] = useState(false);
  const [bookingModal, setBookingModal] = useState<{
    date: string;
    bookingId?: number;
  } | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [postsPage, setPostsPage] = useState(0),
    [postsMore, setPostsMore] = useState(false),
    [usersPage, setUsersPage] = useState(0),
    [usersMore, setUsersMore] = useState(false);
  const [commentsPage, setCommentsPage] = useState(0),
    [commentsMore, setCommentsMore] = useState(false);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const mobile = useMediaQuery("(max-width: 820px)"),
    admin = currentUser?.role === "admin";
  const rangeRef = useRef({
    from: toIsoDate(startOfWeek(new Date())),
    to: toIsoDate(addDays(startOfWeek(new Date()), 6)),
  });
  const requestSequence = useRef(0);
  const loadBookings = useCallback(
    async (
      from = rangeRef.current.from,
      to = rangeRef.current.to,
      userId?: string,
    ) => {
      const sequence = ++requestSequence.current;
      rangeRef.current = { from, to };
      const result = await api("bookings", z.array(bookingSchema), {
        query: { from, to },
      });
      if (sequence === requestSequence.current)
        setBookings(
          result.map((b) => ({
            ...b,
            mine: b.userId === (userId ?? currentUser?.id),
          })),
        );
    },
    [currentUser?.id],
  );
  const loadPosts = useCallback(async (page = 0) => {
    const result = await api("posts", postPageSchema, { query: { page } });
    setPosts(result.posts);
    setPostsPage(page);
    setPostsMore(result.hasMore);
  }, []);
  const loadUsers = useCallback(async (page = 0) => {
    const result = await api("users", usersPageSchema, { query: { page } });
    setUsers(result.users);
    setUsersPage(page);
    setUsersMore(result.hasMore);
  }, []);
  const loadMemberData = useCallback(
    async (user: User) => {
      if (!user.verified && user.role !== "admin") return;
      await Promise.all([
        loadBookings(undefined, undefined, user.id),
        loadPosts(),
        getForum(0).then(setForum),
        ...(user.role === "admin" ? [loadUsers()] : []),
      ]);
    },
    [loadBookings, loadPosts, loadUsers],
  );
  async function initialize() {
    setLoading(true);
    setError("");
    try {
      const [configuration, user] = await Promise.all([
        api("public", settingsSchema),
        api("auth/me", userSchema.nullable()),
      ]);
      setSettings(configuration);
      setCurrentUser(user);
      if (user) {
        await loadMemberData(user);
        const hash = window.location.hash.slice(1);
        setViewState(
          !user.verified && user.role !== "admin"
            ? "profile"
            : [
                  "home",
                  "news",
                  "schedule",
                  "profile",
                  "forum",
                  ...(user.role === "admin" ? ["admin"] : []),
                ].includes(hash)
              ? (hash as AppView)
              : "home",
        );
      }
    } catch (e) {
      setError(apiMessage(e, language));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void initialize();
  }, []);
  useEffect(() => {
    const expired = () => {
      setCurrentUser(null);
      setBookings([]);
      setPosts([]);
      setUsers([]);
      setForum({ categories: [], discussions: [], page: 0, hasMore: false });
      setBookingModal(null);
      clearCsrf();
    };
    window.addEventListener("session-expired", expired);
    return () => window.removeEventListener("session-expired", expired);
  }, []);
  const setView = (next: AppView) => {
    setError("");
    window.history.pushState(null, "", `#${next}`);
    setViewState(next);
    if (next === "home" && currentUser && (currentUser.verified || admin))
      void loadBookings(
        toIsoDate(startOfWeek(new Date())),
        toIsoDate(addDays(startOfWeek(new Date()), 6)),
      ).catch((e) => setError(apiMessage(e, language)));
    if (next === "home" || next === "news")
      void loadPosts(0).catch((e) => setError(apiMessage(e, language)));
  };
  useEffect(() => {
    const sync = () => {
      const next = window.location.hash.slice(1);
      if (
        currentUser &&
        [
          "home",
          "news",
          "schedule",
          "profile",
          "forum",
          ...(admin ? ["admin"] : []),
        ].includes(next)
      )
        setViewState(
          !currentUser.verified && !admin ? "profile" : (next as AppView),
        );
    };
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, [currentUser, admin]);
  useEffect(() => {
    document.title =
      view === "forum"
        ? "Forum · Lift Together"
        : (settings?.gymName ?? "Lift Together");
    document.documentElement.lang = language;
  }, [view, settings?.gymName, language]);
  // Refresh permission and verification changes when a member returns to the app.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible" || !currentUser) return;
      void api("auth/me", userSchema.nullable())
        .then(async (u) => {
          if (!u) {
            window.dispatchEvent(new Event("session-expired"));
            return;
          }
          setCurrentUser(u);
          if (!u.verified && u.role !== "admin") setViewState("profile");
          else if (!currentUser.verified && u.verified) await loadMemberData(u);
        })
        .catch((e) => setError(apiMessage(e, language)));
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [currentUser, language, loadMemberData]);
  const setLanguage = (next: Language) => {
    setLanguageState(next);
    saveLanguage(next);
  };
  async function startSession(user: User) {
    clearCsrf();
    setCurrentUser(user);
    setLoading(true);
    try {
      await loadMemberData(user);
      setView(
        !user.verified && user.role !== "admin"
          ? "profile"
          : user.role === "admin"
            ? "admin"
            : "home",
      );
    } catch (e) {
      setError(apiMessage(e, language));
    } finally {
      setLoading(false);
    }
  }
  async function run(action: () => Promise<unknown>) {
    try {
      setError("");
      await action();
    } catch (e) {
      setError(apiMessage(e, language));
    }
  }
  const openPost = async (id: number, page = 0) => {
    const result = await api(`posts/${id}`, postDetailSchema, {
      query: { page },
    });
    setSelectedPost(result.post);
    setCommentsPage(page);
    setCommentsMore(result.hasMore);
    setViewState("post");
  };
  if (loading)
    return (
      <div className="grid min-h-dvh place-items-center" role="status">
        {language === "pl" ? "Wczytywanie…" : "Loading…"}
      </div>
    );
  if (!settings)
    return (
      <div className="mx-auto max-w-lg p-8">
        <p role="alert" className="mb-4">
          {error}
        </p>
        <Button onClick={() => void initialize()}>
          {language === "pl" ? "Spróbuj ponownie" : "Retry connection"}
        </Button>
      </div>
    );
  if (!currentUser)
    return (
      <LoginScreen
        language={language}
        setLanguage={setLanguage}
        onLogin={startSession}
        onRegister={startSession}
        gymName={settings.gymName}
        registrationEnabled={settings.registrationEnabled}
      />
    );
  const openBookingModal = (date: string, bookingId?: number) => {
    if (!admin && (!currentUser.verified || !isCurrentWeekDate(date))) return;
    setBookingModal({ date, bookingId });
  };
  const saveBooking = async (
    start: string,
    end: string,
    bookingId?: number,
  ) => {
    if (!bookingModal) return;
    const target = bookingId
      ? bookings.find((b) => b.id === bookingId)
      : bookings.find(
          (b) => b.userId === currentUser.id && b.date === bookingModal.date,
        );
    await api(target ? `bookings/${target.id}` : "bookings", bookingSchema, {
      method: target ? "PATCH" : "POST",
      body: {
        date: bookingModal.date,
        start,
        end,
        version: target?.version ?? 0,
      },
    });
    await loadBookings();
    setBookingModal(null);
  };
  return (
    <div className="app-shell flex min-h-dvh">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:p-3"
      >
        {language === "pl" ? "Przejdź do treści" : "Skip to content"}
      </a>
      <Sidebar
        view={view}
        setView={setView}
        language={language}
        admin={admin}
        verified={currentUser.verified || admin}
        gymName={settings.gymName}
        logout={() =>
          void run(async () => {
            await api("auth/logout", noContent, { method: "POST" });
            window.dispatchEvent(new Event("session-expired"));
            setViewState("home");
          })
        }
        open={menuOpen}
        setOpen={setMenuOpen}
      />
      {menuOpen && (
        <div
          className="fixed inset-0 z-20 hidden bg-black/45 max-[820px]:block"
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
        {error && (
          <div
            role="alert"
            className="mx-[4%] mt-4 rounded-lg bg-[#f8e8e6] p-4 text-[var(--red)]"
          >
            {error}
            <Button variant="ghost" onClick={() => void initialize()}>
              {language === "pl" ? "Odśwież dane" : "Reload data"}
            </Button>
          </div>
        )}
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
            openPost={(id) => void run(() => openPost(id))}
          />
        )}
        {view === "news" && (
          <>
            <NewsPage
              language={language}
              posts={posts}
              openPost={(id) => void run(() => openPost(id))}
            />
            <Pagination
              language={language}
              page={postsPage}
              hasMore={postsMore}
              onChange={(p) => void run(() => loadPosts(p))}
            />
          </>
        )}
        {view === "forum" && (
          <ForumPage
            language={language}
            user={currentUser}
            data={forum}
            onChange={setForum}
          />
        )}
        {view === "post" && selectedPost && (
          <>
            <PostDetailPage
              language={language}
              post={selectedPost}
              user={currentUser}
              back={() => setView("news")}
              addComment={async (comment) => {
                await api(`posts/${selectedPost.id}/comments`, noContent, {
                  method: "POST",
                  body: { content: comment.content },
                });
                await openPost(selectedPost.id);
              }}
              deleteComment={async (id) => {
                await api(
                  `posts/${selectedPost.id}/comments/${id}`,
                  noContent,
                  { method: "DELETE" },
                );
                await openPost(selectedPost.id, commentsPage);
              }}
            />
            <Pagination
              language={language}
              page={commentsPage}
              hasMore={commentsMore}
              onChange={(p) => void run(() => openPost(selectedPost.id, p))}
            />
          </>
        )}
        {view === "profile" && (
          <ProfilePage
            key={currentUser.id}
            language={language}
            user={currentUser}
            onSave={async (updated) => {
              const saved = await api("auth/profile", userSchema, {
                method: "PATCH",
                body: updated,
              });
              setCurrentUser(saved);
              if (saved.verified || admin) await loadBookings();
            }}
          />
        )}
        {view === "schedule" && (
          <SchedulePage
            language={language}
            bookings={bookings}
            openBooking={openBookingModal}
            settings={settings}
            isAdmin={admin}
            onRangeChange={(from, to) => void run(() => loadBookings(from, to))}
            cancelBooking={(id) =>
              void run(async () => {
                await api(`bookings/${id}/cancel`, noContent, {
                  method: "POST",
                });
                await loadBookings();
              })
            }
            deleteBooking={(id) =>
              void run(async () => {
                await api(`bookings/${id}`, noContent, { method: "DELETE" });
                await loadBookings();
              })
            }
          />
        )}
        {view === "admin" && admin && (
          <AdminPage
            user={currentUser}
            forum={forum}
            setForum={setForum}
            language={language}
            users={users}
            bookings={bookings}
            posts={posts}
            settings={settings}
            onVerify={async (user) => {
              const saved = await api(
                `users/${user.id}/verification`,
                userSchema,
                {
                  method: "PATCH",
                  body: { verified: user.verified, version: user.version },
                },
              );
              setUsers((all) =>
                all.map((u) => (u.id === saved.id ? saved : u)),
              );
            }}
            onSavePost={async (post, id) => {
              await api(id ? `posts/${id}` : "posts", postSchema, {
                method: id ? "PATCH" : "POST",
                body: post,
              });
              await loadPosts(postsPage);
            }}
            onDeletePost={async (id) => {
              await api(`posts/${id}`, noContent, { method: "DELETE" });
              await loadPosts(postsPage);
            }}
            onSaveSettings={async (s) =>
              setSettings(
                await api("settings", settingsSchema, {
                  method: "PATCH",
                  body: s,
                }),
              )
            }
            postsPagination={
              <Pagination
                language={language}
                page={postsPage}
                hasMore={postsMore}
                onChange={(p) => void run(() => loadPosts(p))}
              />
            }
            usersPagination={
              <Pagination
                language={language}
                page={usersPage}
                hasMore={usersMore}
                onChange={(p) => void run(() => loadUsers(p))}
              />
            }
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
          maxDaily={settings.maxDaily}
          userId={currentUser.id}
        />
      )}
    </div>
  );
}
export default function App() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-dvh place-items-center" role="status">
          Loading…
        </div>
      }
    >
      <GymApp />
    </Suspense>
  );
}
