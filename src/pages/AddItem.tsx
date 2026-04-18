import { useState, useEffect, useRef } from 'preact/hooks';
import { route } from 'preact-router';
import { createItem, getCategories, getLocationsWithPath } from '../lib/api';
import type { Category, Location } from '../types/database';

function CameraIcon() {
  return (
    <svg class="w-12 h-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
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

export function AddItem() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Array<Location & { full_path: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Load categories and locations
  useEffect(() => {
    async function loadData() {
      try {
        const [cats, locs] = await Promise.all([
          getCategories(),
          getLocationsWithPath(),
        ]);
        setCategories(cats);
        setLocations(locs);
      } catch (err) {
        console.error('Failed to load data:', err);
      }
    }
    loadData();
  }, []);
  
  // Handle photo selection
  function handlePhotoChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (file) {
      setPhoto(file);
      // Create preview URL
      const url = URL.createObjectURL(file);
      setPhotoPreview(url);
    }
  }
  
  // Open camera/file picker
  function openCamera() {
    fileInputRef.current?.click();
  }
  
  // Remove photo
  function removePhoto() {
    setPhoto(null);
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
      setPhotoPreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }
  
  // Save item
  async function handleSubmit(e: Event) {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Please enter a name');
      return;
    }
    
    try {
      setSaving(true);
      setError(null);
      
      await createItem({
        name: name.trim(),
        description: description.trim() || undefined,
        category_id: categoryId || undefined,
        location_id: locationId || undefined,
        photo: photo || undefined,
      });
      
      // Navigate back to home
      route('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save item');
    } finally {
      setSaving(false);
    }
  }
  
  return (
    <div class="min-h-screen">
      {/* Header */}
      <header class="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center gap-4 safe-top">
        <button 
          onClick={() => route('/')}
          class="p-1 -ml-1 text-slate-400 hover:text-slate-200"
        >
          <BackIcon />
        </button>
        <h1 class="text-lg font-semibold">Add Item</h1>
      </header>
      
      <form onSubmit={handleSubmit} class="p-4 space-y-6">
        {/* Photo capture */}
        <div>
          <label class="input-label">Photo</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoChange}
            class="hidden"
          />
          
          {photoPreview ? (
            <div class="relative">
              <img 
                src={photoPreview} 
                alt="Preview" 
                class="w-full h-48 object-cover rounded-xl"
              />
              <button
                type="button"
                onClick={removePhoto}
                class="absolute top-2 right-2 p-2 bg-slate-900/80 rounded-full text-slate-300 hover:text-white"
              >
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={openCamera}
              class="w-full h-48 border-2 border-dashed border-slate-600 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-slate-500 hover:bg-slate-800/50 transition-colors"
            >
              <CameraIcon />
              <span class="text-slate-400">Tap to take photo</span>
            </button>
          )}
        </div>
        
        {/* Name */}
        <div>
          <label class="input-label" for="name">Name *</label>
          <input
            id="name"
            type="text"
            value={name}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            placeholder="What is this item?"
            class="input"
            required
          />
        </div>
        
        {/* Location */}
        <div>
          <label class="input-label" for="location">Location</label>
          <select
            id="location"
            value={locationId}
            onChange={(e) => setLocationId((e.target as HTMLSelectElement).value)}
            class="select"
          >
            <option value="">Select location...</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.icon} {loc.full_path}
              </option>
            ))}
          </select>
        </div>
        
        {/* Category */}
        <div>
          <label class="input-label" for="category">Category</label>
          <select
            id="category"
            value={categoryId}
            onChange={(e) => setCategoryId((e.target as HTMLSelectElement).value)}
            class="select"
          >
            <option value="">Select category...</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
        </div>
        
        {/* Description */}
        <div>
          <label class="input-label" for="description">Description (optional)</label>
          <textarea
            id="description"
            value={description}
            onInput={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
            placeholder="Additional details..."
            rows={3}
            class="input resize-none"
          />
        </div>
        
        {/* Error message */}
        {error && (
          <div class="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
        
        {/* Submit button */}
        <button
          type="submit"
          disabled={saving || !name.trim()}
          class="btn-primary w-full py-4 text-lg"
        >
          {saving ? (
            <span class="flex items-center justify-center gap-2">
              <span class="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></span>
              Saving...
            </span>
          ) : (
            'Save Item'
          )}
        </button>
      </form>
    </div>
  );
}
