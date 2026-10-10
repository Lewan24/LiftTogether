import { useEffect, useRef, useState } from "react";
import { Button, Field, PageHeader } from "../components/ui";
import Dialog from "../components/Dialog";
import RichTextEditor, {
  AttachedImages,
  cleanRichText,
  ImageAttachments,
  RichText,
} from "../components/RichTextEditor";
import {
  getDiscussion,
  getForum,
  deleteReply,
  moderateDiscussion,
  replyToDiscussion,
  storeDiscussion,
  type Discussion,
  type ForumData,
  type ForumImage,
} from "../services/forum";
import Pagination from "../components/Pagination";
import { apiMessage } from "../services/api";
import type { User } from "../services/storage";
import type { Language } from "../types";

const selectClass =
  "rounded-lg border border-[var(--line-dark)] bg-white p-3 text-sm";
export default function ForumPage({
  language,
  user,
  data,
  onChange,
}: {
  language: Language;
  user: User;
  data: ForumData;
  onChange: (data: ForumData) => void;
}) {
  const pl = language === "pl",
    admin = user.role === "admin";
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Discussion | null | undefined>(
    undefined,
  );
  const [error, setError] = useState("");
  const [replyKey, setReplyKey] = useState(0);
  const [selected, setSelected] = useState<Discussion | null>(null);
  const [replyPage, setReplyPage] = useState(0),
    [replyMore, setReplyMore] = useState(false),
    [pending, setPending] = useState(false);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  useEffect(() => {
    const controller = new AbortController();
    if (!selectedId) {
      setSelected(null);
      return;
    }
    getDiscussion(selectedId, replyPage, controller.signal)
      .then((r) => {
        setSelected(r.discussion);
        setReplyMore(r.hasMore);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(apiMessage(e, language));
          setSelectedId(null);
        }
      });
    return () => controller.abort();
  }, [selectedId, replyPage, data, language]);
  const openDiscussion = (id: string) => {
    setSelected(null);
    setReplyPage(0);
    setSelectedId(id);
  };

  const filterSequence = useRef(0);
  useEffect(() => {
    const seq = ++filterSequence.current;
    const timer = setTimeout(() => {
      void getForum(0, search, category)
        .then((r) => {
          if (seq === filterSequence.current) changeRef.current(r);
        })
        .catch((e) => {
          if (seq === filterSequence.current) setError(apiMessage(e, language));
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      filterSequence.current++;
    };
  }, [search, category, language]);
  const discussions = data.discussions;
  async function perform(action: () => Promise<ForumData>) {
    if (pending) return false;
    setPending(true);
    try {
      onChange(await action());
      setError("");
      return true;
    } catch (e) {
      setError(apiMessage(e, language));
      return false;
    } finally {
      setPending(false);
    }
  }
  const date = (value: string) =>
    new Date(value).toLocaleString(pl ? "pl-PL" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  function controls(d: Discussion) {
    return (
      <div className="flex flex-wrap gap-2">
        {(admin || d.userId === user.id) && (
          <Button
            variant="secondary"
            icon="edit"
            onClick={async () => {
              try {
                setEditing((await getDiscussion(d.id)).discussion);
              } catch (e) {
                setError(apiMessage(e, language));
              }
            }}
          >
            {pl ? "Edytuj" : "Edit"}
          </Button>
        )}
        {admin && (
          <>
            <Button
              variant="secondary"
              aria-pressed={d.pinned}
              onClick={() =>
                perform(() =>
                  moderateDiscussion(d.id, "pin", d.version, d.pinned),
                )
              }
            >
              {d.pinned ? (pl ? "Odepnij" : "Unpin") : pl ? "Przypnij" : "Pin"}
            </Button>
            <Button
              variant="danger"
              icon="trash"
              onClick={() => {
                if (
                  window.confirm(
                    pl
                      ? "Usunąć dyskusję i wszystkie komentarze?"
                      : "Delete this discussion and all comments?",
                  )
                )
                  perform(() => moderateDiscussion(d.id, "delete"));
              }}
            >
              {pl ? "Usuń" : "Delete"}
            </Button>
          </>
        )}
      </div>
    );
  }
  return (
    <div
      aria-busy={pending}
      className="page mx-auto max-w-[1200px] px-[4%] pt-11 pb-16 max-[820px]:px-5"
    >
      <PageHeader
        eyebrow={pl ? "SPOŁECZNOŚĆ" : "COMMUNITY"}
        title="Forum"
        subtitle={
          pl
            ? "Pytaj, dziel się pomysłami i rozmawiaj z innymi oraz administracją."
            : "Ask questions, share ideas and talk with members and gym staff."
        }
        action={
          <Button icon="plus" onClick={() => setEditing(null)}>
            {pl ? "Nowa dyskusja" : "New discussion"}
          </Button>
        }
      />
      {error && (
        <p role="alert" className="mb-4 text-[var(--red)]">
          {error}
        </p>
      )}
      {selected ? (
        <>
          <Button
            variant="ghost"
            icon="chevron-left"
            className="mb-5"
            onClick={() => setSelectedId(null)}
          >
            {pl ? "Wszystkie dyskusje" : "All discussions"}
          </Button>
          <article className="rounded-xl border border-[var(--line)] bg-white p-6">
            <p className="mb-3 text-sm text-[var(--green)]">
              {selected.pinned && (pl ? "Przypięte · " : "Pinned · ")}
              {data.categories.find((c) => c.id === selected.categoryId)?.name}
            </p>
            <h2 className="font-display text-2xl font-extrabold break-words">
              {selected.title}
            </h2>
            <p className="my-3 text-sm text-[var(--ink-soft)]">
              {selected.author} · {date(selected.createdAt)}
            </p>
            <RichText content={selected.content} />
            <AttachedImages images={selected.images} />
            <div className="mt-5">{controls(selected)}</div>
          </article>
          <section className="mt-8">
            <h2 className="mb-4 text-xl font-bold">
              {pl ? "Komentarze" : "Comments"} ({selected.commentCount})
            </h2>
            {selected.comments.length === 0 && (
              <p className="mb-5 text-sm text-[var(--ink-soft)]">
                {pl
                  ? "Rozpocznij rozmowę — dodaj pierwszy komentarz."
                  : "Start the conversation with the first comment."}
              </p>
            )}
            {selected.comments.map((c) => (
              <article
                key={c.id}
                className="mb-3 rounded-xl border border-[var(--line)] bg-white p-5"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm">
                    <strong>{c.author}</strong> · {date(c.createdAt)}
                  </p>
                  {(admin || c.userId === user.id) && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        if (
                          window.confirm(
                            pl ? "Usunąć komentarz?" : "Delete comment?",
                          )
                        )
                          perform(() => deleteReply(selected.id, c.id));
                      }}
                    >
                      {pl ? "Usuń komentarz" : "Delete comment"}
                    </Button>
                  )}
                </div>
                <RichText content={c.content} />
                <AttachedImages images={c.images} />
              </article>
            ))}
            <ReplyComposer
              key={`${selected.id}-${replyKey}`}
              language={language}
              onSubmit={async (content, images) => {
                if (
                  await perform(() =>
                    replyToDiscussion(selected.id, content, images),
                  )
                )
                  setReplyKey((k) => k + 1);
              }}
            />
          </section>
        </>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-end gap-4">
            <div className="min-w-0 flex-1">
              <Field
                label={pl ? "Szukaj dyskusji" : "Search discussions"}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <label className="mb-[18px] flex flex-col gap-2 text-sm font-bold">
              {pl ? "Kategoria" : "Category"}
              <select
                className={selectClass}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">
                  {pl ? "Wszystkie kategorie" : "All categories"}
                </option>
                {data.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-white">
            {discussions.map((d) => (
              <article
                key={d.id}
                className="border-b border-[var(--line)] p-5 last:border-0"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="mb-2 text-xs font-bold text-[var(--green)]">
                      {d.pinned && (pl ? "PRZYPIĘTE · " : "PINNED · ")}
                      {data.categories.find((c) => c.id === d.categoryId)?.name}
                    </p>
                    <button
                      className="text-left font-display text-lg font-extrabold break-words hover:text-[var(--green)]"
                      onClick={() => openDiscussion(d.id)}
                    >
                      {d.title}
                    </button>
                    <p className="mt-2 text-xs text-[var(--ink-soft)]">
                      {d.author} · {date(d.createdAt)} · {d.commentCount}{" "}
                      {pl ? "komentarzy" : "comments"}
                    </p>
                  </div>
                  {controls(d)}
                </div>
              </article>
            ))}
            {!discussions.length && (
              <div className="p-10 text-center">
                <h2 className="mb-2 text-lg font-bold">
                  {pl ? "Brak dyskusji" : "No discussions yet"}
                </h2>
                <p className="text-sm text-[var(--ink-soft)]">
                  {pl
                    ? "Zmień filtr lub rozpocznij nowy temat."
                    : "Try another filter or start a new topic."}
                </p>
              </div>
            )}
          </div>
        </>
      )}
      {selected && (
        <Pagination
          language={language}
          page={replyPage}
          hasMore={replyMore}
          onChange={setReplyPage}
        />
      )}
      {!selectedId && (
        <Pagination
          language={language}
          page={data.page}
          hasMore={data.hasMore}
          onChange={(page) => void perform(() => getForum(page))}
        />
      )}
      {selectedId && !selected && (
        <p role="status">{pl ? "Wczytywanie…" : "Loading…"}</p>
      )}
      {editing !== undefined && (
        <DiscussionEditor
          language={language}
          discussion={editing}
          data={data}
          close={() => setEditing(undefined)}
          onSave={async (input) => {
            const saved = await perform(() =>
              storeDiscussion(
                { ...input, version: editing?.version },
                editing?.id,
              ),
            );
            if (saved) setEditing(undefined);
            return saved;
          }}
        />
      )}
    </div>
  );
}
function DiscussionEditor({
  language,
  discussion,
  data,
  close,
  onSave,
}: {
  language: Language;
  discussion: Discussion | null;
  data: ForumData;
  close: () => void;
  onSave: (
    input: Pick<Discussion, "title" | "content" | "images" | "categoryId">,
  ) => Promise<boolean>;
}) {
  const pl = language === "pl";
  const [title, setTitle] = useState(discussion?.title ?? ""),
    [content, setContent] = useState(discussion?.content ?? ""),
    [categoryId, setCategoryId] = useState(
      discussion?.categoryId ?? data.categories[0]?.id ?? "",
    ),
    [images, setImages] = useState<ForumImage[]>(discussion?.images ?? []);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      className="m-auto max-h-[90dvh] w-[min(94vw,760px)] overflow-y-auto rounded-2xl border-0 bg-white p-6 text-[var(--ink)]"
      label={pl ? "Edytor dyskusji" : "Discussion editor"}
      close={close}
    >
      <div className="mb-6 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">
          {discussion
            ? pl
              ? "Edytuj dyskusję"
              : "Edit discussion"
            : pl
              ? "Nowa dyskusja"
              : "New discussion"}
        </h2>
        <Button variant="ghost" onClick={close}>
          {pl ? "Zamknij" : "Close"}
        </Button>
      </div>
      <Field
        label={pl ? "Tytuł" : "Title"}
        maxLength={200}
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <label className="mb-5 flex flex-col gap-2 text-sm font-bold">
        {pl ? "Kategoria" : "Category"}
        <select
          required
          className={selectClass}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          {data.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <RichTextEditor
        initial={content}
        onChange={setContent}
        language={language}
        label={pl ? "Treść" : "Content"}
      />
      <ImageAttachments
        images={images}
        onChange={setImages}
        language={language}
        onBusyChange={setBusy}
      />
      {error && (
        <p role="alert" className="mb-3 text-[var(--red)]">
          {error}
        </p>
      )}
      <Button
        disabled={busy}
        onClick={async () => {
          if (
            !title.trim() ||
            (!content.replace(/<[^>]*>/g, "").trim() && !images.length) ||
            content.length > 50000
          ) {
            setError(
              pl
                ? "Dodaj tytuł i treść lub zdjęcie. Maksymalnie 50 000 znaków treści."
                : "Add a title and content or an image. Maximum 50,000 characters of content.",
            );
            return;
          }
          setBusy(true);
          try {
            if (
              !(await onSave({
                title,
                content: cleanRichText(content),
                categoryId,
                images,
              }))
            )
              setError(
                pl
                  ? "Nie udało się zapisać dyskusji. Sprawdź treść i kategorię."
                  : "Could not save discussion. Check the content and category.",
              );
          } finally {
            setBusy(false);
          }
        }}
      >
        {pl ? "Zapisz dyskusję" : "Save discussion"}
      </Button>
    </Dialog>
  );
}
function ReplyComposer({
  language,
  onSubmit,
}: {
  language: Language;
  onSubmit: (content: string, images: ForumImage[]) => Promise<void>;
}) {
  const [content, setContent] = useState(""),
    [images, setImages] = useState<ForumImage[]>([]),
    [error, setError] = useState("");
  const pl = language === "pl";
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-6 rounded-xl border border-[var(--line)] bg-white p-5">
      <RichTextEditor
        onChange={setContent}
        language={language}
        label={pl ? "Twój komentarz" : "Your comment"}
      />
      <ImageAttachments
        images={images}
        onChange={setImages}
        language={language}
        onBusyChange={setBusy}
      />
      {error && (
        <p role="alert" className="mb-3 text-[var(--red)]">
          {error}
        </p>
      )}
      <Button
        disabled={busy}
        onClick={async () => {
          if (!content.replace(/<[^>]*>/g, "").trim() && !images.length) {
            setError(pl ? "Dodaj treść lub zdjęcie." : "Add text or an image.");
            return;
          }
          setBusy(true);
          try {
            await onSubmit(cleanRichText(content), images);
          } finally {
            setBusy(false);
          }
        }}
      >
        {pl ? "Dodaj komentarz" : "Post comment"}
      </Button>
    </div>
  );
}
