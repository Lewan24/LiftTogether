import { type GymSettings, type Post, type User } from "../services/storage";
import {
  APP_TODAY,
  addDays,
  dateFromIso,
  formatDate,
  isCurrentWeekDate,
  minutes,
  startOfWeek,
  toIsoDate,
} from "../lib/date";
import type { Booking, Language } from "../types";
import { Button, Icon, PageHeader } from "../components/ui";
import { copy } from "../lib/copy";
import { dailyOccupancy } from "../lib/booking";
export default function HomePage({
  language,
  bookings,
  openBooking,
  openSchedule,
  openNews,
  openPost,
  user,
  posts,
  settings,
}: {
  language: Language;
  bookings: Booking[];
  openBooking: (date: string, bookingId?: number) => void;
  openSchedule: () => void;
  openNews: () => void;
  openPost: (postId: number) => void;
  user: User;
  posts: Post[];
  settings: GymSettings;
}) {
  const t = copy[language];
  const todayIso = toIsoDate(APP_TODAY);
  const mine = [...bookings]
    .filter(
      (booking) =>
        booking.mine &&
        !booking.cancelled &&
        isCurrentWeekDate(booking.date) &&
        booking.date >= todayIso,
    )
    .sort((a, b) =>
      `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`),
    )[0];
  const mineDate = mine ? dateFromIso(mine.date) : null;
  const weekDays = Array.from({ length: 7 }, (_, index) =>
    addDays(startOfWeek(APP_TODAY), index),
  );
  const publishedPosts = posts
    .filter((post) => post.status === "published")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const featured = publishedPosts[0];
  const secondary = publishedPosts[1];
  const duration = mine ? minutes(mine.end) - minutes(mine.start) : 0;
  const overlapCount = dailyOccupancy(bookings, mine?.date ?? todayIso);
  return (
    <div className="page mx-auto max-w-[1540px] px-[4%] pt-11 pb-[70px] max-[820px]:px-[22px] max-[820px]:pt-[30px]">
      <PageHeader
        eyebrow={formatDate(APP_TODAY, language, {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }).toUpperCase()}
        title={`${t.hello}, ${user.firstName}`}
        subtitle={
          language === "pl"
            ? `Oto co dzieje się dziś w ${settings.gymName}.`
            : `Here's what's happening today at ${settings.gymName}.`
        }
        action={
          <Button icon="plus" onClick={() => openBooking(todayIso)}>
            {t.book}
          </Button>
        }
      />
      <section className="hero-booking mb-8 grid min-h-[218px] grid-cols-[1.35fr_.65fr] overflow-hidden rounded-2xl bg-[var(--green-dark)] text-white shadow-[var(--shadow)] max-[820px]:grid-cols-1">
        <div className="hero-booking-copy relative z-10 px-[34px] py-7 max-[600px]:px-[22px] max-[600px]:py-6">
          <div className="section-kicker flex items-center gap-2 text-xs font-bold text-[var(--lime)] [&_>_span:first-child]:h-0.5 [&_>_span:first-child]:w-6 [&_>_span:first-child]:bg-[var(--lime)]">
            <span />
            <span>{t.upcoming}</span>
          </div>
          <div className="workout-date mt-3 mb-1 flex items-center gap-4 [&_>_strong]:font-display [&_>_strong]:text-[56px] [&_>_strong]:leading-none [&_div]:flex [&_div]:flex-col [&_div]:border-l [&_div]:border-white/20 [&_div]:pl-4 [&_span]:text-xs [&_span]:font-bold [&_span]:text-[var(--lime)] [&_b]:mt-1 [&_b]:text-base max-[600px]:[&_>_strong]:text-[50px]">
            <strong>{mineDate ? mineDate.getDate() : "—"}</strong>
            <div>
              <span>
                {mineDate
                  ? formatDate(mineDate, language, {
                      month: "long",
                    }).toUpperCase()
                  : language === "pl"
                    ? "BRAK"
                    : "NONE"}
              </span>
              <b>
                {mineDate
                  ? formatDate(mineDate, language, {
                      weekday: "long",
                    }).toUpperCase()
                  : language === "pl"
                    ? "ZAPLANUJ TRENING"
                    : "PLAN A WORKOUT"}
              </b>
            </div>
          </div>
          <div className="workout-time flex items-center gap-2 text-sm text-white/75 [&_.icon]:text-[var(--lime)] [&_strong]:text-white">
            <Icon name="clock" />{" "}
            <strong>
              {mine
                ? `${mine.start} — ${mine.end}`
                : language === "pl"
                  ? "Brak zapisów"
                  : "No bookings"}
            </strong>
            <span>·</span>
            <span>
              {mine
                ? language === "pl"
                  ? `${duration / 60} godz.`
                  : `${duration / 60} hr`
                : ""}
            </span>
          </div>
          <div className="hero-actions mt-5 flex gap-3 [&_.button-secondary]:border-0 [&_.button-secondary]:bg-[var(--lime)] [&_.button-secondary]:text-[var(--green-dark)] [&_.button-ghost]:text-white max-[600px]:flex-col">
            <Button
              variant="secondary"
              icon="edit"
              onClick={() => mine && openBooking(mine.date, mine.id)}
              disabled={!mine}
            >
              {language === "pl" ? "Edytuj zapis" : "Edit booking"}
            </Button>
            <Button variant="ghost" onClick={openSchedule}>
              {t.seeSchedule}
              <Icon name="arrow" size={16} />
            </Button>
          </div>
        </div>
        <div className="hero-art relative grid place-items-center bg-[radial-gradient(circle,rgba(200,230,91,.12),transparent_65%)] max-[820px]:hidden">
          <div className="art-circle grid size-[155px] place-items-center rounded-full border border-white/20">
            <div className="dumbbell flex -rotate-[23deg] items-center text-[var(--lime)] [&_span]:h-3 [&_span]:w-[74px] [&_span]:bg-current [&_b]:h-11 [&_b]:w-3 [&_b]:rounded [&_b]:bg-current [&_i]:h-[62px] [&_i]:w-4 [&_i]:rounded [&_i]:bg-current">
              <i />
              <b />
              <span />
              <b />
              <i />
            </div>
          </div>
          <div className="availability absolute right-6 bottom-6 flex items-center gap-2 rounded-[10px] bg-white/10 px-3 py-3 [&_>_span]:size-2 [&_>_span]:rounded-full [&_>_span]:bg-[var(--lime)] [&_div]:flex [&_div]:flex-col [&_strong]:text-xs [&_small]:text-xs [&_small]:text-white/70">
            <span />
            <div>
              <strong>
                {language === "pl"
                  ? `${Math.max(0, settings.maxDaily - overlapCount)} wolnych miejsc`
                  : `${Math.max(0, settings.maxDaily - overlapCount)} spots available`}
              </strong>
              <small>{language === "pl" ? "w tym dniu" : "on this day"}</small>
            </div>
          </div>
        </div>
      </section>
      <div className="content-grid grid grid-cols-[minmax(0,1.6fr)_minmax(280px,.65fr)] items-start gap-7 max-[1150px]:grid-cols-1">
        <section>
          <div className="section-heading mb-[18px] flex items-end justify-between gap-5 [&_.eyebrow]:mb-1">
            <div>
              <div className="eyebrow mb-3 text-xs font-bold tracking-wide text-[var(--green)] [&.light]:text-[var(--lime)]">
                {language === "pl" ? "BĄDŹ NA BIEŻĄCO" : "STAY UPDATED"}
              </div>
              <div className="section-title font-display text-[21px] font-extrabold tracking-tight">
                {t.news}
              </div>
            </div>
            <Button
              variant="ghost"
              className="text-[color:var(--green)] p-[0] min-h-[auto]"
              onClick={openNews}
            >
              {language === "pl" ? "Zobacz wszystkie" : "View all"}
              <Icon name="arrow" size={16} />
            </Button>
          </div>
          <article className="post-card featured-post flex overflow-hidden rounded-xl border border-[var(--line)] bg-white mb-4 min-h-[235px] shadow-sm max-[600px]:flex-col">
            <div className="post-visual relative flex w-[36%] min-w-[220px] items-center overflow-hidden bg-[#dae6d7] p-6 max-[600px]:h-[150px] max-[600px]:w-full">
              <div className="poster-text relative z-10 font-display text-[27px] leading-tight font-extrabold text-[var(--green-dark)] [&_em]:text-[var(--green)]">
                SUMMER
                <br />
                <em>FORM</em>
              </div>
              <div className="poster-shape absolute right-[-50px] bottom-[-55px] size-[190px] -rotate-[20deg] rounded-full bg-[var(--lime)]" />
            </div>
            <div className="post-content min-w-0 flex-1 px-7 py-6 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-[var(--ink-soft)]">
              <div className="post-meta flex flex-wrap items-center gap-2 text-xs text-[var(--ink-soft)]">
                {featured?.important && (
                  <span className="tag rounded bg-[var(--lime)] px-2 py-1 text-xs font-bold text-[var(--green-dark)]">
                    WAŻNE
                  </span>
                )}
                <span>
                  {featured
                    ? formatDate(
                        dateFromIso(featured.createdAt.slice(0, 10)),
                        language,
                        {
                          day: "numeric",
                          month: "long",
                        },
                      )
                    : ""}{" "}
                  · {featured?.author}
                </span>
              </div>
              <div className="post-title mt-3 mb-2 font-display text-lg leading-snug font-extrabold break-words">
                {featured
                  ? language === "pl"
                    ? featured.titlePl
                    : featured.titleEn
                  : ""}
              </div>
              <p>
                {featured
                  ? language === "pl"
                    ? featured.contentPl
                    : featured.contentEn
                  : ""}
              </p>
              <div className="post-footer mt-5 flex items-center justify-between gap-3 [&_>_span]:text-xs [&_>_span]:text-[var(--ink-soft)]">
                <Button
                  variant="ghost"
                  className="text-[color:var(--green)] p-[0] min-h-[auto]"
                  onClick={() => featured && openPost(featured.id)}
                >
                  {language === "pl" ? "Czytaj więcej" : "Read more"}
                  <Icon name="arrow" size={15} />
                </Button>
                <span>
                  <Icon name="message" size={15} />{" "}
                  {featured?.commentCount ?? 0} {t.comments}
                </span>
              </div>
            </div>
          </article>
          <article className="post-card compact-post flex overflow-hidden rounded-xl border border-[var(--line)] bg-white min-h-[112px] items-center px-5 [&_.post-content]:px-5 [&_.post-content]:py-4 [&_.post-title]:my-1 [&_.post-title]:text-sm max-[600px]:px-3 max-[600px]:[&_.comment-count]:hidden">
            <div className="post-date flex h-16 w-[58px] shrink-0 flex-col items-center justify-center rounded-lg bg-[var(--green-pale)] text-[var(--green)] [&_strong]:font-display [&_strong]:text-[22px] [&_span]:mt-1 [&_span]:text-xs [&_span]:font-bold">
              <strong>
                {secondary
                  ? dateFromIso(secondary.createdAt.slice(0, 10)).getDate()
                  : "—"}
              </strong>
              <span>
                {secondary
                  ? formatDate(
                      dateFromIso(secondary.createdAt.slice(0, 10)),
                      language,
                      { month: "short" },
                    ).toUpperCase()
                  : ""}
              </span>
            </div>
            <div className="post-content min-w-0 flex-1 px-7 py-6 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-[var(--ink-soft)]">
              <div className="post-meta flex flex-wrap items-center gap-2 text-xs text-[var(--ink-soft)]">
                <span>{secondary?.author}</span>
              </div>
              <div className="post-title mt-3 mb-2 font-display text-lg leading-snug font-extrabold break-words">
                {secondary
                  ? language === "pl"
                    ? secondary.titlePl
                    : secondary.titleEn
                  : ""}
              </div>
              <p>
                {secondary
                  ? language === "pl"
                    ? secondary.contentPl
                    : secondary.contentEn
                  : ""}
              </p>
            </div>
            <span className="comment-count flex items-center gap-1 text-xs text-[var(--ink-soft)]">
              <Icon name="message" size={15} /> {secondary?.commentCount ?? 0}
            </span>
          </article>
        </section>
        <aside className="week-overview rounded-xl border border-[var(--line)] bg-white p-6">
          <div className="section-heading mb-[18px] flex items-end justify-between gap-5 [&_.eyebrow]:mb-1">
            <div>
              <div className="eyebrow mb-3 text-xs font-bold tracking-wide text-[var(--green)] [&.light]:text-[var(--lime)]">
                TEN TYDZIEŃ
              </div>
              <div className="section-title font-display text-[21px] font-extrabold tracking-tight">
                {language === "pl" ? "Obłożenie" : "Occupancy"}
              </div>
            </div>
            <span className="live-dot rounded-full bg-[var(--green-pale)] px-2 py-1 text-xs font-bold text-[var(--green)]">
              NA ŻYWO
            </span>
          </div>
          <div className="occupancy-list flex flex-col">
            {weekDays.map((day) => {
              const date = toIsoDate(day);
              const peak = dailyOccupancy(bookings, date);
              return (
                <div
                  className={`occupancy-row grid grid-cols-[48px_1fr_35px] items-center gap-3 border-b border-[var(--line)] py-3 [&_>_div:first-child]:flex [&_>_div:first-child]:flex-col [&_strong]:text-xs [&_span]:text-xs [&_span]:text-[var(--ink-soft)] [&_b]:text-right [&_b]:text-xs [&_b]:tabular-nums [&.today_strong]:text-[var(--green)] ${date === todayIso ? "today" : ""}  `}
                  key={date}
                >
                  <div>
                    <strong>
                      {formatDate(day, language, { weekday: "short" })}
                    </strong>
                    <span>
                      {formatDate(day, language, {
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="bar h-[5px] overflow-hidden rounded bg-[#edf0ed] [&_i]:block [&_i]:h-full [&_i]:rounded [&_i]:bg-[var(--green)]">
                    <i
                      style={{
                        width: `${Math.min(100, (peak / settings.maxDaily) * 100)}%`,
                      }}
                    />
                  </div>
                  <b>
                    {peak}/{settings.maxDaily}
                  </b>
                </div>
              );
            })}
          </div>
          <div className="capacity-note mt-[18px] flex gap-2 rounded-lg bg-[var(--paper)] p-3 text-xs leading-relaxed text-[var(--ink-soft)]">
            <Icon name="users" size={18} />
            <span>
              {language === "pl"
                ? `Maksymalnie ${settings.maxDaily} osób jednocześnie na sali`
                : `Maximum ${settings.maxDaily} people across the whole day`}
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
