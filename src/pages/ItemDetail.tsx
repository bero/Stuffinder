import { useState, useEffect, useRef } from 'preact/hooks';
import { route } from 'preact-router';
import {
  getItem,
  deleteItem,
  updateItem,
  getCategories,
  getLocationsWithPath,
  getItemPhotos,
  addItemPhoto,
  deleteItemPhoto,
  getTags,
  setItemTags,
} from '../lib/api';
import { prefetchPhotoUrls } from '../lib/supabase';
import { useT, formatDate } from '../lib/i18n';
import { QuickCreateCategory, QuickCreateLocation } from '../components/QuickCreate';
import { TagPicker } from '../components/TagPicker';
import { WebcamCapture } from '../components/WebcamCapture';
import type { ItemWithDetails, ItemPhoto, Category, Location, Tag, TagRef } from '../types/database';

const hasWebcam = typeof navigator !== 'undefined'
  && typeof navigator.mediaDevices !== 'undefined'
  && typeof navigator.mediaDevices.getUserMedia === 'function';

function BackIcon() {
  return (
    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg class="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
      <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
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

function ChevronIcon({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d={dir === 'left' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'}
      />
    </svg>
  );
}

interface Props {
  id?: string;
  activeHouseholdId?: string;
}

interface StagedPhoto {
  id: string; // either existing photo id OR a local temp id for newly added
  kind: 'existing' | 'new';
  url: string; // signed URL (existing) OR object URL (new)
  path?: string; // existing only
  file?: File; // new only
}

export function ItemDetail({ id, activeHouseholdId }: Props) {
  const t = useT();
  const [item, setItem] = useState<ItemWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // View-mode photos + carousel state.
  const [photos, setPhotos] = useState<ItemPhoto[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map());
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Edit-mode state.
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [stagedPhotos, setStagedPhotos] = useState<StagedPhoto[]>([]);
  const [pendingDeletes, setPendingDeletes] = useState<Array<{ id: string; path: string }>>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Array<Location & { full_path: string }>>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [showNewLocation, setShowNewLocation] = useState(false);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<TagRef[]>([]);
  const [showWebcam, setShowWebcam] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);

  function scrollToIndex(i: number) {
    const el = galleryRef.current;
    if (!el) return;
    const target = Math.max(0, Math.min(i, photos.length - 1));
    // Optimistic update so chevron-disabled state and dots flip immediately.
    setCarouselIndex(target);
    el.scrollTo({ left: target * el.clientWidth, behavior: 'smooth' });
  }

  function handleGalleryScroll() {
    const el = galleryRef.current;
    if (!el || el.clientWidth === 0) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== carouselIndex) setCarouselIndex(i);
  }

  // Keyboard arrow keys navigate when in view mode on desktop.
  useEffect(() => {
    if (editing) return;
    if (photos.length < 2) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') scrollToIndex(carouselIndex - 1);
      else if (e.key === 'ArrowRight') scrollToIndex(carouselIndex + 1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // scrollToIndex is recreated each render but only reads stable refs/state
    // setters; including it would re-bind the keydown listener on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, photos.length, carouselIndex]);

  useEffect(() => {
    if (!id) {
      setError(t('itemDetail.notFound'));
      setLoading(false);
      return;
    }

    async function loadItem() {
      try {
        setLoading(true);
        const [data, itemPhotos] = await Promise.all([getItem(id!), getItemPhotos(id!)]);
        if (!data) {
          setError(t('itemDetail.notFound'));
          return;
        }
        setItem(data);
        setPhotos(itemPhotos);
        setCarouselIndex(0);
        const urls = await prefetchPhotoUrls(itemPhotos.map((p) => p.path));
        setPhotoUrls(urls);
      } catch (err) {
        setError(t('itemDetail.failedLoad'));
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadItem();
    // We deliberately don't reload when locale (`t`) changes — the loaded data
    // would be identical, only the error string would differ.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function enterEditMode() {
    if (!item || !activeHouseholdId) return;

    setName(item.name);
    setDescription(item.description || '');
    setCategoryId(item.category_id || '');
    setLocationId(item.location_id || '');

    const staged: StagedPhoto[] = photos.map((p) => ({
      id: p.id,
      kind: 'existing',
      url: photoUrls.get(p.path) || '',
      path: p.path,
    }));
    setStagedPhotos(staged);
    setPendingDeletes([]);
    setError(null);
    setEditing(true);

    setSelectedTags(item.tags ? [...item.tags] : []);

    try {
      setOptionsLoading(true);
      const [cats, locs, tagList] = await Promise.all([
        getCategories(activeHouseholdId),
        getLocationsWithPath(activeHouseholdId),
        getTags(activeHouseholdId),
      ]);
      setCategories(cats);
      setLocations(locs);
      setAllTags(tagList);
    } catch (err) {
      console.error('Failed to load options:', err);
    } finally {
      setOptionsLoading(false);
    }
  }

  function cancelEdit() {
    // Revoke object URLs for any unsaved new photos.
    stagedPhotos.forEach((sp) => {
      if (sp.kind === 'new') URL.revokeObjectURL(sp.url);
    });
    setStagedPhotos([]);
    setPendingDeletes([]);
    setError(null);
    setEditing(false);
  }

  function handlePhotoChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    if (files.length === 0) return;
    const added: StagedPhoto[] = files.map((file, i) => ({
      id: `new-${Date.now()}-${i}`,
      kind: 'new',
      url: URL.createObjectURL(file),
      file,
    }));
    setStagedPhotos((prev) => [...prev, ...added]);
    input.value = '';
  }

  function handleWebcamCapture(file: File) {
    const entry: StagedPhoto = {
      id: `new-${Date.now()}-webcam`,
      kind: 'new',
      url: URL.createObjectURL(file),
      file,
    };
    setStagedPhotos((prev) => [...prev, entry]);
    setShowWebcam(false);
  }

  function removeStaged(sp: StagedPhoto) {
    if (sp.kind === 'new') {
      URL.revokeObjectURL(sp.url);
    } else {
      setPendingDeletes((prev) => [...prev, { id: sp.id, path: sp.path! }]);
    }
    setStagedPhotos((prev) => prev.filter((x) => x.id !== sp.id));
  }

  async function handleSave(e: Event) {
    e.preventDefault();
    if (!item || !activeHouseholdId) return;
    if (!name.trim()) {
      setError(t('addItem.pleaseEnterName'));
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // 1. Update the item's plain fields.
      await updateItem(item.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        category_id: categoryId || undefined,
        location_id: locationId || undefined,
      });

      // 2. Delete the photos the user removed.
      for (const del of pendingDeletes) {
        try {
          await deleteItemPhoto(del.id, del.path);
        } catch (err) {
          console.warn('Failed to delete photo', err);
        }
      }

      // 3. Upload any newly added photos, appending at the end of the order.
      const existingKept = stagedPhotos.filter((p) => p.kind === 'existing');
      let sortIndex = existingKept.length;
      for (const sp of stagedPhotos) {
        if (sp.kind !== 'new' || !sp.file) continue;
        await addItemPhoto(item.id, activeHouseholdId, sp.file, sortIndex++);
      }

      // 3b. Commit tag selection.
      await setItemTags(item.id, selectedTags.map((t) => t.id));

      // 4. Refresh state from server (fresh signed URLs for new photos).
      const [refreshed, freshPhotos] = await Promise.all([
        getItem(item.id),
        getItemPhotos(item.id),
      ]);
      if (refreshed) setItem(refreshed);
      setPhotos(freshPhotos);
      setCarouselIndex(0);
      const urls = await prefetchPhotoUrls(freshPhotos.map((p) => p.path));
      setPhotoUrls(urls);

      // Clean up any remaining object URLs.
      stagedPhotos.forEach((sp) => {
        if (sp.kind === 'new') URL.revokeObjectURL(sp.url);
      });
      setStagedPhotos([]);
      setPendingDeletes([]);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('itemDetail.failedSave'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!item) return;
    try {
      setDeleting(true);
      await deleteItem(item.id);
      route('/');
    } catch (err) {
      setError(t('itemDetail.failedDelete'));
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  return (
    <div class="min-h-screen">
      <header class="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center justify-between safe-top z-10">
        <button
          onClick={() => (editing ? cancelEdit() : route('/'))}
          class="p-1 -ml-1 text-slate-400 hover:text-slate-200"
        >
          <BackIcon />
        </button>
        <h1 class="text-lg font-semibold">{editing ? t('itemDetail.edit') : t('itemDetail.title')}</h1>
        {!editing && item ? (
          <div class="flex items-center gap-1">
            <button
              onClick={enterEditMode}
              class="p-1 text-slate-300 hover:text-slate-100"
              aria-label={t('common.edit')}
            >
              <PencilIcon />
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              class="p-1 -mr-1 text-red-400 hover:text-red-300"
              aria-label={t('common.delete')}
            >
              <TrashIcon />
            </button>
          </div>
        ) : (
          <span class="w-6" />
        )}
      </header>

      {loading ? (
        <div class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
        </div>
      ) : error && !editing ? (
        <div class="p-4">
          <div class="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
            {error}
          </div>
        </div>
      ) : item && !editing ? (
        <div>
          {/* Gallery: horizontal scroll-snap, swipable on touch, chevrons on desktop */}
          <div class="relative bg-slate-800">
            <div
              ref={galleryRef}
              onScroll={handleGalleryScroll}
              class="flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as Record<string, string>}
            >
              {photos.length === 0 ? (
                <div class="flex-shrink-0 w-full aspect-square flex items-center justify-center snap-center">
                  <span class="text-8xl">{item.category_icon || '📦'}</span>
                </div>
              ) : (
                photos.map((p) => {
                  const url = photoUrls.get(p.path);
                  return (
                    <div key={p.id} class="flex-shrink-0 w-full aspect-square snap-center">
                      {url ? (
                        <img src={url} alt="" class="w-full h-full object-contain" />
                      ) : (
                        <div class="w-full h-full flex items-center justify-center">
                          <span class="text-8xl">{item.category_icon || '📦'}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {photos.length > 1 && (
              <>
                <button
                  onClick={() => scrollToIndex(carouselIndex - 1)}
                  class="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-slate-900/70 hover:bg-slate-900 rounded-full text-slate-200 z-10 disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Previous"
                  disabled={carouselIndex === 0}
                >
                  <ChevronIcon dir="left" />
                </button>
                <button
                  onClick={() => scrollToIndex(carouselIndex + 1)}
                  class="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-slate-900/70 hover:bg-slate-900 rounded-full text-slate-200 z-10 disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Next"
                  disabled={carouselIndex === photos.length - 1}
                >
                  <ChevronIcon dir="right" />
                </button>
                <div class="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 bg-slate-900/60 rounded-full px-2 py-1">
                  {photos.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => scrollToIndex(i)}
                      class={`w-2 h-2 rounded-full transition-colors ${
                        i === carouselIndex ? 'bg-white' : 'bg-white/40'
                      }`}
                      aria-label={`Photo ${i + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Details */}
          <div class="p-4 space-y-4">
            <h2 class="text-2xl font-bold text-slate-100">{item.name}</h2>

            {item.location_full_path && (
              <div class="flex items-start gap-3">
                <span class="text-2xl">📍</span>
                <div>
                  <p class="text-sm text-slate-400">{t('itemDetail.location')}</p>
                  <p class="text-slate-100">{item.location_full_path}</p>
                </div>
              </div>
            )}

            {item.category_name && (
              <div class="flex items-start gap-3">
                <span class="text-2xl">{item.category_icon || '🏷️'}</span>
                <div>
                  <p class="text-sm text-slate-400">{t('itemDetail.category')}</p>
                  <p class="text-slate-100">{item.category_name}</p>
                </div>
              </div>
            )}

            {item.description && (
              <div class="flex items-start gap-3">
                <span class="text-2xl">📝</span>
                <div>
                  <p class="text-sm text-slate-400">{t('itemDetail.description')}</p>
                  <p class="text-slate-100 whitespace-pre-wrap">{item.description}</p>
                </div>
              </div>
            )}

            {item.tags && item.tags.length > 0 && (
              <div class="flex items-start gap-3">
                <span class="text-2xl">🏷️</span>
                <div class="flex-1">
                  <p class="text-sm text-slate-400">{t('addItem.tags')}</p>
                  <div class="flex flex-wrap gap-2 mt-1">
                    {item.tags.map((tag) => (
                      <span
                        key={tag.id}
                        class="bg-primary-900/50 border border-primary-700 text-primary-200 rounded-full px-2.5 py-0.5 text-sm"
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div class="pt-4 border-t border-slate-700 text-sm text-slate-500">
              <p>{t('itemDetail.added', { date: formatDate(item.created_at) })}</p>
              {item.updated_at !== item.created_at && (
                <p>{t('itemDetail.updated', { date: formatDate(item.updated_at) })}</p>
              )}
            </div>
          </div>
        </div>
      ) : item && editing ? (
        <form onSubmit={handleSave} class="p-4 space-y-6">
          <div>
            <label class="input-label">{t('addItem.photo')}</label>
            <input
              ref={fileInputRef}
              type="file"
              name="photo"
              accept="image/*"
              multiple
              onChange={handlePhotoChange}
              class="hidden"
            />

            {stagedPhotos.length === 0 ? (
              <div class="space-y-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
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
                {stagedPhotos.map((sp) => (
                  <div key={sp.id} class="relative aspect-square">
                    <img src={sp.url} alt="" class="w-full h-full object-cover rounded-lg" />
                    <button
                      type="button"
                      onClick={() => removeStaged(sp)}
                      class="absolute top-1 right-1 p-1 bg-slate-900/80 rounded-full text-slate-200 hover:text-white"
                      aria-label={t('common.delete')}
                    >
                      <XIcon />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
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

          <div>
            <label class="input-label" for="name">{t('addItem.name')}</label>
            <input
              id="name"
              type="text"
              value={name}
              onInput={(e) => setName((e.target as HTMLInputElement).value)}
              class="input"
              required
            />
          </div>

          <div>
            <label class="input-label flex items-center gap-2" for="location">
              {t('addItem.location')}
              {optionsLoading && (
                <span class="animate-spin rounded-full h-3 w-3 border-2 border-slate-400 border-t-transparent"></span>
              )}
            </label>
            <div class="flex gap-2">
              <select
                id="location"
                value={locationId}
                onChange={(e) => setLocationId((e.target as HTMLSelectElement).value)}
                class="select flex-1"
                disabled={optionsLoading}
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
                disabled={optionsLoading}
                aria-label={t('settings.addLocation')}
                title={t('settings.addLocation')}
              >
                +
              </button>
            </div>
          </div>

          <div>
            <label class="input-label flex items-center gap-2" for="category">
              {t('addItem.category')}
              {optionsLoading && (
                <span class="animate-spin rounded-full h-3 w-3 border-2 border-slate-400 border-t-transparent"></span>
              )}
            </label>
            <div class="flex gap-2">
              <select
                id="category"
                value={categoryId}
                onChange={(e) => setCategoryId((e.target as HTMLSelectElement).value)}
                class="select flex-1"
                disabled={optionsLoading}
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
                disabled={optionsLoading}
                aria-label={t('settings.addCategory')}
                title={t('settings.addCategory')}
              >
                +
              </button>
            </div>
          </div>

          <div>
            <label class="input-label" for="description">{t('addItem.descriptionOptional')}</label>
            <textarea
              id="description"
              value={description}
              onInput={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
              rows={3}
              class="input resize-none"
            />
          </div>

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

          {error && (
            <div class="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div class="flex gap-3">
            <button
              type="button"
              onClick={cancelEdit}
              class="btn-secondary flex-1 py-4"
              disabled={saving}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              class="btn-primary flex-1 py-4"
            >
              {saving ? (
                <span class="flex items-center justify-center gap-2">
                  <span class="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></span>
                  {t('common.saving')}
                </span>
              ) : (
                t('common.save')
              )}
            </button>
          </div>
        </form>
      ) : null}

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

      {showDeleteConfirm && (
        <div class="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div class="bg-slate-800 rounded-xl p-6 max-w-sm w-full">
            <h3 class="text-lg font-semibold text-slate-100 mb-2">{t('itemDetail.deleteConfirmTitle')}</h3>
            <p class="text-slate-400 mb-6">
              {t('itemDetail.deleteConfirmBody', { name: item?.name || '' })}
            </p>
            <div class="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                class="btn-secondary flex-1"
                disabled={deleting}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDelete}
                class="btn-danger flex-1"
                disabled={deleting}
              >
                {deleting ? t('common.deleting') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
