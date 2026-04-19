import { useState, useEffect } from 'preact/hooks';
import {
  getCategories,
  getLocationsWithPath,
  createCategory,
  createLocation,
  updateCategory,
  updateLocation,
  deleteCategory,
  deleteLocation,
  createInvite,
  getInvites,
  revokeInvite,
  leaveHousehold,
} from '../lib/api';
import { signOut } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { useT, t as tRaw, formatDate } from '../lib/i18n';
import { LanguagePicker } from '../components/LanguagePicker';
import type { Category, Location, HouseholdMembership, HouseholdInvite } from '../types/database';

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

type Tab = 'household' | 'categories' | 'locations' | 'about';

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
  const [loading, setLoading] = useState(true);

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
      const [cats, locs] = await Promise.all([
        getCategories(activeHouseholdId),
        getLocationsWithPath(activeHouseholdId),
      ]);
      setCategories(cats);
      setLocations(locs);
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

  async function handleDeleteCategory(id: string) {
    if (!confirm(tRaw('settings.deleteCategoryConfirm'))) return;
    try {
      await deleteCategory(id);
      await loadData();
    } catch {
      alert(tRaw('settings.failedDeleteCategory'));
    }
  }

  async function handleDeleteLocation(id: string) {
    if (!confirm(tRaw('settings.deleteLocationConfirm'))) return;
    try {
      await deleteLocation(id);
      await loadData();
    } catch {
      alert(tRaw('settings.failedDeleteLocation'));
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

  return (
    <div class="px-4 pt-6">
      <LanguagePicker />
      <header class="mb-6">
        <h1 class="text-2xl font-bold text-slate-100">{t('settings.title')}</h1>
        <p class="text-slate-400">{active?.household?.name || t('settings.title')}</p>
      </header>

      <div class="flex border-b border-slate-700 mb-4 overflow-x-auto">
        {(['household', 'categories', 'locations', 'about'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); resetForm(); }}
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
            <p class="text-xs text-slate-500 mb-3">
              {t('settings.inviteHint')}
            </p>
            {invites.length === 0 ? (
              <p class="text-slate-500 text-sm">{t('settings.noInvites')}</p>
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
          <div class="pt-4 border-t border-slate-800 space-y-2">
            {!isOwner && (
              <button onClick={handleLeave} class="btn-secondary w-full">
                {t('settings.leave')}
              </button>
            )}
            <button onClick={handleSignOut} class="btn-secondary w-full">
              {t('settings.signOut')}
            </button>
          </div>
        </div>
      )}

      {loading && (activeTab === 'categories' || activeTab === 'locations') ? (
        <div class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
        </div>
      ) : activeTab === 'categories' ? (
        <div class="space-y-3">
          {categories.map((cat) =>
            editingId === cat.id ? (
              <form key={cat.id} onSubmit={handleUpdateCategory} class="card space-y-3">
                <div class="flex gap-3">
                  <input
                    type="text"
                    value={editIcon}
                    onInput={(e) => setEditIcon((e.target as HTMLInputElement).value)}
                    placeholder="📦"
                    class="input w-16 text-center text-xl"
                    maxLength={2}
                  />
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
                    onClick={() => handleDeleteCategory(cat.id)}
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
                <input
                  type="text"
                  value={newIcon}
                  onInput={(e) => setNewIcon((e.target as HTMLInputElement).value)}
                  placeholder="📦"
                  class="input w-16 text-center text-xl"
                  maxLength={2}
                />
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
                  <input
                    type="text"
                    value={editIcon}
                    onInput={(e) => setEditIcon((e.target as HTMLInputElement).value)}
                    placeholder="📍"
                    class="input w-16 text-center text-xl"
                    maxLength={2}
                  />
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
                    onClick={() => handleDeleteLocation(loc.id)}
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
                <input
                  type="text"
                  value={newIcon}
                  onInput={(e) => setNewIcon((e.target as HTMLInputElement).value)}
                  placeholder="📍"
                  class="input w-16 text-center text-xl"
                  maxLength={2}
                />
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
    </div>
  );
}
