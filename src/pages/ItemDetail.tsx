import { useState, useEffect, useRef } from 'preact/hooks';
import { route } from 'preact-router';
import { getItem, deleteItem, updateItem, getCategories, getLocationsWithPath } from '../lib/api';
import { getPhotoUrl } from '../lib/supabase';
import { useT, formatDate } from '../lib/i18n';
import { QuickCreateCategory, QuickCreateLocation } from '../components/QuickCreate';
import type { ItemWithDetails, Category, Location } from '../types/database';

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
      <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
    </svg>
  );
}

interface Props {
  id?: string;
  activeHouseholdId?: string;
}

export function ItemDetail({ id, activeHouseholdId }: Props) {
  const t = useT();
  const [item, setItem] = useState<ItemWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Array<Location & { full_path: string }>>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [showNewLocation, setShowNewLocation] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) {
      setError(t('itemDetail.notFound'));
      setLoading(false);
      return;
    }

    async function loadItem() {
      try {
        setLoading(true);
        const data = await getItem(id!);
        if (!data) {
          setError(t('itemDetail.notFound'));
        } else {
          setItem(data);
        }
      } catch (err) {
        setError(t('itemDetail.failedLoad'));
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadItem();
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    if (!item) {
      setPhotoUrl(null);
      return;
    }
    getPhotoUrl(item.photo_path).then((url) => {
      if (!cancelled) setPhotoUrl(url);
    });
    return () => { cancelled = true; };
  }, [item?.photo_path]);

  async function enterEditMode() {
    if (!item || !activeHouseholdId) return;

    setName(item.name);
    setDescription(item.description || '');
    setCategoryId(item.category_id || '');
    setLocationId(item.location_id || '');
    setPhoto(null);
    setPhotoPreview(null);
    setError(null);
    setEditing(true);

    try {
      setOptionsLoading(true);
      const [cats, locs] = await Promise.all([
        getCategories(activeHouseholdId),
        getLocationsWithPath(activeHouseholdId),
      ]);
      setCategories(cats);
      setLocations(locs);
    } catch (err) {
      console.error('Failed to load options:', err);
    } finally {
      setOptionsLoading(false);
    }
  }

  function cancelEdit() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(null);
    setPhotoPreview(null);
    setError(null);
    setEditing(false);
  }

  function handlePhotoChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  }

  function removeNewPhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
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

      await updateItem(
        item.id,
        activeHouseholdId,
        {
          name: name.trim(),
          description: description.trim() || undefined,
          category_id: categoryId || undefined,
          location_id: locationId || undefined,
          photo: photo || undefined,
        },
        item.photo_path,
      );

      const refreshed = await getItem(item.id);
      if (refreshed) setItem(refreshed);

      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhoto(null);
      setPhotoPreview(null);
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
      await deleteItem(item.id, item.photo_path);
      route('/');
    } catch (err) {
      setError(t('itemDetail.failedDelete'));
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  const displayPhoto = photoPreview || photoUrl;

  return (
    <div class="min-h-screen">
      {/* Header */}
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
              aria-label="Edit"
            >
              <PencilIcon />
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              class="p-1 -mr-1 text-red-400 hover:text-red-300"
              aria-label="Delete"
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
          {/* Photo */}
          {photoUrl ? (
            <div class="aspect-square bg-slate-800">
              <img
                src={photoUrl}
                alt={item.name}
                class="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div class="aspect-square bg-slate-800 flex items-center justify-center">
              <span class="text-8xl">{item.category_icon || '📦'}</span>
            </div>
          )}

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
          {/* Photo */}
          <div>
            <label class="input-label">{t('addItem.photo')}</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoChange}
              class="hidden"
            />

            {displayPhoto ? (
              <div class="relative">
                <img
                  src={displayPhoto}
                  alt="Preview"
                  class="w-full h-48 object-cover rounded-xl"
                />
                <div class="absolute top-2 right-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    class="p-2 bg-slate-900/80 rounded-full text-slate-300 hover:text-white"
                    aria-label="Replace photo"
                  >
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                    </svg>
                  </button>
                  {photoPreview && (
                    <button
                      type="button"
                      onClick={removeNewPhoto}
                      class="p-2 bg-slate-900/80 rounded-full text-slate-300 hover:text-white"
                      aria-label="Discard new photo"
                    >
                      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                class="w-full h-48 border-2 border-dashed border-slate-600 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-slate-500 hover:bg-slate-800/50 transition-colors"
              >
                <CameraIcon />
                <span class="text-slate-400">{t('addItem.tapToTakePhoto')}</span>
              </button>
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
              class="input"
              required
            />
          </div>

          {/* Location */}
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

          {/* Category */}
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

          {/* Description */}
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

      {/* Delete confirmation modal */}
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
