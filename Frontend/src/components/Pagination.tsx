import { Button } from "./ui";
import type { Language } from "../types";
export default function Pagination({
  page,
  hasMore,
  onChange,
  language,
}: {
  page: number;
  hasMore: boolean;
  onChange: (page: number) => void;
  language: Language;
}) {
  if (!page && !hasMore) return null;
  return (
    <nav
      aria-label={language === "pl" ? "Strony wyników" : "Result pages"}
      className="my-5 flex flex-wrap items-center justify-center gap-3"
    >
      <Button
        variant="secondary"
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
      >
        {language === "pl" ? "Poprzednia" : "Previous"}
      </Button>
      <span className="text-sm">
        {language === "pl" ? "Strona" : "Page"} {page + 1}
      </span>
      <Button
        variant="secondary"
        disabled={!hasMore}
        onClick={() => onChange(page + 1)}
      >
        {language === "pl" ? "Następna" : "Next"}
      </Button>
    </nav>
  );
}
