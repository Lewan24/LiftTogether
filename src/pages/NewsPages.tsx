import { FormEvent, useState } from "react";
import { Button, Icon, PageHeader } from "../components/ui";
import { dateFromIso, formatDate } from "../lib/date";
import type { Post, PostComment, User } from "../services/storage";
import type { Language } from "../types";
export function NewsPage({
  language,
  posts,
  openPost,
}: {
  language: Language;
  posts: Post[];
  openPost: (postId: number) => void;
}) {
  const published = posts
    .filter((post) => post.status === "published")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <div className="page mx-auto max-w-[1540px] px-[4%] pt-11 pb-[70px] max-[820px]:px-[22px] max-[820px]:pt-[30px]">
      <PageHeader
        eyebrow={language === "pl" ? "SPOŁECZNOŚĆ DS 3" : "DS 3 COMMUNITY"}
        title={language === "pl" ? "Wszystkie aktualności" : "All news"}
        subtitle={
          language === "pl"
            ? "Komunikaty administracji i najnowsze informacje z siłowni."
            : "Administration announcements and the latest gym updates."
        }
      />
      <div className="news-list flex flex-col gap-4">
        {published.length === 0 && (
          <p
            role="status"
            className="rounded-xl border border-dashed border-[var(--line)] bg-white p-6 text-[var(--ink-soft)]"
          >
            {language === "pl"
              ? "Brak opublikowanych aktualnosci."
              : "No published news yet. Check back later."}
          </p>
        )}
        {published.map((post, index) => {
          const created = dateFromIso(post.createdAt.slice(0, 10));
          return (
            <article
              className={`news-article grid grid-cols-[70px_minmax(0,1fr)] gap-5 rounded-xl border border-[var(--line)] bg-white p-6 [&.featured]:border-[#8fbd98] max-[600px]:grid-cols-1 max-[600px]:p-5 ${index === 0 ? "featured" : ""}  `}
              key={post.id}
            >
              <div className="news-date flex flex-col text-[var(--green)] [&_strong]:font-display [&_strong]:text-[32px] [&_span]:text-xs [&_span]:font-bold">
                <strong>{created.getDate()}</strong>
                <span>
                  {formatDate(created, language, {
                    month: "short",
                  }).toUpperCase()}
                </span>
              </div>
              <div className="news-body min-w-0 [&_p]:leading-relaxed [&_p]:text-[var(--ink-soft)]">
                <div className="post-meta flex flex-wrap items-center gap-2 text-xs text-[var(--ink-soft)]">
                  {post.important && (
                    <span className="tag rounded bg-[var(--lime)] px-2 py-1 text-xs font-bold text-[var(--green-dark)]">
                      WAŻNE
                    </span>
                  )}
                  <span>
                    {post.author} ·{" "}
                    {formatDate(created, language, {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div className="post-title mt-3 mb-2 font-display text-lg leading-snug font-extrabold break-words">
                  {language === "pl" ? post.titlePl : post.titleEn}
                </div>
                <p>{language === "pl" ? post.contentPl : post.contentEn}</p>
                <Button
                  variant="ghost"
                  className="comment-button mt-[15px] text-[color:var(--green)] pl-[0] text-[10px]"
                  onClick={() => openPost(post.id)}
                >
                  <Icon name="message" size={16} />
                  {post.comments.length}{" "}
                  {language === "pl"
                    ? "komentarzy · Otwórz post"
                    : "comments · Open post"}
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
export function PostDetailPage({
  language,
  post,
  user,
  back,
  addComment,
}: {
  language: Language;
  post: Post;
  user: User;
  back: () => void;
  addComment: (comment: PostComment) => void;
}) {
  const [content, setContent] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = content.trim();
    if (!value || value.length > 2000) return;
    addComment({
      id: Date.now(),
      userId: user.id,
      author: `${user.firstName} ${user.lastName}`,
      initials:
        `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase(),
      content: value,
      createdAt: new Date().toISOString(),
    });
    setContent("");
  };
  const created = dateFromIso(post.createdAt.slice(0, 10));
  return (
    <div className="page post-detail-page mx-auto px-[4%] pt-11 pb-[70px] max-[820px]:px-[22px] max-[820px]:pt-[30px] max-w-[1100px]">
      <Button variant="ghost" className="back-button mb-5" onClick={back}>
        <Icon name="chevron-left" size={18} />
        {language === "pl" ? "Wróć do aktualności" : "Back to news"}
      </Button>
      <article className="post-detail-card rounded-xl border border-[var(--line)] bg-white p-8 [&_p]:whitespace-pre-wrap [&_p]:break-words [&_p]:leading-relaxed [&_p]:text-[var(--ink-soft)] max-[600px]:p-5">
        <div className="post-meta flex flex-wrap items-center gap-2 text-xs text-[var(--ink-soft)]">
          {post.important && (
            <span className="tag rounded bg-[var(--lime)] px-2 py-1 text-xs font-bold text-[var(--green-dark)]">
              WAŻNE
            </span>
          )}
          <span>
            {post.author} ·{" "}
            {formatDate(created, language, {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>
        <div className="post-detail-title my-5 font-display text-[32px] leading-tight font-extrabold break-words max-[600px]:text-[25px]">
          {language === "pl" ? post.titlePl : post.titleEn}
        </div>
        <p>{language === "pl" ? post.contentPl : post.contentEn}</p>
      </article>
      <section className="comments-section mt-8">
        <div className="section-heading mb-[18px] flex items-end justify-between gap-5 [&_.eyebrow]:mb-1">
          <div>
            <div className="eyebrow mb-3 text-xs font-bold tracking-wide text-[var(--green)] [&.light]:text-[var(--lime)]">
              {language === "pl" ? "DYSKUSJA" : "DISCUSSION"}
            </div>
            <div className="section-title font-display text-[21px] font-extrabold tracking-tight">
              {language === "pl" ? "Komentarze" : "Comments"}{" "}
              <span className="count-badge inline-grid h-5 min-w-5 place-items-center rounded-full bg-[var(--green-pale)] px-1.5 text-xs font-bold text-[var(--green)]">
                {post.comments.length}
              </span>
            </div>
          </div>
        </div>
        <form
          className="comment-form mb-5 grid grid-cols-[31px_minmax(0,1fr)_auto] items-start gap-3 [&_textarea]:min-h-[90px] [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-[var(--line-dark)] [&_textarea]:bg-white [&_textarea]:p-3 max-[600px]:grid-cols-1 max-[600px]:[&_.mini-avatar]:hidden"
          onSubmit={submit}
        >
          <div className="mini-avatar green grid size-[31px] shrink-0 place-items-center rounded-full text-xs font-bold text-[var(--green-dark)] [&.blue]:bg-[var(--blue)] [&.yellow]:bg-[var(--yellow)] [&.green]:bg-[var(--green-pale)] [&.peach]:bg-[var(--peach)]">
            {`${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase()}
          </div>
          <textarea
            maxLength={2000}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={
              language === "pl"
                ? "Dodaj swój komentarz..."
                : "Add your comment..."
            }
            aria-label={
              language === "pl" ? "Treść komentarza" : "Comment content"
            }
          />
          <Button type="submit" disabled={!content.trim()}>
            {language === "pl" ? "Opublikuj" : "Post"}
          </Button>
        </form>
        <div className="comments-list flex flex-col gap-3">
          {[...post.comments]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map((comment) => (
              <article
                className="comment-card flex gap-3 rounded-xl border border-[var(--line)] bg-white p-5 [&_>_div:last-child]:min-w-0 [&_>_div:last-child]:flex-1 [&_p]:mt-2 [&_p]:whitespace-pre-wrap [&_p]:break-words [&_p]:text-sm [&_p]:leading-relaxed"
                key={comment.id}
              >
                <div className="mini-avatar blue grid size-[31px] shrink-0 place-items-center rounded-full text-xs font-bold text-[var(--green-dark)] [&.blue]:bg-[var(--blue)] [&.yellow]:bg-[var(--yellow)] [&.green]:bg-[var(--green-pale)] [&.peach]:bg-[var(--peach)]">
                  {comment.initials}
                </div>
                <div>
                  <div className="comment-head flex flex-wrap items-center justify-between gap-2 [&_strong]:text-sm [&_time]:text-xs [&_time]:text-[var(--ink-soft)]">
                    <strong>{comment.author}</strong>
                    <time>
                      {new Intl.DateTimeFormat(
                        language === "pl" ? "pl-PL" : "en-GB",
                        {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      ).format(new Date(comment.createdAt))}
                    </time>
                  </div>
                  <p>{comment.content}</p>
                </div>
              </article>
            ))}
          {post.comments.length === 0 && (
            <div className="empty-comments flex items-center gap-3 rounded-xl border border-dashed border-[var(--line)] p-6 text-sm text-[var(--ink-soft)]">
              <Icon name="message" />
              <span>
                {language === "pl"
                  ? "Brak komentarzy. Rozpocznij dyskusję."
                  : "No comments yet. Start the discussion."}
              </span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
