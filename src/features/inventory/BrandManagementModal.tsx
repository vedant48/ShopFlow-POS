import React, { useState } from 'react';
import { Modal } from '../../components/Modal';
import { brandService } from '../../services/brandService';
import { useBrands } from '../../hooks/useBrands';
import { getCategoryEmoji } from '../../constants/categoryIcons';
import type { Category, Brand } from '../../types';
import { Plus, ArrowUp, ArrowDown, Edit2, Archive, ArchiveRestore, X } from 'lucide-react';

interface BrandManagementModalProps {
  category: Category | null;
  isOpen: boolean;
  onClose: () => void;
}

export const BrandManagementModal: React.FC<BrandManagementModalProps> = ({
  category,
  isOpen,
  onClose,
}) => {
  const { brands } = useBrands(category?.id, { activeOnly: false });

  const [isCreating, setIsCreating] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');

  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [editName, setEditName] = useState('');

  if (!category) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandName.trim() || !category) return;

    try {
      await brandService.createBrand({
        categoryId: category.id,
        name: newBrandName.trim(),
      });
      setNewBrandName('');
      setIsCreating(false);
    } catch (err: any) {
      alert(err?.message || 'Failed to create brand');
    }
  };

  const handleStartEdit = (brand: Brand) => {
    setEditingBrand(brand);
    setEditName(brand.name);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBrand || !editName.trim()) return;

    try {
      await brandService.updateBrand(editingBrand.id, {
        name: editName.trim(),
      });
      setEditingBrand(null);
    } catch (err: any) {
      alert(err?.message || 'Failed to update brand');
    }
  };

  const handleToggleActive = async (brand: Brand) => {
    try {
      if (brand.isActive) {
        await brandService.archiveBrand(brand.id);
      } else {
        await brandService.restoreBrand(brand.id);
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to update brand status');
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= brands.length) return;

    const ordered = [...brands];
    const temp = ordered[index];
    ordered[index] = ordered[targetIndex];
    ordered[targetIndex] = temp;

    await brandService.reorderBrands(ordered.map((b) => b.id));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${getCategoryEmoji(category.icon)} ${category.name} — Brands`}
      subtitle={`Manage brands / subcategories under ${category.name}`}
    >
      <div className="space-y-4">
        {/* Top: Add Brand Button or Form */}
        {!isCreating ? (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-black hover:bg-blue-100 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Add Brand to {category.name}</span>
          </button>
        ) : (
          <form onSubmit={handleCreate} className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-blue-900">New Brand</span>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              placeholder="Brand Name (e.g. Classic, Gold Flake)"
              value={newBrandName}
              onChange={(e) => setNewBrandName(e.target.value)}
              autoFocus
              className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 cursor-pointer"
              >
                Save Brand
              </button>
            </div>
          </form>
        )}

        {/* Existing Brands List */}
        <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
          {brands.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs font-medium">
              No brands in {category.name} yet. Brands are optional.
            </div>
          ) : (
            brands.map((brand, idx) => {
              const isEditingThis = editingBrand?.id === brand.id;

              if (isEditingThis) {
                return (
                  <form
                    key={brand.id}
                    onSubmit={handleSaveEdit}
                    className="p-3 bg-slate-50 border border-slate-300 rounded-xl flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 h-9 px-3 bg-white border border-slate-200 rounded-lg text-sm font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => setEditingBrand(null)}
                      className="px-2.5 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Save
                    </button>
                  </form>
                );
              }

              return (
                <div
                  key={brand.id}
                  className={`flex items-center justify-between p-2.5 bg-white border rounded-xl transition-all ${
                    brand.isActive ? 'border-slate-200' : 'border-slate-200 bg-slate-50 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-extrabold text-slate-900 block truncate">
                      {brand.name}
                    </span>
                    {!brand.isActive && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1 py-0.2 rounded">
                        Archived
                      </span>
                    )}
                  </div>

                  {/* Actions: Move, Edit, Archive */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMove(idx, 'up')}
                      className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                      title="Move up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      disabled={idx === brands.length - 1}
                      onClick={() => handleMove(idx, 'down')}
                      className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                      title="Move down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStartEdit(brand)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                      title="Rename brand"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleActive(brand)}
                      className={`p-1.5 rounded-lg cursor-pointer ${
                        brand.isActive
                          ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                          : 'text-emerald-600 hover:bg-emerald-50'
                      }`}
                      title={brand.isActive ? 'Archive brand' : 'Restore brand'}
                    >
                      {brand.isActive ? <Archive className="w-3.5 h-3.5" /> : <ArchiveRestore className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
};
