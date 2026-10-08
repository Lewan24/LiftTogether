import { useState } from "react";
import { type GymSettings, type Post, type User } from "../services/storage";
import { dateFromIso, formatDate } from "../lib/date";
import type { Booking, Language } from "../types";
import {
  Button,
  Field,
  Icon,
  PageHeader,
  type IconName,
} from "../components/ui";
import type { AdminView } from "../types";
import { safeProfileUrl } from "../lib/validation";
import Dialog from "../components/Dialog";
export default function AdminPage({
  language,
  users,
  onVerify,
  bookings,
  posts,
  setPosts,
  settings,
  setSettings,
}: {
  language: Language;
  users: User[];
  onVerify: (user: User) => void;
  bookings: Booking[];
  posts: Post[];
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>;
  settings: GymSettings;
  setSettings: React.Dispatch<React.SetStateAction<GymSettings>>;
}) {
  const [tab, setTab] = useState<AdminView>("overview");
  const [postModal, setPostModal] = useState(false);
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [postTitle, setPostTitle] = useState("");
  const [postContent, setPostContent] = useState("");
  const [userFilter, setUserFilter] = useState<"pending" | "active" | "all">(
    "pending",
  );
  const [search, setSearch] = useState("");
  const [postSearch, setPostSearch] = useState("");
  const displayedPosts = posts.filter((post) =>
    `${post.titlePl} ${post.titleEn} ${post.contentPl} ${post.contentEn}`
      .toLocaleLowerCase()
      .includes(postSearch.trim().toLocaleLowerCase()),
  );
  const members = users.filter((user) => user.role === "user");
  const pendingUsers = members.filter((user) => !user.verified);
  const filteredUsers =
    userFilter === "pending"
      ? pendingUsers
      : userFilter === "active"
        ? members.filter((user) => user.verified)
        : members;
  const displayedUsers = filteredUsers.filter((user) =>
    `${user.firstName} ${user.lastName} ${user.email} ${user.dormitory} ${user.room}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()),
  );
  const dataActivities = [...bookings]
    .sort((a, b) => `${b.date}${b.start}`.localeCompare(`${a.date}${a.start}`))
    .slice(0, 10)
    .map((booking) => ({
      id: booking.id,
      initials: booking.initials,
      color: booking.color,
      name: booking.name,
      text: booking.cancelled
        ? "zrezygnował z treningu"
        : "ma zapis na trening",
      detail: `${formatDate(dateFromIso(booking.date), language, {
        day: "2-digit",
        month: "2-digit",
      })} · ${booking.start}–${booking.end}`,
      time: booking.cancelled ? "Zrezygnowano" : "Aktywny",
    }));
  const openPostEditor = (post?: Post) => {
    setEditingPostId(post?.id ?? null);
    setPostTitle(post?.titlePl ?? "");
    setPostContent(post?.contentPl ?? "");
    setPostModal(true);
  };
  const storePost = (status: "published" | "draft") => {
    if (
      !postTitle.trim() ||
      !postContent.trim() ||
      postTitle.length > 200 ||
      postContent.length > 10000
    )
      return;
    setPosts((all) => {
      if (editingPostId)
        return all.map((post) =>
          post.id === editingPostId
            ? {
                ...post,
                titlePl: postTitle,
                titleEn: postTitle,
                contentPl: postContent,
                contentEn: postContent,
                status,
              }
            : post,
        );
      return [
        {
          id: Date.now(),
          titlePl: postTitle,
          titleEn: postTitle,
          contentPl: postContent,
          contentEn: postContent,
          createdAt: new Date().toISOString(),
          author: "Administracja DS 3",
          comments: [],
          status,
        },
        ...all,
      ];
    });
    setPostModal(false);
  };
  const tabs: {
    id: AdminView;
    label: string;
    icon: IconName;
  }[] = [
    { id: "overview", label: "Przegląd", icon: "home" },
    { id: "posts", label: "Posty", icon: "message" },
    { id: "users", label: "Użytkownicy", icon: "users" },
    { id: "activity", label: "Aktywność", icon: "activity" },
    { id: "settings", label: "Ustawienia", icon: "settings" },
  ];
  return (
    <div className="page mx-auto max-w-[1540px] px-[4%] pt-11 pb-[70px] max-[820px]:px-[22px] max-[820px]:pt-[30px]">
      <PageHeader
        eyebrow="ZARZĄDZANIE"
        title={language === "pl" ? "Panel administratora" : "Admin panel"}
        subtitle={
          language === "pl"
            ? "Zarządzaj społecznością, zapisami i komunikacją."
            : "Manage your community, bookings and communication."
        }
        action={
          <Button icon="plus" onClick={() => openPostEditor()}>
            Nowy post
          </Button>
        }
      />
      <div className="admin-tabs mb-6 flex gap-1 overflow-x-auto border-b border-[var(--line)] [&_.button]:min-h-[47px] [&_.button]:rounded-none [&_.button]:border-b-[3px] [&_.button]:border-b-transparent [&_.active]:border-b-[var(--green)] [&_.active]:text-[var(--green)]">
        {tabs.map((item) => (
          <Button
            variant="ghost"
            className={tab === item.id ? "active" : ""}
            key={item.id}
            onClick={() => setTab(item.id)}
          >
            <Icon name={item.icon} size={18} />
            {item.label}
            {item.id === "users" && (
              <span className="count-badge inline-grid h-5 min-w-5 place-items-center rounded-full bg-[var(--green-pale)] px-1.5 text-xs font-bold text-[var(--green)]">
                {pendingUsers.length}
              </span>
            )}
          </Button>
        ))}
      </div>
      {tab === "overview" && (
        <>
          <div className="stats-grid mb-[18px] grid grid-cols-4 gap-4 max-[1150px]:grid-cols-2 max-[600px]:grid-cols-1">
            <div className="stat-card flex gap-3 rounded-xl border border-[var(--line)] bg-white p-5 [&_>_div:last-child]:flex [&_>_div:last-child]:flex-col [&_span]:text-xs [&_span]:text-[var(--ink-soft)] [&_strong]:my-1 [&_strong]:font-display [&_strong]:text-[25px] [&_strong]:tabular-nums [&_small]:text-xs [&_small]:text-[var(--green)]">
              <div className="stat-icon green grid size-11 place-items-center rounded-lg text-[var(--green-dark)] [&.blue]:bg-[var(--blue)] [&.yellow]:bg-[var(--yellow)] [&.green]:bg-[var(--green-pale)] [&.peach]:bg-[var(--peach)]">
                <Icon name="users" />
              </div>
              <div>
                <span>Aktywni użytkownicy</span>
                <strong>{members.length}</strong>
                <small>Dane zapisane lokalnie</small>
              </div>
            </div>
            <div className="stat-card flex gap-3 rounded-xl border border-[var(--line)] bg-white p-5 [&_>_div:last-child]:flex [&_>_div:last-child]:flex-col [&_span]:text-xs [&_span]:text-[var(--ink-soft)] [&_strong]:my-1 [&_strong]:font-display [&_strong]:text-[25px] [&_strong]:tabular-nums [&_small]:text-xs [&_small]:text-[var(--green)]">
              <div className="stat-icon blue grid size-11 place-items-center rounded-lg text-[var(--green-dark)] [&.blue]:bg-[var(--blue)] [&.yellow]:bg-[var(--yellow)] [&.green]:bg-[var(--green-pale)] [&.peach]:bg-[var(--peach)]">
                <Icon name="calendar" />
              </div>
              <div>
                <span>Zapisy w tym tygodniu</span>
                <strong>
                  {bookings.filter((booking) => !booking.cancelled).length}
                </strong>
                <small>Dane z terminarza</small>
              </div>
            </div>
            <div className="stat-card flex gap-3 rounded-xl border border-[var(--line)] bg-white p-5 [&_>_div:last-child]:flex [&_>_div:last-child]:flex-col [&_span]:text-xs [&_span]:text-[var(--ink-soft)] [&_strong]:my-1 [&_strong]:font-display [&_strong]:text-[25px] [&_strong]:tabular-nums [&_small]:text-xs [&_small]:text-[var(--green)]">
              <div className="stat-icon yellow grid size-11 place-items-center rounded-lg text-[var(--green-dark)] [&.blue]:bg-[var(--blue)] [&.yellow]:bg-[var(--yellow)] [&.green]:bg-[var(--green-pale)] [&.peach]:bg-[var(--peach)]">
                <Icon name="user-check" />
              </div>
              <div>
                <span>Do weryfikacji</span>
                <strong>{pendingUsers.length}</strong>
                <small>Wymaga uwagi</small>
              </div>
            </div>
            <div className="stat-card flex gap-3 rounded-xl border border-[var(--line)] bg-white p-5 [&_>_div:last-child]:flex [&_>_div:last-child]:flex-col [&_span]:text-xs [&_span]:text-[var(--ink-soft)] [&_strong]:my-1 [&_strong]:font-display [&_strong]:text-[25px] [&_strong]:tabular-nums [&_small]:text-xs [&_small]:text-[var(--green)]">
              <div className="stat-icon peach grid size-11 place-items-center rounded-lg text-[var(--green-dark)] [&.blue]:bg-[var(--blue)] [&.yellow]:bg-[var(--yellow)] [&.green]:bg-[var(--green-pale)] [&.peach]:bg-[var(--peach)]">
                <Icon name="activity" />
              </div>
              <div>
                <span>Rezygnacje</span>
                <strong>7</strong>
                <small>Ostatnie 7 dni</small>
              </div>
            </div>
          </div>
          <div className="admin-grid grid grid-cols-[1.35fr_.8fr] gap-[18px] max-[1150px]:grid-cols-1">
            <section className="admin-card rounded-xl border border-[var(--line)] bg-white p-6">
              <div className="section-heading mb-[18px] flex items-end justify-between gap-5 [&_.eyebrow]:mb-1">
                <div>
                  <div className="eyebrow mb-3 text-xs font-bold tracking-wide text-[var(--green)] [&.light]:text-[var(--lime)]">
                    NAJNOWSZE
                  </div>
                  <div className="section-title font-display text-[21px] font-extrabold tracking-tight">
                    Ostatnia aktywność
                  </div>
                </div>
                <Button
                  variant="ghost"
                  className="text-[color:var(--green)] p-[0] min-h-[auto]"
                  onClick={() => setTab("activity")}
                >
                  Zobacz wszystko
                  <Icon name="arrow" size={15} />
                </Button>
              </div>
              <div className="activity-list">
                {dataActivities.slice(0, 4).map((a) => (
                  <div
                    className="activity-row flex items-center gap-3 border-b border-[var(--line)] py-3 last:border-b-0 [&_>_div:nth-child(2)]:min-w-0 [&_>_div:nth-child(2)]:flex-1 [&_p]:text-sm [&_span]:text-xs [&_span]:text-[var(--ink-soft)] [&_time]:text-xs [&_time]:text-[var(--ink-soft)]"
                    key={a.id}
                  >
                    <div
                      className={`mini-avatar grid size-[31px] shrink-0 place-items-center rounded-full text-xs font-bold text-[var(--green-dark)] [&.blue]:bg-[var(--blue)] [&.yellow]:bg-[var(--yellow)] [&.green]:bg-[var(--green-pale)] [&.peach]:bg-[var(--peach)] ${a.color}  `}
                    >
                      {a.initials}
                    </div>
                    <div>
                      <p>
                        <strong>{a.name}</strong> {a.text}
                      </p>
                      <span>{a.detail}</span>
                    </div>
                    <time>{a.time}</time>
                  </div>
                ))}
              </div>
            </section>
            <section className="admin-card rounded-xl border border-[var(--line)] bg-white p-6">
              <div className="section-heading mb-[18px] flex items-end justify-between gap-5 [&_.eyebrow]:mb-1">
                <div>
                  <div className="eyebrow mb-3 text-xs font-bold tracking-wide text-[var(--green)] [&.light]:text-[var(--lime)]">
                    WERYFIKACJA
                  </div>
                  <div className="section-title font-display text-[21px] font-extrabold tracking-tight">
                    Oczekujący
                  </div>
                </div>
                <span className="count-badge inline-grid h-5 min-w-5 place-items-center rounded-full bg-[var(--green-pale)] px-1.5 text-xs font-bold text-[var(--green)]">
                  {pendingUsers.length}
                </span>
              </div>
              <div className="verify-list">
                {pendingUsers.slice(0, 3).map((user) => {
                  const initials =
                    `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();
                  return (
                    <div
                      className="verify-row flex items-center gap-2 border-b border-[var(--line)] py-3 [&_>_div:nth-child(2)]:flex [&_>_div:nth-child(2)]:min-w-0 [&_>_div:nth-child(2)]:flex-1 [&_>_div:nth-child(2)]:flex-col [&_strong]:text-sm [&_span]:text-xs [&_span]:text-[var(--ink-soft)] [&_a]:text-xs [&_a]:text-[var(--green)]"
                      key={user.id}
                    >
                      <div className="mini-avatar blue grid size-[31px] shrink-0 place-items-center rounded-full text-xs font-bold text-[var(--green-dark)] [&.blue]:bg-[var(--blue)] [&.yellow]:bg-[var(--yellow)] [&.green]:bg-[var(--green-pale)] [&.peach]:bg-[var(--peach)]">
                        {initials}
                      </div>
                      <div>
                        <strong>
                          {user.firstName} {user.lastName}
                        </strong>
                        <span>
                          {user.dormitory} · {user.room}
                        </span>
                        <a
                          href={safeProfileUrl(user.facebookUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Profil Facebook
                        </a>
                      </div>
                      <div className="verify-actions flex gap-1">
                        <Button
                          variant="icon"
                          aria-label="Verify member"
                          onClick={() => onVerify({ ...user, verified: true })}
                        >
                          <Icon name="check" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {pendingUsers.length === 0 && (
                  <p className="empty-text text-sm text-[var(--ink-soft)]">
                    Brak kont oczekujących.
                  </p>
                )}
              </div>
              <Button
                variant="secondary"
                className="full-button mt-[18px] w-full"
                onClick={() => setTab("users")}
              >
                Przejdź do użytkowników
              </Button>
            </section>
          </div>
        </>
      )}
      {tab === "posts" && (
        <section className="admin-card rounded-xl border border-[var(--line)] bg-white p-6">
          <div className="table-toolbar mb-5 flex items-center justify-between gap-3 max-[600px]:flex-col max-[600px]:items-stretch">
            <div className="search-box flex min-w-[280px] items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 [&_input]:min-w-0 [&_input]:w-full [&_input]:bg-transparent [&_input]:text-sm max-[600px]:min-w-0">
              <Icon name="search" />
              <input
                aria-label="Search posts"
                name="post-search"
                autoComplete="off"
                value={postSearch}
                onChange={(event) => setPostSearch(event.target.value)}
                placeholder="Szukaj postów..."
              />
            </div>
            <Button icon="plus" onClick={() => openPostEditor()}>
              Nowy post
            </Button>
          </div>
          <div className="data-table [border:1px_solid_var(--line)] rounded-[10px] overflow-hidden">
            {displayedPosts.map((post) => {
              return (
                <div
                  className="grid grid-cols-[1fr_110px_85px] items-center gap-[20px] p-[17px] [border-bottom:1px_solid_var(--line)] [&:last-child]:[border-bottom:0] [&_>_div:first-child]:flex [&_>_div:first-child]:flex-col text-[color:var(--ink-soft)] text-[9px] mt-[4px] max-[600px]:grid-cols-[1fr_75px] max-[600px]:hidden"
                  key={post.id}
                >
                  <div>
                    <strong>{post.titlePl}</strong>
                    <span>
                      {formatDate(
                        dateFromIso(post.createdAt.slice(0, 10)),
                        language,
                      )}{" "}
                      · {post.comments.length} komentarzy
                    </span>
                  </div>
                  <span
                    className={`status rounded-full bg-[var(--green-pale)] px-2 py-1 text-xs font-bold text-[var(--green)] [&.pending]:bg-[var(--yellow)] [&.pending]:text-[#715711] ${post.status === "draft" ? "draft" : ""}  `}
                  >
                    {post.status === "draft" ? "Szkic" : "Opublikowany"}
                  </span>
                  <div className="table-actions flex justify-end gap-1">
                    <Button
                      variant="icon"
                      aria-label="Edit post"
                      onClick={() => openPostEditor(post)}
                    >
                      <Icon name="edit" size={17} />
                    </Button>
                    <Button
                      variant="icon"
                      aria-label="Delete post"
                      onClick={() => {
                        if (
                          window.confirm(
                            language === "pl"
                              ? "Usunac post i komentarze?"
                              : "Delete this post and its comments?",
                          )
                        )
                          setPosts((all) =>
                            all.filter((entry) => entry.id !== post.id),
                          );
                      }}
                    >
                      <Icon name="trash" size={17} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
      {tab === "users" && (
        <section className="admin-card rounded-xl border border-[var(--line)] bg-white p-6">
          <div className="table-toolbar mb-5 flex items-center justify-between gap-3 max-[600px]:flex-col max-[600px]:items-stretch">
            <div className="search-box flex min-w-[280px] items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 [&_input]:min-w-0 [&_input]:w-full [&_input]:bg-transparent [&_input]:text-sm max-[600px]:min-w-0">
              <Icon name="search" />
              <input
                aria-label="Search members"
                name="member-search"
                autoComplete="off"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, dormitory or room"
              />
            </div>
            <span className="muted text-[var(--ink-soft)] leading-relaxed">
              New accounts use the registration form.
            </span>
          </div>
          <div className="filter-pills mb-5 flex flex-wrap gap-2 [&_.active]:bg-[var(--green-pale)] [&_.active]:text-[var(--green)]">
            <Button
              variant="ghost"
              className={userFilter === "pending" ? "active" : ""}
              onClick={() => setUserFilter("pending")}
            >
              Do weryfikacji <span>{pendingUsers.length}</span>
            </Button>
            <Button
              variant="ghost"
              className={userFilter === "active" ? "active" : ""}
              onClick={() => setUserFilter("active")}
            >
              Aktywni
            </Button>
            <Button
              variant="ghost"
              className={userFilter === "all" ? "active" : ""}
              onClick={() => setUserFilter("all")}
            >
              Wszyscy
            </Button>
          </div>
          <div className="user-table [border:1px_solid_var(--line)] rounded-[10px] overflow-hidden">
            {displayedUsers.map((user) => {
              const initials =
                `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();
              return (
                <div
                  className="user-row grid grid-cols-[34px_minmax(0,1fr)_minmax(100px,180px)_80px_110px_40px] items-center gap-3 border-b border-[var(--line)] py-4 [&_a]:truncate [&_a]:text-xs [&_a]:text-[var(--green)] max-[1150px]:grid-cols-[34px_minmax(0,1fr)_110px] max-[1150px]:[&_a]:col-start-2 max-[1150px]:[&_.status]:col-start-2 max-[1150px]:[&_.button-secondary]:col-start-3 max-[1150px]:[&_.button-secondary]:row-span-2"
                  key={user.id}
                >
                  <div className="mini-avatar blue grid size-[31px] shrink-0 place-items-center rounded-full text-xs font-bold text-[var(--green-dark)] [&.blue]:bg-[var(--blue)] [&.yellow]:bg-[var(--yellow)] [&.green]:bg-[var(--green-pale)] [&.peach]:bg-[var(--peach)]">
                    {initials}
                  </div>
                  <div className="user-main flex min-w-0 flex-col [&_strong]:truncate [&_strong]:text-sm [&_span]:text-xs [&_span]:text-[var(--ink-soft)]">
                    <strong>
                      {user.firstName} {user.lastName}
                    </strong>
                    <span>
                      {user.dormitory} · pokój {user.room}
                    </span>
                  </div>
                  <a
                    href={safeProfileUrl(user.facebookUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {user.facebookUrl
                      ? user.facebookUrl.replace("https://", "")
                      : "Brak profilu"}
                  </a>
                  <span
                    className={`status rounded-full bg-[var(--green-pale)] px-2 py-1 text-xs font-bold text-[var(--green)] [&.pending]:bg-[var(--yellow)] [&.pending]:text-[#715711] ${user.verified ? "" : "pending"}  `}
                  >
                    {user.verified ? "Aktywny" : "Oczekuje"}
                  </span>
                  {!user.verified ? (
                    <Button
                      variant="secondary"
                      icon="check"
                      onClick={() => onVerify({ ...user, verified: true })}
                    >
                      Zweryfikuj
                    </Button>
                  ) : (
                    <span />
                  )}
                  <span />
                </div>
              );
            })}
            {displayedUsers.length === 0 && (
              <div className="empty-admin-state flex flex-col items-center gap-3 p-8 text-sm text-[var(--ink-soft)]">
                <Icon name="user-check" />
                <strong>Brak użytkowników w tej kategorii</strong>
              </div>
            )}
          </div>
        </section>
      )}
      {tab === "activity" && (
        <section className="admin-card rounded-xl border border-[var(--line)] bg-white p-6">
          <div className="section-heading mb-[18px] flex items-end justify-between gap-5 [&_.eyebrow]:mb-1">
            <div>
              <div className="eyebrow mb-3 text-xs font-bold tracking-wide text-[var(--green)] [&.light]:text-[var(--lime)]">
                HISTORIA
              </div>
              <div className="section-title font-display text-[21px] font-extrabold tracking-tight">
                Dziennik aktywności
              </div>
            </div>
            <Button variant="secondary" icon="calendar">
              Ostatnie 30 dni
            </Button>
          </div>
          <div className="activity-list detailed p-[17px_0]">
            {dataActivities.map((a, i) => (
              <div
                className="activity-row flex items-center gap-3 border-b border-[var(--line)] py-3 last:border-b-0 [&_>_div:nth-child(2)]:min-w-0 [&_>_div:nth-child(2)]:flex-1 [&_p]:text-sm [&_span]:text-xs [&_span]:text-[var(--ink-soft)] [&_time]:text-xs [&_time]:text-[var(--ink-soft)]"
                key={i}
              >
                <div
                  className={`mini-avatar grid size-[31px] shrink-0 place-items-center rounded-full text-xs font-bold text-[var(--green-dark)] [&.blue]:bg-[var(--blue)] [&.yellow]:bg-[var(--yellow)] [&.green]:bg-[var(--green-pale)] [&.peach]:bg-[var(--peach)] ${a.color}  `}
                >
                  {a.initials}
                </div>
                <div>
                  <p>
                    <strong>{a.name}</strong> {a.text}
                  </p>
                  <span>{a.detail}</span>
                </div>
                <time>{i > 3 ? "Wczoraj" : a.time}</time>
              </div>
            ))}
          </div>
        </section>
      )}
      {tab === "settings" && (
        <div className="settings-grid grid grid-cols-2 gap-[18px] max-[820px]:grid-cols-1">
          <section className="admin-card rounded-xl border border-[var(--line)] bg-white p-6">
            <div className="section-title font-display text-[21px] font-extrabold tracking-tight">
              Rejestracja
            </div>
            <p className="muted text-[var(--ink-soft)] leading-relaxed">
              Kontroluj możliwość tworzenia nowych kont.
            </p>
            <label className="toggle-row mt-5 flex items-center justify-between gap-4 [&_div]:flex [&_div]:flex-col [&_strong]:text-sm [&_span]:text-xs [&_span]:text-[var(--ink-soft)] [&_input]:size-5 [&_input]:accent-[var(--green)] [&_i]:hidden">
              <div>
                <strong>Rejestracja użytkowników</strong>
                <span>Nowi użytkownicy mogą utworzyć konto</span>
              </div>
              <input
                type="checkbox"
                checked={settings.registrationEnabled}
                onChange={(e) =>
                  setSettings((current) => ({
                    ...current,
                    registrationEnabled: e.target.checked,
                  }))
                }
              />
              <i />
            </label>
          </section>
          <section className="admin-card rounded-xl border border-[var(--line)] bg-white p-6">
            <div className="section-title font-display text-[21px] font-extrabold tracking-tight">
              Nazwa siłowni
            </div>
            <p className="muted text-[var(--ink-soft)] leading-relaxed">
              Nazwa widoczna użytkownikom w całej aplikacji.
            </p>
            <div className="settings-field mt-5">
              <Field
                label="Nazwa"
                value={settings.gymName}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    gymName: event.target.value,
                  }))
                }
                name="gymName"
                autoComplete="organization"
              />
            </div>
          </section>
          <section className="admin-card rounded-xl border border-[var(--line)] bg-white p-6">
            <div className="section-title font-display text-[21px] font-extrabold tracking-tight">
              Widok terminarza
            </div>
            <p className="muted text-[var(--ink-soft)] leading-relaxed">
              Domyślny widok wyświetlany użytkownikom.
            </p>
            <div className="setting-options mt-5 flex flex-col gap-3 [&_.selected]:border-[var(--green)] [&_.selected]:bg-[var(--green-pale)]">
              <Button
                variant="secondary"
                className={
                  settings.defaultCalendarView === "week" ? "selected" : ""
                }
                onClick={() =>
                  setSettings((current) => ({
                    ...current,
                    defaultCalendarView: "week",
                  }))
                }
              >
                Widok tygodnia{" "}
                {settings.defaultCalendarView === "week" && (
                  <Icon name="check" />
                )}
              </Button>
              <Button
                variant="secondary"
                className={
                  settings.defaultCalendarView === "month" ? "selected" : ""
                }
                onClick={() =>
                  setSettings((current) => ({
                    ...current,
                    defaultCalendarView: "month",
                  }))
                }
              >
                Widok miesiąca{" "}
                {settings.defaultCalendarView === "month" && (
                  <Icon name="check" />
                )}
              </Button>
            </div>
          </section>
        </div>
      )}
      {postModal && (
        <div
          className="modal-backdrop fixed inset-0 z-40 grid place-items-center p-5"
          onMouseDown={() => setPostModal(false)}
        >
          <Dialog
            className="modal m-auto max-h-[90dvh] w-[min(100%-32px,520px)] overflow-y-auto overscroll-contain rounded-2xl border-0 bg-white p-7 text-[var(--ink)] shadow-2xl max-[600px]:px-[18px] max-[600px]:py-[22px]"
            label="Post editor"
            close={() => setPostModal(false)}
          >
            <div className="modal-head mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="eyebrow mb-3 text-xs font-bold tracking-wide text-[var(--green)] [&.light]:text-[var(--lime)]">
                  AKTUALNOŚCI
                </div>
                <div className="modal-title font-display text-[23px] font-extrabold">
                  {editingPostId ? "Edytuj post" : "Utwórz nowy post"}
                </div>
              </div>
              <Button variant="icon" onClick={() => setPostModal(false)}>
                <Icon name="close" />
              </Button>
            </div>
            <Field
              label="Tytuł posta"
              placeholder="Wpisz tytuł..."
              maxLength={200}
              value={postTitle}
              onChange={(event) => setPostTitle(event.target.value)}
              name="postTitle"
              autoComplete="off"
            />
            <label className="field mb-[18px] flex flex-col gap-2 text-sm font-bold [&_textarea]:min-h-[130px] [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[10px] [&_textarea]:border [&_textarea]:border-[var(--line-dark)] [&_textarea]:bg-white [&_textarea]:px-[15px] [&_textarea]:py-[13px] [&_textarea]:font-medium">
              <span>Treść</span>
              <textarea
                placeholder="Napisz wiadomość dla społeczności..."
                maxLength={10000}
                value={postContent}
                onChange={(event) => setPostContent(event.target.value)}
              />
            </label>
            <div className="upload-area my-5 flex flex-col items-center gap-2 rounded-xl border border-dashed border-[var(--line-dark)] bg-[var(--paper)] p-6 text-center [&_span]:text-xs [&_span]:text-[var(--ink-soft)]">
              <Icon name="image" />
              <strong>Dodaj zdjęcie lub plik</strong>
              <span>PNG, JPG lub PDF do 10 MB</span>
              <span className="muted text-[var(--ink-soft)] leading-relaxed">
                Attachments require an API connection.
              </span>
            </div>
            <div className="modal-actions flex justify-end gap-2 border-t border-[var(--line)] pt-5 max-[600px]:flex-col-reverse max-[600px]:[&_.button]:w-full">
              <Button
                variant="secondary"
                disabled={!postTitle.trim() || !postContent.trim()}
                onClick={() => storePost("draft")}
              >
                Zapisz jako szkic
              </Button>
              <Button
                disabled={!postTitle.trim() || !postContent.trim()}
                onClick={() => storePost("published")}
              >
                Opublikuj post
              </Button>
            </div>
          </Dialog>
        </div>
      )}
    </div>
  );
}
