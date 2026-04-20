import { useState, useEffect, useRef } from 'preact/hooks';
import { route } from 'preact-router';
import { createItem, addItemPhoto, deleteItem, getCategories, getLocationsWithPath, getTags, setItemTags } from '../lib/api';
import { useT } from '../lib/i18n';
import { QuickCreateCategory, QuickCreateLocation } from '../components/QuickCreate';
import { TagPicker } from '../components/TagPicker';
import { WebcamCapture } from '../components/WebcamCapture';
import type { Category, Location, Tag, TagRef } from '../types/database';

const hasWebcam = typeof navigator !== 'undefined'
  && typeof navigator.mediaDevices !== 'undefined'
  && typeof navigator.mediaDevices.getUserMedia === 'function';

function CameraIcon() {
  return (
    <svg class="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
      <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

interface Props {
  activeHouseholdId?: string;
}

export function AddItem({ activeHouseholdId }: Props) {
  const t = useT();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [photos, setPhotos] = useState<Array<{ file: File; preview: string }>>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Array<Location & { full_path: string }>>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<TagRef[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [showNewLocation, setShowNewLocation] = useState(false);
  const [showWebcam, setShowWebcam] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!activeHouseholdId) return;
    async function loadData() {
      try {
        const [cats, locs, tagList] = await Promise.all([
          getCategories(activeHouseholdId!),
          getLocationsWithPath(activeHouseholdId!),
          getTags(activeHouseholdId!),
        ]);
        setCategories(cats);
        setLocations(locs);
        setAllTags(tagList);
      } catch (err) {
        console.error('Failed to load data:', err);
      }
    }
    loadData();
  }, [activeHouseholdId]);

  // Clean up object URLs when photos change or on unmount.
  useEffect(() => () => {
    photos.forEach((p) => URL.revokeObjectURL(p.preview));
  }, []);

  function handlePhotoChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    if (files.length === 0) return;
    const newEntries = files.map((file) => ({ file, preview: URL.createObjectURL(file) }));
    setPhotos((prev) => [...prev, ...newEntries]);
    input.value = ''; // allow selecting the same file again later
  }

  function removePhotoAt(index: number) {
    setPhotos((prev) => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  function openPicker() {
    fileInputRef.current?.click();
  }

  function handleWebcamCapture(file: File) {
    setPhotos((prev) => [...prev, { file, preview: URL.createObjectURL(file) }]);
    setShowWebcam(false);
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();

    if (!activeHouseholdId) {
      setError(t('addItem.noHousehold'));
      return;
    }
    if (!name.trim()) {
      setError(t('addItem.pleaseEnterName'));
      return;
    }

    let createdId: string | null = null;
    try {
      setSaving(true);
      setError(null);

      const item = await createItem(activeHouseholdId, {
        name: name.trim(),
        description: description.trim() || undefined,
        category_id: categoryId || undefined,
        location_id: locationId || undefined,
      });
      createdId = item.id;

      for (let i = 0; i < photos.length; i++) {
        await addItemPhoto(item.id, activeHouseholdId, photos[i].file, i);
      }

      if (selectedTags.length > 0) {
        await setItemTags(item.id, selectedTags.map((t) => t.id));
      }

      route('/');
    } catch (err) {
      // If creation succeeded but photos failed partway, roll back the item so
      // we don't leave a phantom row.
      if (createdId) {
        try { await deleteItem(createdId); } catch { /* best-effort */ }
      }
      setError(err instanceof Error ? err.message : t('addItem.failedSave'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div class="min-h-screen">
      <header class="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center gap-4 safe-top">
        <button
          onClick={() => route('/')}
          class="p-1 -ml-1 text-slate-400 hover:text-slate-200"
        >
          <BackIcon />
        </button>
        <h1 class="text-lg font-semibold">{t('addItem.title')}</h1>
      </header>

      <form onSubmit={handleSubmit} class="p-4 space-y-6">
        {/* Photos */}
        <div>
          <label class="input-label">{t('addItem.photo')}</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoChange}
            class="hidden"
          />

          {photos.length === 0 ? (
            <div class="space-y-2">
              <button
                type="button"
                onClick={openPicker}
                class="w-full h-48 border-2 border-dashed border-slate-600 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-slate-500 hover:bg-slate-800/50 transition-colors"
              >
                <CameraIcon />
                <span class="text-slate-400">{t('addItem.addExistingPhoto')}</span>
              </button>
              {hasWebcam && (
                <button
                  type="button"
                  onClick={() => setShowWebcam(true)}
                  class="btn-secondary w-full py-2 text-sm"
                >
                  🎥 {t('addItem.useCamera')}
                </button>
              )}
            </div>
          ) : (
            <div class="grid grid-cols-3 gap-2">
              {photos.map((p, i) => (
                <div key={p.preview} class="relative aspect-square">
                  <img src={p.preview} alt="" class="w-full h-full object-cover rounded-lg" />
                  <button
                    type="button"
                    onClick={() => removePhotoAt(i)}
                    class="absolute top-1 right-1 p-1 bg-slate-900/80 rounded-full text-slate-200 hover:text-white"
                    aria-label={t('common.delete')}
                  >
                    <XIcon />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={openPicker}
                class="aspect-square border-2 border-dashed border-slate-600 rounded-lg flex items-center justify-center text-slate-400 hover:border-slate-500 hover:bg-slate-800/50 transition-colors"
                aria-label={t('addItem.addExistingPhoto')}
              >
                <CameraIcon />
              </button>
              {hasWebcam && (
                <button
                  type="button"
                  onClick={() => setShowWebcam(true)}
                  class="aspect-square border-2 border-dashed border-slate-600 rounded-lg flex items-center justify-center text-2xl hover:border-slate-500 hover:bg-slate-800/50 transition-colors"
                  aria-label={t('addItem.useCamera')}
                  title={t('addItem.useCamera')}
                >
                  🎥
                </button>
              )}
            </div>
          )}
        </div>

        {/* Name */}
        <div>
          <label class="input-label" for="name">{t('addItem.name')}</label>
          <input
            id="name"
            type="text"
            value={name}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            placeholder={t('addItem.namePlaceholder')}
            class="input"
            required
          />
        </div>

        {/* Location */}
        <div>
          <label class="input-label" for="location">{t('addItem.location')}</label>
          <div class="flex gap-2">
            <select
              id="location"
              value={locationId}
              onChange={(e) => setLocationId((e.target as HTMLSelectElement).value)}
              class="select flex-1"
            >
              <option value="">{t('addItem.selectLocation')}</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.icon} {loc.full_path}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowNewLocation(true)}
              class="btn-secondary px-3"
              aria-label={t('settings.addLocation')}
              title={t('settings.addLocation')}
            >
              +
            </button>
          </div>
        </div>

        {/* Category */}
        <div>
          <label class="input-label" for="category">{t('addItem.category')}</label>
          <div class="flex gap-2">
            <select
              id="category"
              value={categoryId}
              onChange={(e) => setCategoryId((e.target as HTMLSelectElement).value)}
              class="select flex-1"
            >
              <option value="">{t('addItem.selectCategory')}</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowNewCategory(true)}
              class="btn-secondary px-3"
              aria-label={t('settings.addCategory')}
              title={t('settings.addCategory')}
            >
              +
            </button>
          </div>
        </div>

        {/* Description */}
        <div>
          <label class="input-label" for="description">{t('addItem.descriptionOptional')}</label>
          <textarea
            id="description"
            value={description}
            onInput={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
            placeholder={t('addItem.descPlaceholder')}
            rows={3}
            class="input resize-none"
          />
        </div>

        {/* Tags */}
        {activeHouseholdId && (
          <div>
            <label class="input-label">{t('addItem.tags')}</label>
            <TagPicker
              householdId={activeHouseholdId}
              selected={selectedTags}
              allTags={allTags}
              onChange={setSelectedTags}
              onTagCreated={(tag) => setAllTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)))}
            />
          </div>
        )}

        {/* Error message */}
        {error && (
          <div class="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={saving || !name.trim()}
          class="btn-primary w-full py-4 text-lg"
        >
          {saving ? (
            <span class="flex items-center justify-center gap-2">
              <span class="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></span>
              {t('common.saving')}
            </span>
          ) : (
            t('addItem.save')
          )}
        </button>
      </form>

      {showNewCategory && activeHouseholdId && (
        <QuickCreateCategory
          householdId={activeHouseholdId}
          onCreated={(c) => {
            setCategories((prev) => [...prev, c]);
            setCategoryId(c.id);
            setShowNewCategory(false);
          }}
          onClose={() => setShowNewCategory(false)}
        />
      )}
      {showNewLocation && activeHouseholdId && (
        <QuickCreateLocation
          householdId={activeHouseholdId}
          locations={locations}
          onCreated={(l) => {
            const parent = l.parent_id ? locations.find((x) => x.id === l.parent_id) : null;
            const full_path = parent ? `${parent.full_path} > ${l.name}` : l.name;
            setLocations((prev) => [...prev, { ...l, full_path }]);
            setLocationId(l.id);
            setShowNewLocation(false);
          }}
          onClose={() => setShowNewLocation(false)}
        />
      )}
      {showWebcam && (
        <WebcamCapture
          onCapture={handleWebcamCapture}
          onCancel={() => setShowWebcam(false)}
        />
      )}
    </div>
  );
}
