import React, { useState } from 'react';
import { Modal } from '../../components/Modal';
import { categoryService } from '../../services/categoryService';
import { useCategories } from '../../hooks/useCategories';
import { CATEGORY_ICON_OPTIONS, getCategoryEmoji } from '../../constants/categoryIcons';
import type { Category } from '../../types';
import { Plus, ArrowUp, ArrowDown, Edit2, Archive, ArchiveRestore, X } from 'lucide-react';

interface CategoryManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CategoryManagementModal: React.FC<CategoryManagementModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { categories } = useCategories({ activeOnly: false });

  // Creation form state
  const [isCreating, setIsCreating] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('package');

  // Editing category state
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');

  // Icon picker popover state
  const [isPickingIconFor, setIsPickingIconFor] = useState<'new' | 'edit' | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    try {
      await categoryService.createCategory({
        name: newCatName.trim(),
        icon: newCatIcon,
      });
      setNewCatName('');
      setNewCatIcon('package');
      setIsCreating(false);
    } catch (err: any) {
      alert(err?.message || 'Failed to create category');
    }
  };

  const handleStartEdit = (cat: Category) => {
    setEditingCategory(cat);
    setEditName(cat.name);
    setEditIcon(cat.icon || 'package');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editName.trim()) return;

    try {
      await categoryService.updateCategory(editingCategory.id, {
        name: editName.trim(),
        icon: editIcon,
      });
      setEditingCategory(null);
    } catch (err: any) {
      alert(err?.message || 'Failed to update category');
    }
  };

  const handleToggleActive = async (cat: Category) => {
    try {
      if (cat.isActive) {
        await categoryService.archiveCategory(cat.id);
      } else {
        await categoryService.restoreCategory(cat.id);
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to update category status');
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const ordered = [...categories];
    const temp = ordered[index];
    ordered[index] = ordered[targetIndex];
    ordered[targetIndex] = temp;

    await categoryService.reorderCategories(ordered.map((c) => c.id));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Categories"
      subtitle="Organize your shop's categories and icons"
    >
      <div className="space-y-4">
        {/* Top: Add Category Button or Form */}
        {!isCreating ? (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-black hover:bg-blue-100 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Add New Category</span>
          </button>
        ) : (
          <form onSubmit={handleCreate} className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-blue-900">New Category</span>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Icon selector button */}
              <button
                type="button"
                onClick={() => setIsPickingIconFor('new')}
                className="w-12 h-11 bg-white border border-slate-200 rounded-xl text-2xl flex items-center justify-center shrink-0 hover:border-blue-400 cursor-pointer"
                title="Choose icon"
              >
                {getCategoryEmoji(newCatIcon)}
              </button>

              <input
                type="text"
                placeholder="Category Name (e.g. Ice Cream)"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                autoFocus
                className="flex-1 h-11 px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Icon Picker Popover for New Category */}
            {isPickingIconFor === 'new' && (
              <div className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-2">
                <span className="text-[11px] font-bold text-slate-500 block">Choose Category Icon:</span>
                <div className="grid grid-cols-6 gap-1.5 max-h-40 overflow-y-auto">
                  {CATEGORY_ICON_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => {
                        setNewCatIcon(opt.key);
                        setIsPickingIconFor(null);
                      }}
                      className={`text-2xl p-2 rounded-lg border hover:bg-blue-50 cursor-pointer text-center ${
                        newCatIcon === opt.key ? 'border-blue-500 bg-blue-50' : 'border-slate-100'
                      }`}
                      title={opt.label}
                    >
                      {opt.emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

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
                Save Category
              </button>
            </div>
          </form>
        )}

        {/* Existing Categories List */}
        <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
          {categories.map((cat, idx) => {
            const isEditingThis = editingCategory?.id === cat.id;

            if (isEditingThis) {
              return (
                <form
                  key={cat.id}
                  onSubmit={handleSaveEdit}
                  className="p-3 bg-slate-50 border border-slate-300 rounded-xl space-y-2.5"
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsPickingIconFor('edit')}
                      className="w-10 h-10 bg-white border border-slate-200 rounded-xl text-xl flex items-center justify-center shrink-0 cursor-pointer"
                    >
                      {getCategoryEmoji(editIcon)}
                    </button>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold"
                    />
                  </div>

                  {isPickingIconFor === 'edit' && (
                    <div className="p-2 bg-white border border-slate-200 rounded-xl space-y-1.5">
                      <div className="grid grid-cols-6 gap-1 max-h-36 overflow-y-auto">
                        {CATEGORY_ICON_OPTIONS.map((opt) => (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => {
                              setEditIcon(opt.key);
                              setIsPickingIconFor(null);
                            }}
                            className={`text-xl p-1.5 rounded-lg border hover:bg-blue-50 cursor-pointer text-center ${
                              editIcon === opt.key ? 'border-blue-500 bg-blue-50' : 'border-slate-100'
                            }`}
                          >
                            {opt.emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingCategory(null)}
                      className="px-2.5 py-1 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Save
                    </button>
                  </div>
                </form>
              );
            }

            return (
              <div
                key={cat.id}
                className={`flex items-center justify-between p-2.5 bg-white border rounded-xl transition-all ${
                  cat.isActive ? 'border-slate-200' : 'border-slate-200 bg-slate-50 opacity-60'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-2xl shrink-0 leading-none">{getCategoryEmoji(cat.icon)}</span>
                  <div className="min-w-0">
                    <span className="text-sm font-extrabold text-slate-900 block truncate">
                      {cat.name}
                    </span>
                    {!cat.isActive && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1 py-0.2 rounded">
                        Archived
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions: Reorder, Edit, Archive/Restore */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Move Up */}
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => handleMove(idx, 'up')}
                    className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                    title="Move up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>

                  {/* Move Down */}
                  <button
                    type="button"
                    disabled={idx === categories.length - 1}
                    onClick={() => handleMove(idx, 'down')}
                    className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                    title="Move down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>

                  {/* Edit */}
                  <button
                    type="button"
                    onClick={() => handleStartEdit(cat)}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                    title="Rename / change icon"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Archive / Restore */}
                  <button
                    type="button"
                    onClick={() => handleToggleActive(cat)}
                    className={`p-1.5 rounded-lg cursor-pointer ${
                      cat.isActive
                        ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                        : 'text-emerald-600 hover:bg-emerald-50'
                    }`}
                    title={cat.isActive ? 'Archive category' : 'Restore category'}
                  >
                    {cat.isActive ? <Archive className="w-3.5 h-3.5" /> : <ArchiveRestore className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};
