import { useState } from "react";
import {
  removeCategory,
  storeCategory,
  type ForumData,
} from "../services/forum";
import { apiMessage } from "../services/api";
import { Button, Field } from "./ui";
import type { Language } from "../types";
export default function ForumCategories({
  data,
  onChange,
  language,
}: {
  data: ForumData;
  onChange: (data: ForumData) => void;
  language: Language;
}) {
  const pl = language === "pl";
  const [name, setName] = useState(""),
    [id, setId] = useState<string | undefined>(),
    [error, setError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null),
    [replacement, setReplacement] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(action: () => Promise<ForumData>) {
    if (busy) return false;
    setBusy(true);
    try {
      onChange(await action());
      setError("");
      return true;
    } catch (e) {
      setError(apiMessage(e, language));
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      aria-busy={busy}
      className="rounded-xl border border-[var(--line)] bg-white p-6"
    >
      <h2 className="mb-2 text-xl font-bold">
        {pl ? "Kategorie forum" : "Forum categories"}
      </h2>
      <p className="mb-6 text-sm text-[var(--ink-soft)]">
        {pl
          ? "Dodawaj i zmieniaj kategorie. Przy usuwaniu przenieś dyskusje do innej kategorii."
          : "Add and rename categories. When deleting, move discussions to another category."}
      </p>
      <Field
        label={
          id
            ? pl
              ? "Edytuj nazwę"
              : "Edit name"
            : pl
              ? "Nowa kategoria"
              : "New category"
        }
        value={name}
        maxLength={80}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="mb-6 flex gap-2">
        <Button
          onClick={async () => {
            if (await run(() => storeCategory(name, id))) {
              setName("");
              setId(undefined);
            }
          }}
        >
          {pl ? "Zapisz kategorię" : "Save category"}
        </Button>
        {id && (
          <Button
            variant="ghost"
            onClick={() => {
              setId(undefined);
              setName("");
            }}
          >
            {pl ? "Anuluj" : "Cancel"}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="mb-4 text-[var(--red)]">
          {error}
        </p>
      )}
      {data.categories.map((c) => (
        <div
          key={c.id}
          className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] py-4"
        >
          <div>
            <strong>{c.name}</strong>
            <p className="text-xs text-[var(--ink-soft)]">
              {c.discussionCount ??
                data.discussions.filter((d) => d.categoryId === c.id)
                  .length}{" "}
              {pl ? "dyskusji" : "discussions"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setId(c.id);
                setName(c.name);
              }}
            >
              {pl ? "Edytuj" : "Edit"}
            </Button>
            <Button
              variant="danger"
              disabled={data.categories.length < 2}
              onClick={() => {
                setDeleting(c.id);
                setReplacement(
                  data.categories.find((entry) => entry.id !== c.id)!.id,
                );
              }}
            >
              {pl ? "Usuń" : "Delete"}
            </Button>
          </div>
        </div>
      ))}
      {data.categories.length < 2 && (
        <p className="text-xs text-[var(--ink-soft)]">
          {pl
            ? "Musi pozostać co najmniej jedna kategoria."
            : "At least one category must remain."}
        </p>
      )}
      {deleting && (
        <div className="mt-4 rounded-xl bg-[var(--paper)] p-4">
          <label className="flex flex-col gap-2 text-sm font-bold">
            {pl ? "Przenieś dyskusje do" : "Move discussions to"}
            <select
              className="rounded-lg border border-[var(--line-dark)] bg-white p-3"
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
            >
              {data.categories
                .filter((c) => c.id !== deleting)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="danger"
              onClick={async () => {
                if (await run(() => removeCategory(deleting, replacement))) {
                  if (id === deleting) {
                    setId(undefined);
                    setName("");
                  }
                  setDeleting(null);
                }
              }}
            >
              {pl ? "Przenieś i usuń kategorię" : "Move and delete category"}
            </Button>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              {pl ? "Anuluj" : "Cancel"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
