import { useState } from 'preact/hooks';
import { createCategory, createLocation } from '../lib/api';
import { useT } from '../lib/i18n';
import type { Category, Location } from '../types/database';
import { EmojiPicker } from './EmojiPicker';

interface CategoryProps {
  householdId: string;
  onCreated: (c: Category) => void;
  onClose: () => void;
}

export function QuickCreateCategory({ householdId, onCreated, onClose }: CategoryProps) {
  const t = useT();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: Event) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setSaving(true);
      setError(null);
      const created = await createCategory(householdId, {
        name: name.trim(),
        icon: icon || undefined,
      });
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settings.failedAddCategory'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div class="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <form onSubmit={submit} class="bg-slate-800 rounded-xl p-6 max-w-sm w-full space-y-4">
        <h3 class="text-lg font-semibold text-slate-100">{t('settings.addCategory')}</h3>
        <div class="flex gap-3">
          <EmojiPicker value={icon} onChange={setIcon} placeholder="📦" />
          <input
            type="text"
            value={name}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            placeholder={t('settings.categoryName')}
            class="input flex-1"
            required
            autoFocus
          />
        </div>
        {error && <p class="text-red-400 text-sm">{error}</p>}
        <div class="flex gap-2">
          <button type="button" onClick={onClose} class="btn-secondary flex-1" disabled={saving}>
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={saving || !name.trim()} class="btn-primary flex-1">
            {saving ? t('common.adding') : t('common.add')}
          </button>
        </div>
      </form>
    </div>
  );
}

interface LocationProps {
  householdId: string;
  locations: Array<Location & { full_path: string }>;
  onCreated: (l: Location) => void;
  onClose: () => void;
}

export function QuickCreateLocation({ householdId, locations, onCreated, onClose }: LocationProps) {
  const t = useT();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [parentId, setParentId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: Event) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setSaving(true);
      setError(null);
      const created = await createLocation(householdId, {
        name: name.trim(),
        icon: icon || undefined,
        parent_id: parentId || undefined,
      });
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settings.failedAddLocation'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div class="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <form onSubmit={submit} class="bg-slate-800 rounded-xl p-6 max-w-sm w-full space-y-4">
        <h3 class="text-lg font-semibold text-slate-100">{t('settings.addLocation')}</h3>
        <div class="flex gap-3">
          <EmojiPicker value={icon} onChange={setIcon} placeholder="📍" />
          <input
            type="text"
            value={name}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            placeholder={t('settings.locationName')}
            class="input flex-1"
            required
            autoFocus
          />
        </div>
        <select
          value={parentId}
          onChange={(e) => setParentId((e.target as HTMLSelectElement).value)}
          class="select"
        >
          <option value="">{t('settings.noParent')}</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.icon} {loc.full_path}
            </option>
          ))}
        </select>
        {error && <p class="text-red-400 text-sm">{error}</p>}
        <div class="flex gap-2">
          <button type="button" onClick={onClose} class="btn-secondary flex-1" disabled={saving}>
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={saving || !name.trim()} class="btn-primary flex-1">
            {saving ? t('common.adding') : t('common.add')}
          </button>
        </div>
      </form>
    </div>
  );
}
