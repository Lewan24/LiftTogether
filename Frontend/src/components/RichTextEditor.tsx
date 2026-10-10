import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import DOMPurify from "dompurify";
import { useId, useState } from "react";
import { Button } from "./ui";
import { apiMessage, uploadImage } from "../services/api";
import type { ForumImage } from "../services/forum";
import type { Language } from "../types";

export function cleanRichText(html: string) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "h2",
      "h3",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "ul",
      "ol",
      "li",
      "blockquote",
      "pre",
      "code",
    ],
    ALLOWED_ATTR: [],
  });
}
export function RichText({ content }: { content: string }) {
  return (
    <div
      className="rich-text"
      dangerouslySetInnerHTML={{ __html: cleanRichText(content) }}
    />
  );
}
export default function RichTextEditor({
  initial = "",
  onChange,
  language,
  label,
}: {
  initial?: string;
  onChange: (html: string) => void;
  language: Language;
  label: string;
}) {
  const id = useId();
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: false }),
    ],
    content: cleanRichText(initial),
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": id,
      },
    },
    onUpdate: ({ editor }) => onChange(cleanRichText(editor.getHTML())),
  });
  const pl = language === "pl";
  const active = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor?.isActive("bold") ?? false,
      italic: editor?.isActive("italic") ?? false,
      heading: editor?.isActive("heading", { level: 2 }) ?? false,
      bulletList: editor?.isActive("bulletList") ?? false,
      orderedList: editor?.isActive("orderedList") ?? false,
    }),
  });
  return (
    <div className="mb-5">
      <p id={id} className="mb-2 text-sm font-bold">
        {label}
      </p>
      <div className="overflow-hidden rounded-xl border border-[var(--line-dark)] bg-white">
        <div
          className="flex flex-wrap gap-1 border-b border-[var(--line)] bg-[var(--paper)] p-2"
          role="group"
          aria-label={pl ? "Formatowanie tekstu" : "Text formatting"}
        >
          <Button
            variant="ghost"
            aria-pressed={active?.bold}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            {pl ? "Pogrubienie" : "Bold"}
          </Button>
          <Button
            variant="ghost"
            aria-pressed={active?.italic}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            {pl ? "Kursywa" : "Italic"}
          </Button>
          <Button
            variant="ghost"
            aria-pressed={active?.heading}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            {pl ? "Nagłówek" : "Heading"}
          </Button>
          <Button
            variant="ghost"
            aria-pressed={active?.bulletList}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            {pl ? "Lista" : "Bullet list"}
          </Button>
          <Button
            variant="ghost"
            aria-pressed={active?.orderedList}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          >
            {pl ? "Numeracja" : "Numbered list"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => editor?.chain().focus().undo().run()}
          >
            {pl ? "Cofnij" : "Undo"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => editor?.chain().focus().redo().run()}
          >
            {pl ? "Ponów" : "Redo"}
          </Button>
        </div>
        <EditorContent
          editor={editor}
          className="rich-text [&_.tiptap]:min-h-40 [&_.tiptap]:p-4"
        />
      </div>
    </div>
  );
}
export function ImageAttachments({
  images,
  onChange,
  language,
  onBusyChange,
}: {
  images: ForumImage[];
  onChange: (images: ForumImage[]) => void;
  language: Language;
  onBusyChange: (busy: boolean) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pl = language === "pl";
  return (
    <div className="my-4">
      <label className="block text-sm font-bold">
        {pl ? "Zdjęcia" : "Images"}
        <input
          className="mt-2 block w-full text-sm font-normal"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          disabled={busy}
          onChange={async (event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            setError("");
            if (
              files.length + images.length > 4 ||
              files.some(
                (f) =>
                  !["image/png", "image/jpeg", "image/webp"].includes(f.type) ||
                  f.size > 2 * 1024 * 1024,
              )
            ) {
              setError(
                pl
                  ? "Maksymalnie 4 zdjęcia PNG, JPG lub WebP, po 2 MB."
                  : "Up to 4 PNG, JPG or WebP images, 2 MB each.",
              );
              return;
            }
            setBusy(true);
            onBusyChange(true);
            try {
              const added = await Promise.all(files.map(uploadImage));
              onChange([...images, ...added]);
            } catch (e) {
              setError(apiMessage(e, language));
            } finally {
              setBusy(false);
              onBusyChange(false);
            }
          }}
        />
      </label>
      <p className="mt-1 text-xs text-[var(--ink-soft)]">
        {pl
          ? "Do 4 zdjęć, po 2 MB. PNG, JPG, WebP."
          : "Up to 4 images, 2 MB each. PNG, JPG, WebP."}
      </p>
      {busy && <p role="status">{pl ? "Wczytywanie…" : "Reading images…"}</p>}
      {error && (
        <p role="alert" className="text-[var(--red)]">
          {error}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-3">
        {images.map((img) => (
          <div key={img.id} className="w-32">
            <img
              src={img.src}
              alt={img.name}
              className="h-24 w-full rounded-lg object-cover"
            />
            <Button
              variant="ghost"
              onClick={() => onChange(images.filter((i) => i.id !== img.id))}
            >
              {pl ? "Usuń" : "Remove"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
export function AttachedImages({ images }: { images: ForumImage[] }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 max-[600px]:grid-cols-1">
      {images.map((i) => (
        <a href={i.src} download={i.name} key={i.id}>
          <img
            src={i.src}
            alt={i.name}
            className="max-h-96 w-full rounded-lg object-contain"
            loading="lazy"
          />
        </a>
      ))}
    </div>
  );
}
