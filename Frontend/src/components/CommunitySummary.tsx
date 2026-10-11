import { useEffect, useState } from "react";
import {
  api,
  apiMessage,
  dashboardSchema,
  type DashboardSummary,
} from "../services/api";
import type { Language } from "../types";
import { dateFromIso, formatDate } from "../lib/date";
import { Button, Icon } from "./ui";

export default function CommunitySummary({
  language,
  openForum,
  openNews,
  openPost,
}: {
  language: Language;
  openForum: () => void;
  openNews: () => void;
  openPost: (id: number) => void;
}) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const text = (pl: string, en: string) => (language === "pl" ? pl : en);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        setSummary(
          await api("dashboard", dashboardSchema, {
            signal: controller.signal,
          }),
        );
        setError("");
      } catch (failure) {
        if (!controller.signal.aborted) setError(apiMessage(failure, language));
      }
    }
    void load();
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 60000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [language, refresh]);
  return (
    <div className="border-l border-white/20 bg-white/5 px-7 py-7 max-[820px]:border-t max-[820px]:border-l-0 max-[600px]:px-[22px]">
      <h2 className="font-display text-2xl font-extrabold">
        {text("Ten tydzień w społeczności", "This week in the community")}
      </h2>
      {summary && (
        <p className="mt-1 text-xs text-white/70">
          {formatDate(dateFromIso(summary.from), language, {
            day: "numeric",
            month: "short",
          })}{" "}
          –{" "}
          {formatDate(dateFromIso(summary.to), language, {
            day: "numeric",
            month: "short",
          })}
        </p>
      )}
      {error ? (
        <div className="mt-4">
          <p role="alert" className="text-sm text-white/80">
            {error}
          </p>
          <Button
            variant="ghost"
            className="mt-2 text-white"
            onClick={() => setRefresh((value) => value + 1)}
          >
            {text("Spróbuj ponownie", "Try again")}
          </Button>
        </div>
      ) : !summary ? (
        <p role="status" className="mt-5 text-sm text-white/70">
          {text("Ładowanie aktualności…", "Loading updates…")}
        </p>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 divide-x divide-white/20">
            <button
              type="button"
              onClick={openForum}
              className="group pr-4 text-left focus-visible:rounded focus-visible:outline-[var(--lime)]"
            >
              <span className="mb-2 flex items-center gap-2 text-sm text-white/80">
                <Icon name="message" size={17} />
                {text("Nowe tematy", "New topics")}
              </span>
              <strong className="font-display text-4xl font-extrabold tabular-nums text-[var(--lime)]">
                {summary.forumTopics}
              </strong>
              <span className="mt-2 block text-xs text-white/70">
                {summary.forumReplies}{" "}
                {text("odpowiedzi na forum", "forum replies")}
              </span>
              <span className="mt-2 block text-sm underline-offset-4 group-hover:underline">
                {text("Przejdź na forum", "Visit the forum")}
              </span>
            </button>
            <button
              type="button"
              onClick={openNews}
              className="group pl-4 text-left focus-visible:rounded focus-visible:outline-[var(--lime)]"
            >
              <span className="mb-2 flex items-center gap-2 text-sm text-white/80">
                <Icon name="bell" size={17} />
                {text("Nowe aktualności", "New news posts")}
              </span>
              <strong className="font-display text-4xl font-extrabold tabular-nums text-[var(--lime)]">
                {summary.newsPosts}
              </strong>
              <span className="mt-2 block text-xs text-white/70">
                {text("Opublikowane w tym tygodniu", "Published this week")}
              </span>
              <span className="mt-2 block text-sm underline-offset-4 group-hover:underline">
                {text("Przeczytaj aktualności", "Read the news")}
              </span>
            </button>
          </div>
          {(summary.latestNews.length > 0 ||
            summary.latestTopics.length > 0) && (
            <ul className="mt-5 space-y-3 border-t border-white/20 pt-4 text-sm">
              {summary.latestNews.slice(0, 1).map((post) => (
                <li key={`news-${post.id}`}>
                  <span className="mb-1 block text-xs text-white/60">
                    {text("Z aktualności", "From the news")}
                  </span>
                  <button
                    type="button"
                    onClick={() => openPost(post.id)}
                    className="text-left font-bold underline-offset-4 hover:underline focus-visible:outline-[var(--lime)]"
                  >
                    {language === "pl" ? post.titlePl : post.titleEn}
                  </button>
                </li>
              ))}
              {summary.latestTopics.slice(0, 1).map((topic) => (
                <li key={topic.id}>
                  <span className="mb-1 block text-xs text-white/60">
                    {text("Na forum", "On the forum")}
                  </span>
                  <button
                    type="button"
                    onClick={openForum}
                    className="text-left font-bold underline-offset-4 hover:underline focus-visible:outline-[var(--lime)]"
                  >
                    {topic.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {summary.newsPosts === 0 && summary.forumTopics === 0 && (
            <p className="mt-5 border-t border-white/20 pt-4 text-sm text-white/70">
              {text(
                "Spokojny początek tygodnia. Zajrzyj na forum i rozpocznij rozmowę.",
                "A quiet start to the week. Visit the forum and start a conversation.",
              )}
            </p>
          )}
        </>
      )}
    </div>
  );
}
