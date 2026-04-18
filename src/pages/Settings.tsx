import { useState, useEffect } from 'preact/hooks';
import { 
  getCategories, 
  getLocationsWithPath, 
  createCategory, 
  createLocation,
  deleteCategory,
  deleteLocation 
} from '../lib/api';
import type { Category, Location } from '../types/database';

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

type Tab = 'categories' | 'locations';

export function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>('categories');
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Array<Location & { full_path: string }>>([]);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('');
  const [newParentId, setNewParentId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Load data
  useEffect(() => {
    loadData();
  }, []);
  
  async function loadData() {
    try {
      setLoading(true);
      const [cats, locs] = await Promise.all([
        getCategories(),
        getLocationsWithPath(),
      ]);
      setCategories(cats);
      setLocations(locs);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }
  
  // Reset form
  function resetForm() {
    setNewName('');
    setNewIcon('');
    setNewParentId('');
    setShowAddForm(false);
    setError(null);
  }
  
  // Add category
  async function handleAddCategory(e: Event) {
    e.preventDefault();
    if (!newName.trim()) return;
    
    try {
      setSaving(true);
      setError(null);
      await createCategory({
        name: newName.trim(),
        icon: newIcon || undefined,
      });
      await loadData();
      resetForm();
    } catch (err) {
      setError('Failed to add category');
    } finally {
      setSaving(false);
    }
  }
  
  // Add location
  async function handleAddLocation(e: Event) {
    e.preventDefault();
    if (!newName.trim()) return;
    
    try {
      setSaving(true);
      setError(null);
      await createLocation({
        name: newName.trim(),
        icon: newIcon || undefined,
        parent_id: newParentId || undefined,
      });
      await loadData();
      resetForm();
    } catch (err) {
      setError('Failed to add location');
    } finally {
      setSaving(false);
    }
  }
  
  // Delete category
  async function handleDeleteCategory(id: string) {
    if (!confirm('Delete this category? Items using it will have no category.')) return;
    
    try {
      await deleteCategory(id);
      await loadData();
    } catch (err) {
      alert('Failed to delete category');
    }
  }
  
  // Delete location
  async function handleDeleteLocation(id: string) {
    if (!confirm('Delete this location? Items and sub-locations will have no location.')) return;
    
    try {
      await deleteLocation(id);
      await loadData();
    } catch (err) {
      alert('Failed to delete location');
    }
  }
  
  return (
    <div class="px-4 pt-6">
      <header class="mb-6">
        <h1 class="text-2xl font-bold text-slate-100">Settings</h1>
        <p class="text-slate-400">Manage categories and locations</p>
      </header>
      
      {/* Tabs */}
      <div class="flex border-b border-slate-700 mb-4">
        <button
          onClick={() => { setActiveTab('categories'); resetForm(); }}
          class={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'categories'
              ? 'text-primary-400 border-primary-400'
              : 'text-slate-400 border-transparent hover:text-slate-300'
          }`}
        >
          Categories
        </button>
        <button
          onClick={() => { setActiveTab('locations'); resetForm(); }}
          class={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'locations'
              ? 'text-primary-400 border-primary-400'
              : 'text-slate-400 border-transparent hover:text-slate-300'
          }`}
        >
          Locations
        </button>
      </div>
      
      {loading ? (
        <div class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
        </div>
      ) : (
        <>
          {/* Categories tab */}
          {activeTab === 'categories' && (
            <div class="space-y-3">
              {categories.map((cat) => (
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
                  <button
                    onClick={() => handleDeleteCategory(cat.id)}
                    class="p-2 text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
              
              {/* Add form */}
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
                      placeholder="Category name"
                      class="input flex-1"
                      required
                    />
                  </div>
                  {error && <p class="text-red-400 text-sm">{error}</p>}
                  <div class="flex gap-2">
                    <button type="button" onClick={resetForm} class="btn-secondary flex-1">
                      Cancel
                    </button>
                    <button type="submit" disabled={saving} class="btn-primary flex-1">
                      {saving ? 'Adding...' : 'Add'}
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setShowAddForm(true)}
                  class="card w-full flex items-center justify-center gap-2 text-slate-400 hover:text-slate-200 hover:bg-slate-750 transition-colors"
                >
                  <PlusIcon />
                  Add Category
                </button>
              )}
            </div>
          )}
          
          {/* Locations tab */}
          {activeTab === 'locations' && (
            <div class="space-y-3">
              {locations.map((loc) => (
                <div key={loc.id} class="card flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <span class="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-xl">
                      {loc.icon}
                    </span>
                    <span class="font-medium">{loc.full_path}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteLocation(loc.id)}
                    class="p-2 text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
              
              {/* Add form */}
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
                      placeholder="Location name"
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
                    <button type="button" onClick={resetForm} class="btn-secondary flex-1">
                      Cancel
                    </button>
                    <button type="submit" disabled={saving} class="btn-primary flex-1">
                      {saving ? 'Adding...' : 'Add'}
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setShowAddForm(true)}
                  class="card w-full flex items-center justify-center gap-2 text-slate-400 hover:text-slate-200 hover:bg-slate-750 transition-colors"
                >
                  <PlusIcon />
                  Add Location
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
