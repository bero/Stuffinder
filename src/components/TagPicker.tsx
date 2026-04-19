import { useState } from 'preact/hooks';
import { createTag } from '../lib/api';
import { useT } from '../lib/i18n';
import type { Tag, TagRef } from '../types/database';

interface Props {
  householdId: string;
  selected: TagRef[];
  allTags: Tag[];
  onChange: (selected: TagRef[]) => void;
  onTagCreated: (tag: Tag) => void; // so parent can refresh its tag list
}

// Inline editor: shows selected tags as removable chips and an input that
// searches the household tag list. Type + Enter creates a new tag if nothing
// matches. Untapped suggestions appear as selectable chips below.
export function TagPicker({ householdId, selected, allTags, onChange, onTagCreated }: Props) {
  const t = useT();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedIds = new Set(selected.map((s) => s.id));
  const query = input.trim().toLowerCase();
  const matches = allTags
    .filter((tag) => !selectedIds.has(tag.id))
    .filter((tag) => !query || tag.name.toLowerCase().includes(query))
    .slice(0, 20);

  const exactMatch = allTags.find((tag) => tag.name.toLowerCase() === query);
  const canCreate = query.length > 0 && !exactMatch;

  function addTag(tag: TagRef) {
    if (selectedIds.has(tag.id)) return;
    onChange([...selected, tag]);
    setInput('');
  }

  function removeTag(tagId: string) {
    onChange(selected.filter((s) => s.id !== tagId));
  }

  async function handleCreate() {
    if (!canCreate || busy) return;
    try {
      setBusy(true);
      setError(null);
      const created = await createTag(householdId, input);
      onTagCreated(created);
      addTag({ id: created.id, name: created.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tag');
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (exactMatch) {
        addTag({ id: exactMatch.id, name: exactMatch.name });
      } else if (canCreate) {
        handleCreate();
      }
    } else if (e.key === 'Backspace' && !input && selected.length > 0) {
      // Quick remove last tag when input is empty.
      removeTag(selected[selected.length - 1].id);
    }
  }

  return (
    <div class="space-y-2">
      {selected.length > 0 && (
        <div class="flex flex-wrap gap-2">
          {selected.map((tag) => (
            <span
              key={tag.id}
              class="inline-flex items-center gap-1 bg-primary-900/50 border border-primary-700 text-primary-200 rounded-full px-2.5 py-1 text-sm"
            >
              <span>{tag.name}</span>
              <button
                type="button"
                onClick={() => removeTag(tag.id)}
                class="text-primary-300 hover:text-white"
                aria-label={t('common.delete')}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        type="text"
        value={input}
        onInput={(e) => setInput((e.target as HTMLInputElement).value)}
        onKeyDown={handleKeyDown}
        placeholder={t('tags.searchOrCreate')}
        class="input"
      />

      {error && <p class="text-red-400 text-sm">{error}</p>}

      <div class="flex flex-wrap gap-2">
        {matches.map((tag) => (
          <button
            key={tag.id}
            type="button"
            onClick={() => addTag({ id: tag.id, name: tag.name })}
            class="bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-full px-2.5 py-1 text-sm"
          >
            {tag.name}
          </button>
        ))}
        {canCreate && (
          <button
            type="button"
            onClick={handleCreate}
            disabled={busy}
            class="bg-primary-700 hover:bg-primary-600 text-white rounded-full px-2.5 py-1 text-sm"
          >
            {t('tags.create', { name: input.trim() })}
          </button>
        )}
      </div>
    </div>
  );
}
