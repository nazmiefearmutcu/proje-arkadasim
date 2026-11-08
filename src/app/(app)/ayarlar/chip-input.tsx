"use client";

import { X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ITEM_MAX } from "@/lib/settings/limits";

export interface ChipInputProps {
  id: string;
  /** Form alanı adı. Değer JSON dizisi olarak gönderilir. */
  name: string;
  label: string;
  hint: string;
  placeholder: string;
  initial: string[];
  max: number;
  error?: string;
}

/** Etiket girişi: Enter ya da virgülle ekler, çipteki düğmeyle kaldırır. Değer gizli alanda JSON'dur. */
export function ChipInput({ id, name, label, hint, placeholder, initial, max, error }: ChipInputProps) {
  const [items, setItems] = useState<string[]>(initial);
  const [draft, setDraft] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  function add() {
    const value = draft.trim().slice(0, ITEM_MAX);
    if (value.length === 0) return;
    const key = value.toLocaleLowerCase("tr-TR");
    if (items.some((item) => item.toLocaleLowerCase("tr-TR") === key)) {
      setDraft("");
      return;
    }
    if (items.length >= max) {
      setLocalError(`En fazla ${max} tane ekleyebilirsin. Yeni eklemek için birini kaldır.`);
      return;
    }
    setItems([...items, value]);
    setDraft("");
    setLocalError(null);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Field id={`${id}-input`} label={label} hint={hint} error={error ?? localError ?? undefined}>
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          maxLength={ITEM_MAX}
          autoComplete="off"
        />
      </Field>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={add}>
          Ekle
        </Button>
      </div>
      {items.length > 0 ? (
        <ul aria-label={`${label} listesi`} className="flex flex-wrap gap-2">
          {items.map((item, index) => (
            <li
              key={`${item}-${index}`}
              className="inline-flex min-h-9 items-center gap-1 rounded-chip bg-pen-soft pr-1 pl-3 t-label text-pen"
            >
              <span>{item}</span>
              <button
                type="button"
                aria-label={`${item} etiketini kaldır`}
                onClick={() => {
                  setItems(items.filter((_, position) => position !== index));
                  setLocalError(null);
                }}
                className="inline-flex size-9 items-center justify-center rounded-chip focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pen"
              >
                <X aria-hidden="true" strokeWidth={1.75} className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <input type="hidden" name={name} value={JSON.stringify(items)} />
    </div>
  );
}
