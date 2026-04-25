import { useState, useEffect, useRef } from 'preact/hooks';
import {
  getCategories,
  getLocationsWithPath,
  createCategory,
  createLocation,
  updateCategory,
  updateLocation,
  deleteCategory,
  deleteLocation,
  getItemsByCategory,
  getItemsByLocation,
  reassignItemsCategory,
  reassignItemsLocation,
  getTags,
  createTag,
  updateTag,
  deleteTag,
  countItemsWithTag,
  createInvite,
  getInvites,
  revokeInvite,
  leaveHousehold,
  getAllItems,
} from '../lib/api';
import { rowsToCsv, downloadFile } from '../lib/csv';
import { exportHouseholdZip, type ExportProgress } from '../lib/export';
import { importHouseholdZip, type ImportMode, type ImportProgress, type ImportResult } from '../lib/import';
import { signOut } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { useT, t as tRaw, formatDate } from '../lib/i18n';
import { LanguagePicker } from '../components/LanguagePicker';
import { EmojiPicker } from '../components/EmojiPicker';
import type { Category, Location, HouseholdMembership, HouseholdInvite, ItemWithDetails, Tag } from '../types/database';

function PlusIcon() {
  return (
    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

type Tab = 'household' | 'categories' | 'locations' | 'tags' | 'about';

const APP_VERSION = '1.0.0';

interface Props {
  activeHouseholdId?: string;
  memberships?: HouseholdMembership[];
  onSelectHousehold?: (id: string) => void;
  onHouseholdChange?: () => void;
}

export function Settings({ activeHouseholdId, memberships = [], onSelectHousehold, onHouseholdChange }: Props) {
  const t = useT();
  const [activeTab, setActiveTab] = useState<Tab>('household');
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Array<Location & { full_path: string }>>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTagName, setNewTagName] = useState('');
  const [addingTag, setAddingTag] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState('');

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('');
  const [newParentId, setNewParentId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editParentId, setEditParentId] = useState('');

  const [invites, setInvites] = useState<HouseholdInvite[]>([]);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState<ExportProgress | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
  }, []);

  // Delete-with-reassign modal state.
  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: 'category'; id: string; name: string; affected: ItemWithDetails[] }
    | { kind: 'location'; id: string; name: string; affected: ItemWithDetails[] }
    | null
  >(null);
  const [reassignTo, setReassignTo] = useState<string>('');
  const [deleteBusy, setDeleteBusy] = useState(false);

  const active = memberships.find(m => m.household_id === activeHouseholdId);
  const isOwner = active?.role === 'owner';

  useEffect(() => {
    if (!activeHouseholdId) return;
    loadData();
    loadInvites();
  }, [activeHouseholdId]);

  async function loadData() {
    if (!activeHouseholdId) return;
    try {
      setLoading(true);
      const [cats, locs, t] = await Promise.all([
        getCategories(activeHouseholdId),
        getLocationsWithPath(activeHouseholdId),
        getTags(activeHouseholdId),
      ]);
      setCategories(cats);
      setLocations(locs);
      setTags(t);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadInvites() {
    if (!activeHouseholdId) return;
    try {
      const data = await getInvites(activeHouseholdId);
      setInvites(data);
    } catch (err) {
      console.error('Failed to load invites:', err);
    }
  }

  function resetForm() {
    setNewName('');
    setNewIcon('');
    setNewParentId('');
    setShowAddForm(false);
    setError(null);
    setEditingId(null);
  }

  function startEditCategory(cat: Category) {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditIcon(cat.icon || '');
    setShowAddForm(false);
    setError(null);
  }

  function startEditLocation(loc: Location) {
    setEditingId(loc.id);
    setEditName(loc.name);
    setEditIcon(loc.icon || '');
    setEditParentId(loc.parent_id || '');
    setShowAddForm(false);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setError(null);
  }

  async function handleUpdateCategory(e: Event) {
    e.preventDefault();
    if (!editingId || !editName.trim()) return;
    try {
      setSaving(true);
      setError(null);
      await updateCategory(editingId, { name: editName.trim(), icon: editIcon || undefined });
      await loadData();
      setEditingId(null);
    } catch {
      setError(t('settings.failedUpdateCategory'));
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateLocation(e: Event) {
    e.preventDefault();
    if (!editingId || !editName.trim()) return;
    if (editParentId === editingId) {
      setError(t('settings.selfParent'));
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await updateLocation(editingId, {
        name: editName.trim(),
        icon: editIcon || undefined,
        parent_id: editParentId || undefined,
      });
      await loadData();
      setEditingId(null);
    } catch {
      setError(t('settings.failedUpdateLocation'));
    } finally {
      setSaving(false);
    }
  }

  async function handleAddCategory(e: Event) {
    e.preventDefault();
    if (!activeHouseholdId || !newName.trim()) return;
    try {
      setSaving(true);
      setError(null);
      await createCategory(activeHouseholdId, { name: newName.trim(), icon: newIcon || undefined });
      await loadData();
      resetForm();
    } catch (err) {
      setError(t('settings.failedAddCategory'));
    } finally {
      setSaving(false);
    }
  }

  async function handleAddLocation(e: Event) {
    e.preventDefault();
    if (!activeHouseholdId || !newName.trim()) return;
    try {
      setSaving(true);
      setError(null);
      await createLocation(activeHouseholdId, {
        name: newName.trim(),
        icon: newIcon || undefined,
        parent_id: newParentId || undefined,
      });
      await loadData();
      resetForm();
    } catch (err) {
      setError(t('settings.failedAddLocation'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCategory(cat: Category) {
    if (!activeHouseholdId) return;
    try {
      const affected = await getItemsByCategory(activeHouseholdId, cat.id);
      if (affected.length === 0) {
        if (!confirm(tRaw('settings.deleteCategoryConfirm'))) return;
        await deleteCategory(cat.id);
        await loadData();
        return;
      }
      setReassignTo('');
      setDeleteTarget({ kind: 'category', id: cat.id, name: cat.name, affected });
    } catch {
      alert(tRaw('settings.failedDeleteCategory'));
    }
  }

  async function handleDeleteLocation(loc: Location & { full_path: string }) {
    if (!activeHouseholdId) return;
    try {
      const affected = await getItemsByLocation(activeHouseholdId, loc.id);
      if (affected.length === 0) {
        if (!confirm(tRaw('settings.deleteLocationConfirm'))) return;
        await deleteLocation(loc.id);
        await loadData();
        return;
      }
      setReassignTo('');
      setDeleteTarget({ kind: 'location', id: loc.id, name: loc.full_path, affected });
    } catch {
      alert(tRaw('settings.failedDeleteLocation'));
    }
  }

  async function handleAddTag(e: Event) {
    e.preventDefault();
    if (!activeHouseholdId || !newTagName.trim()) return;
    try {
      setAddingTag(true);
      setTagError(null);
      const created = await createTag(activeHouseholdId, newTagName);
      setTags((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewTagName('');
    } catch (err) {
      setTagError(err instanceof Error ? err.message : t('settings.failedAddTag'));
    } finally {
      setAddingTag(false);
    }
  }

  function startEditTag(tag: Tag) {
    setEditingTagId(tag.id);
    setEditingTagName(tag.name);
    setTagError(null);
  }

  function cancelEditTag() {
    setEditingTagId(null);
    setEditingTagName('');
    setTagError(null);
  }

  async function handleUpdateTag(e: Event) {
    e.preventDefault();
    if (!editingTagId || !editingTagName.trim()) return;
    try {
      setAddingTag(true);
      setTagError(null);
      const updated = await updateTag(editingTagId, editingTagName);
      setTags((prev) =>
        prev
          .map((tag) => (tag.id === updated.id ? updated : tag))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      cancelEditTag();
    } catch (err) {
      setTagError(err instanceof Error ? err.message : t('settings.failedUpdateTag'));
    } finally {
      setAddingTag(false);
    }
  }

  async function handleDeleteTag(tag: Tag) {
    try {
      const count = await countItemsWithTag(tag.id);
      const title = tRaw('settings.deleteTagTitle', { name: tag.name });
      const body =
        count > 0 ? '\n\n' + tRaw('settings.deleteTagAffected', { count }) : '';
      if (!confirm(title + body)) return;
      await deleteTag(tag.id);
      setTags((prev) => prev.filter((x) => x.id !== tag.id));
    } catch {
      alert(tRaw('settings.failedDeleteTag'));
    }
  }

  async function confirmDeleteWithReassign() {
    if (!deleteTarget || !activeHouseholdId) return;
    try {
      setDeleteBusy(true);
      if (deleteTarget.kind === 'category') {
        if (reassignTo) {
          await reassignItemsCategory(activeHouseholdId, deleteTarget.id, reassignTo);
        }
        await deleteCategory(deleteTarget.id);
      } else {
        if (reassignTo) {
          await reassignItemsLocation(activeHouseholdId, deleteTarget.id, reassignTo);
        }
        await deleteLocation(deleteTarget.id);
      }
      setDeleteTarget(null);
      await loadData();
    } catch {
      alert(
        tRaw(
          deleteTarget.kind === 'category'
            ? 'settings.failedDeleteCategory'
            : 'settings.failedDeleteLocation',
        ),
      );
    } finally {
      setDeleteBusy(false);
    }
  }

  async function handleCreateInvite() {
    if (!activeHouseholdId) return;
    try {
      setCreatingInvite(true);
      await createInvite(activeHouseholdId);
      await loadInvites();
    } catch (err) {
      alert(err instanceof Error ? err.message : tRaw('settings.failedCreateInvite'));
    } finally {
      setCreatingInvite(false);
    }
  }

  async function handleRevokeInvite(code: string) {
    if (!confirm(tRaw('settings.revokeConfirm', { code }))) return;
    try {
      await revokeInvite(code);
      await loadInvites();
    } catch {
      alert(tRaw('settings.failedRevoke'));
    }
  }

  async function handleCopyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      alert(tRaw('settings.copiedCode', { code }));
    } catch {
      prompt(tRaw('settings.copyPrompt'), code);
    }
  }

  async function handleLeave() {
    if (!activeHouseholdId) return;
    if (!confirm(tRaw('settings.leaveConfirm'))) return;
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      await leaveHousehold(activeHouseholdId, userData.user.id);
      onHouseholdChange?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : tRaw('settings.leave'));
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  }

  function triggerImportPicker() {
    importInputRef.current?.click();
  }

  function handleImportFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // allow re-picking same file later
    if (!file || !activeHouseholdId) return;
    setPendingImportFile(file);
  }

  async function runImport(mode: ImportMode) {
    const file = pendingImportFile;
    setPendingImportFile(null);
    if (!file || !activeHouseholdId) return;

    const confirmKey = mode === 'replace' ? 'settings.importConfirmReplace' : 'settings.importConfirmMerge';
    if (!confirm(tRaw(confirmKey, { household: active?.household?.name || '' }))) return;

    try {
      setImporting(true);
      setImportProgress({ phase: 'reading', current: 0, total: 1 });
      const result: ImportResult = await importHouseholdZip(
        activeHouseholdId,
        file,
        mode,
        (p) => setImportProgress(p),
      );
      alert(
        tRaw('settings.importDone', {
          items: result.items,
          categories: result.categories,
          locations: result.locations,
          photos: result.photos,
        }),
      );
      await loadData();
      await loadInvites();
    } catch (err) {
      alert(err instanceof Error ? err.message : tRaw('settings.importFailed'));
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  }

  function importButtonLabel(): string {
    if (!importing || !importProgress) return t('settings.importZip');
    const { phase, current, total } = importProgress;
    switch (phase) {
      case 'reading':     return t('settings.importingReading');
      case 'clearing':    return t('settings.importingClearing');
      case 'categories':  return t('settings.importingCategories', { current, total });
      case 'locations':   return t('settings.importingLocations',  { current, total });
      case 'photos':      return t('settings.importingPhotos',     { current, total });
      case 'items':       return t('settings.importingItems',      { current, total });
      default:            return t('settings.importZip');
    }
  }

  async function handleExportZip() {
    if (!activeHouseholdId) return;
    try {
      setExportingZip(true);
      setZipProgress({ phase: 'loading', current: 0, total: 1 });
      await exportHouseholdZip(
        activeHouseholdId,
        active?.household?.name || 'household',
        (p) => setZipProgress(p),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : tRaw('settings.exportFailed'));
    } finally {
      setExportingZip(false);
      setZipProgress(null);
    }
  }

  function zipButtonLabel(): string {
    if (!exportingZip || !zipProgress) return t('settings.exportZip');
    if (zipProgress.phase === 'photos') {
      return t('settings.exportingPhotos', {
        current: zipProgress.current,
        total: zipProgress.total,
      });
    }
    if (zipProgress.phase === 'zipping') return t('settings.exportingZipping');
    return t('settings.exporting');
  }

  async function handleExportCsv() {
    if (!activeHouseholdId) return;
    try {
      setExporting(true);
      const items = await getAllItems(activeHouseholdId);
      const csv = rowsToCsv(
        ['Name', 'Description', 'Category', 'Location', 'Added', 'Updated', 'PhotoPath'],
        items.map((i) => [
          i.name,
          i.description || '',
          i.category_name || '',
          i.location_full_path || '',
          new Date(i.created_at).toISOString(),
          new Date(i.updated_at).toISOString(),
          i.photo_path || '',
        ]),
      );
      const stamp = new Date().toISOString().slice(0, 10);
      const slug = (active?.household?.name || 'household').replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
      downloadFile(`stuffinder-${slug}-${stamp}.csv`, csv);
    } catch (err) {
      alert(err instanceof Error ? err.message : tRaw('settings.exportFailed'));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div class="px-4 pt-6">
      <LanguagePicker />
      <header class="mb-6">
        <h1 class="text-2xl font-bold text-slate-100">{t('settings.title')}</h1>
        <p class="text-slate-400">{active?.household?.name || t('settings.title')}</p>
      </header>

      <div class="flex border-b border-slate-700 mb-4 overflow-x-auto">
        {(['household', 'categories', 'locations', 'tags', 'about'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); resetForm(); cancelEditTag(); }}
            class={`px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab
                ? 'text-primary-400 border-primary-400'
                : 'text-slate-400 border-transparent hover:text-slate-300'
            }`}
          >
            {tab === 'about' ? t('about.tab') : t(`settings.tabs.${tab}`)}
          </button>
        ))}
      </div>

      {activeTab === 'household' && (
        <div class="space-y-6">
          {/* Household switcher */}
          {memberships.length > 1 && (
            <div>
              <h2 class="text-sm font-semibold text-slate-300 mb-2">{t('settings.yourHouseholds')}</h2>
              <div class="space-y-2">
                {memberships.map((m) => (
                  <button
                    key={m.household_id}
                    onClick={() => onSelectHousehold?.(m.household_id)}
                    class={`card w-full text-left flex items-center justify-between ${
                      m.household_id === activeHouseholdId ? 'ring-2 ring-primary-500' : ''
                    }`}
                  >
                    <div>
                      <p class="font-medium text-slate-100">{m.household?.name}</p>
                      <p class="text-xs text-slate-400">{t(`settings.${m.role}`)}</p>
                    </div>
                    {m.household_id === activeHouseholdId && (
                      <span class="text-primary-400 text-sm">{t('settings.active')}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Invites */}
          <div>
            <div class="flex items-center justify-between mb-2">
              <h2 class="text-sm font-semibold text-slate-300">{t('settings.inviteCodes')}</h2>
              <button
                onClick={handleCreateInvite}
                disabled={creatingInvite}
                class="btn-primary px-3 py-1.5 text-sm"
              >
                {creatingInvite ? t('settings.creatingInvite') : t('settings.newInvite')}
              </button>
            </div>
            <p class="text-sm text-slate-300 mb-3">
              {t('settings.inviteHint')}
            </p>
            {invites.length === 0 ? (
              <p class="text-sm text-slate-300">{t('settings.noInvites')}</p>
            ) : (
              <div class="space-y-2">
                {invites.map((inv) => (
                  <div key={inv.code} class="card flex items-center justify-between">
                    <button
                      onClick={() => handleCopyCode(inv.code)}
                      class="font-mono text-lg tracking-widest text-slate-100 hover:text-primary-300"
                    >
                      {inv.code}
                    </button>
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-slate-500">
                        {t('settings.expires', { date: formatDate(inv.expires_at) })}
                      </span>
                      <button
                        onClick={() => handleRevokeInvite(inv.code)}
                        class="p-2 text-slate-500 hover:text-red-400"
                        aria-label={t('common.delete')}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Account actions */}
          <div class="pt-4 border-t border-slate-800 space-y-4">
            <div class="space-y-1">
              <button
                onClick={handleExportCsv}
                class="btn-secondary w-full"
                disabled={exporting || exportingZip}
              >
                {exporting ? t('settings.exporting') : t('settings.exportCsv')}
              </button>
              <p class="text-sm text-slate-300 px-1">{t('settings.exportCsvHint')}</p>
            </div>
            <div class="space-y-1">
              <button
                onClick={handleExportZip}
                class="btn-secondary w-full"
                disabled={exporting || exportingZip || importing}
              >
                {zipButtonLabel()}
              </button>
              <p class="text-sm text-slate-300 px-1">{t('settings.exportZipHint')}</p>
            </div>
            <div class="space-y-1">
              <input
                ref={importInputRef}
                type="file"
                accept="application/zip,.zip"
                onChange={handleImportFile}
                class="hidden"
              />
              <button
                onClick={triggerImportPicker}
                class="btn-secondary w-full"
                disabled={exporting || exportingZip || importing}
              >
                {importButtonLabel()}
              </button>
              <p class="text-sm text-slate-300 px-1">{t('settings.importHint')}</p>
            </div>
            {!isOwner && (
              <button onClick={handleLeave} class="btn-secondary w-full">
                {t('settings.leave')}
              </button>
            )}
            <button onClick={handleSignOut} class="btn-secondary w-full">
              {t('settings.signOut')}
            </button>
            {userEmail && (
              <p class="text-base text-slate-200 font-medium text-center break-all">{userEmail}</p>
            )}
          </div>
        </div>
      )}

      {loading && (activeTab === 'categories' || activeTab === 'locations' || activeTab === 'tags') ? (
        <div class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
        </div>
      ) : activeTab === 'categories' ? (
        <div class="space-y-3">
          {categories.map((cat) =>
            editingId === cat.id ? (
              <form key={cat.id} onSubmit={handleUpdateCategory} class="card space-y-3">
                <div class="flex gap-3">
                  <EmojiPicker value={editIcon} onChange={setEditIcon} placeholder="📦" />
                  <input
                    type="text"
                    value={editName}
                    onInput={(e) => setEditName((e.target as HTMLInputElement).value)}
                    class="input flex-1"
                    required
                  />
                </div>
                {error && <p class="text-red-400 text-sm">{error}</p>}
                <div class="flex gap-2">
                  <button type="button" onClick={cancelEdit} class="btn-secondary flex-1">{t('common.cancel')}</button>
                  <button type="submit" disabled={saving} class="btn-primary flex-1">
                    {saving ? t('common.saving') : t('common.save')}
                  </button>
                </div>
              </form>
            ) : (
              <div key={cat.id} class="card flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <span
                    class="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                    style={{ backgroundColor: `${cat.color}30` }}
                  >
                    {cat.icon}
                  </span>
                  <span class="font-medium">{cat.name}</span>
                </div>
                <div class="flex items-center gap-1">
                  <button
                    onClick={() => startEditCategory(cat)}
                    class="p-2 text-slate-400 hover:text-slate-200 transition-colors"
                    aria-label={t('common.edit')}
                  >
                    <PencilIcon />
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(cat)}
                    class="p-2 text-slate-500 hover:text-red-400 transition-colors"
                    aria-label={t('common.delete')}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ),
          )}

          {showAddForm ? (
            <form onSubmit={handleAddCategory} class="card space-y-3">
              <div class="flex gap-3">
                <EmojiPicker value={newIcon} onChange={setNewIcon} placeholder="📦" />
                <input
                  type="text"
                  value={newName}
                  onInput={(e) => setNewName((e.target as HTMLInputElement).value)}
                  placeholder={t('settings.categoryName')}
                  class="input flex-1"
                  required
                />
              </div>
              {error && <p class="text-red-400 text-sm">{error}</p>}
              <div class="flex gap-2">
                <button type="button" onClick={resetForm} class="btn-secondary flex-1">{t('common.cancel')}</button>
                <button type="submit" disabled={saving} class="btn-primary flex-1">
                  {saving ? t('common.adding') : t('common.add')}
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              class="card w-full flex items-center justify-center gap-2 text-slate-400 hover:text-slate-200 hover:bg-slate-750 transition-colors"
            >
              <PlusIcon />
              {t('settings.addCategory')}
            </button>
          )}
        </div>
      ) : activeTab === 'locations' ? (
        <div class="space-y-3">
          {locations.map((loc) =>
            editingId === loc.id ? (
              <form key={loc.id} onSubmit={handleUpdateLocation} class="card space-y-3">
                <div class="flex gap-3">
                  <EmojiPicker value={editIcon} onChange={setEditIcon} placeholder="📍" />
                  <input
                    type="text"
                    value={editName}
                    onInput={(e) => setEditName((e.target as HTMLInputElement).value)}
                    class="input flex-1"
                    required
                  />
                </div>
                <select
                  value={editParentId}
                  onChange={(e) => setEditParentId((e.target as HTMLSelectElement).value)}
                  class="select"
                >
                  <option value="">{t('settings.noParent')}</option>
                  {locations
                    .filter((l) => l.id !== loc.id)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.icon} {l.full_path}
                      </option>
                    ))}
                </select>
                {error && <p class="text-red-400 text-sm">{error}</p>}
                <div class="flex gap-2">
                  <button type="button" onClick={cancelEdit} class="btn-secondary flex-1">{t('common.cancel')}</button>
                  <button type="submit" disabled={saving} class="btn-primary flex-1">
                    {saving ? t('common.saving') : t('common.save')}
                  </button>
                </div>
              </form>
            ) : (
              <div key={loc.id} class="card flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <span class="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-xl">
                    {loc.icon}
                  </span>
                  <span class="font-medium">{loc.full_path}</span>
                </div>
                <div class="flex items-center gap-1">
                  <button
                    onClick={() => startEditLocation(loc)}
                    class="p-2 text-slate-400 hover:text-slate-200 transition-colors"
                    aria-label={t('common.edit')}
                  >
                    <PencilIcon />
                  </button>
                  <button
                    onClick={() => handleDeleteLocation(loc)}
                    class="p-2 text-slate-500 hover:text-red-400 transition-colors"
                    aria-label={t('common.delete')}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ),
          )}

          {showAddForm ? (
            <form onSubmit={handleAddLocation} class="card space-y-3">
              <div class="flex gap-3">
                <EmojiPicker value={newIcon} onChange={setNewIcon} placeholder="📍" />
                <input
                  type="text"
                  value={newName}
                  onInput={(e) => setNewName((e.target as HTMLInputElement).value)}
                  placeholder={t('settings.locationName')}
                  class="input flex-1"
                  required
                />
              </div>
              <select
                value={newParentId}
                onChange={(e) => setNewParentId((e.target as HTMLSelectElement).value)}
                class="select"
              >
                <option value="">No parent (top level)</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.icon} {loc.full_path}
                  </option>
                ))}
              </select>
              {error && <p class="text-red-400 text-sm">{error}</p>}
              <div class="flex gap-2">
                <button type="button" onClick={resetForm} class="btn-secondary flex-1">{t('common.cancel')}</button>
                <button type="submit" disabled={saving} class="btn-primary flex-1">
                  {saving ? t('common.adding') : t('common.add')}
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              class="card w-full flex items-center justify-center gap-2 text-slate-400 hover:text-slate-200 hover:bg-slate-750 transition-colors"
            >
              <PlusIcon />
              {t('settings.addLocation')}
            </button>
          )}
        </div>
      ) : activeTab === 'tags' ? (
        <div class="space-y-3">
          {tags.length === 0 && editingTagId === null && (
            <p class="text-slate-500 text-sm">{t('settings.noTags')}</p>
          )}
          {tags.map((tag) =>
            editingTagId === tag.id ? (
              <form key={tag.id} onSubmit={handleUpdateTag} class="card space-y-3">
                <input
                  type="text"
                  value={editingTagName}
                  onInput={(e) => setEditingTagName((e.target as HTMLInputElement).value)}
                  class="input"
                  required
                  autoFocus
                />
                {tagError && <p class="text-red-400 text-sm">{tagError}</p>}
                <div class="flex gap-2">
                  <button type="button" onClick={cancelEditTag} class="btn-secondary flex-1">{t('common.cancel')}</button>
                  <button type="submit" disabled={addingTag} class="btn-primary flex-1">
                    {addingTag ? t('common.saving') : t('common.save')}
                  </button>
                </div>
              </form>
            ) : (
              <div key={tag.id} class="card flex items-center justify-between">
                <span class="font-medium text-slate-100">{tag.name}</span>
                <div class="flex items-center gap-1">
                  <button
                    onClick={() => startEditTag(tag)}
                    class="p-2 text-slate-400 hover:text-slate-200 transition-colors"
                    aria-label={t('common.edit')}
                  >
                    <PencilIcon />
                  </button>
                  <button
                    onClick={() => handleDeleteTag(tag)}
                    class="p-2 text-slate-500 hover:text-red-400 transition-colors"
                    aria-label={t('common.delete')}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ),
          )}

          <form onSubmit={handleAddTag} class="card space-y-3">
            <input
              type="text"
              value={newTagName}
              onInput={(e) => setNewTagName((e.target as HTMLInputElement).value)}
              placeholder={t('settings.tagName')}
              class="input"
              required
            />
            {tagError && editingTagId === null && <p class="text-red-400 text-sm">{tagError}</p>}
            <button
              type="submit"
              disabled={addingTag || !newTagName.trim()}
              class="btn-primary w-full"
            >
              <span class="flex items-center justify-center gap-2">
                <PlusIcon />
                {addingTag ? t('common.adding') : t('settings.addTag')}
              </span>
            </button>
          </form>
        </div>
      ) : activeTab === 'about' ? (
        <div class="space-y-4">
          <div class="card space-y-3">
            <p class="text-slate-100">{t('about.bio')}</p>
            <p class="text-slate-300">{t('about.motivation')}</p>
          </div>

          <a
            href="https://github.com/bero/stuffinder"
            target="_blank"
            rel="noopener noreferrer"
            class="card flex items-center gap-3 hover:bg-slate-750 transition-colors"
          >
            <svg class="w-6 h-6 text-slate-200" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 .296C5.372.296 0 5.67 0 12.297c0 5.302 3.438 9.8 8.207 11.388.6.111.82-.261.82-.577 0-.285-.01-1.04-.016-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.757-1.333-1.757-1.089-.745.083-.729.083-.729 1.205.084 1.838 1.237 1.838 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.304.762-1.604-2.665-.305-5.467-1.334-5.467-5.933 0-1.311.468-2.381 1.236-3.221-.124-.303-.536-1.524.117-3.176 0 0 1.008-.322 3.3 1.23a11.5 11.5 0 0 1 3.003-.404c1.02.005 2.047.138 3.006.404 2.29-1.552 3.297-1.23 3.297-1.23.655 1.652.243 2.873.12 3.176.77.84 1.235 1.91 1.235 3.221 0 4.61-2.807 5.625-5.48 5.922.43.372.814 1.102.814 2.222 0 1.606-.015 2.898-.015 3.293 0 .32.216.694.825.576C20.565 22.092 24 17.597 24 12.297 24 5.67 18.627.296 12 .296z"/>
            </svg>
            <div class="flex-1">
              <p class="font-medium text-slate-100">{t('about.github')}</p>
              <p class="text-sm text-slate-400">bero/stuffinder</p>
            </div>
            <svg class="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>

          <a
            href="https://www.facebook.com/bero001"
            target="_blank"
            rel="noopener noreferrer"
            class="card flex items-center gap-3 hover:bg-slate-750 transition-colors"
          >
            <svg class="w-6 h-6 text-[#1877F2]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            <div class="flex-1">
              <p class="font-medium text-slate-100">{t('about.facebook')}</p>
              <p class="text-sm text-slate-400">bero001</p>
            </div>
            <svg class="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>

          <div class="space-y-2 text-sm text-slate-400 text-center px-2 pt-2">
            <p>{t('about.pullRequests')}</p>
            <p>{t('about.messenger')}</p>
          </div>

          <p class="text-xs text-slate-600 text-center pt-4">
            {t('about.version')} {APP_VERSION}
          </p>
        </div>
      ) : null}

      {deleteTarget && (
        <div class="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div class="bg-slate-800 rounded-xl p-6 max-w-md w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 class="text-lg font-semibold text-slate-100">
              {t(
                deleteTarget.kind === 'category'
                  ? 'settings.deleteCategoryTitle'
                  : 'settings.deleteLocationTitle',
                { name: deleteTarget.name },
              )}
            </h3>

            <div>
              <p class="text-sm text-slate-400 mb-2">
                {t('settings.deleteAffectedHeading')} ({deleteTarget.affected.length})
              </p>
              <ul class="bg-slate-900 rounded-lg border border-slate-700 max-h-48 overflow-y-auto divide-y divide-slate-800">
                {deleteTarget.affected.map((it) => (
                  <li key={it.id} class="px-3 py-2 text-sm flex items-center gap-2">
                    <span>{it.category_icon || (deleteTarget.kind === 'location' ? '📍' : '📦')}</span>
                    <span class="text-slate-200 truncate">{it.name}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <label class="input-label" for="reassign-select">
                {t(
                  deleteTarget.kind === 'category'
                    ? 'settings.reassignCategoryLabel'
                    : 'settings.reassignLocationLabel',
                )}
              </label>
              <select
                id="reassign-select"
                value={reassignTo}
                onChange={(e) => setReassignTo((e.target as HTMLSelectElement).value)}
                class="select"
              >
                <option value="">{t('settings.reassignLeaveBlank')}</option>
                {deleteTarget.kind === 'category'
                  ? categories
                      .filter((c) => c.id !== deleteTarget.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.icon} {c.name}
                        </option>
                      ))
                  : locations
                      .filter((l) => l.id !== deleteTarget.id)
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.icon} {l.full_path}
                        </option>
                      ))}
              </select>
              {!reassignTo && (
                <p class="text-xs text-amber-400 mt-2">
                  {t(
                    deleteTarget.kind === 'category'
                      ? 'settings.reassignBlankWarningCategory'
                      : 'settings.reassignBlankWarningLocation',
                  )}
                </p>
              )}
            </div>

            <div class="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                class="btn-secondary flex-1"
                disabled={deleteBusy}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={confirmDeleteWithReassign}
                class="btn-danger flex-1"
                disabled={deleteBusy}
              >
                {deleteBusy ? t('common.deleting') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingImportFile && (
        <div class="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div class="bg-slate-800 rounded-xl p-6 max-w-md w-full space-y-4">
            <h3 class="text-lg font-semibold text-slate-100">{t('settings.importModeTitle')}</h3>

            <button
              onClick={() => runImport('merge')}
              class="w-full text-left bg-slate-700 hover:bg-slate-600 rounded-lg p-3 transition-colors"
            >
              <p class="font-medium text-slate-100">{t('settings.importModeMerge')}</p>
              <p class="text-xs text-slate-400 mt-1">{t('settings.importModeMergeHint')}</p>
            </button>

            <button
              onClick={() => runImport('replace')}
              class="w-full text-left bg-slate-700 hover:bg-red-900/60 rounded-lg p-3 transition-colors"
            >
              <p class="font-medium text-red-300">{t('settings.importModeReplace')}</p>
              <p class="text-xs text-slate-400 mt-1">{t('settings.importModeReplaceHint')}</p>
            </button>

            <button
              onClick={() => setPendingImportFile(null)}
              class="btn-secondary w-full"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
