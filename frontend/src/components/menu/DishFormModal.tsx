import { useState, useEffect } from 'react';
import { X, Upload, Loader2 } from 'lucide-react';
import { api } from '../../services/api';

interface DishFormModalProps {
  dish?: {
    id: string;
    name: string;
    description?: string;
    price_cents: number;
    image_url?: string;
    category_id?: string;
    is_available: boolean;
  };
  categories: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    description?: string;
    price_cents: number;
    image_url?: string;
    category_id?: string;
    is_available: boolean;
  }) => Promise<void>;
}

export function DishFormModal({ dish, categories, onClose, onSubmit }: DishFormModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '0.00',
    image_url: '',
    category_id: '',
    is_available: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (dish) {
      setFormData({
        name: dish.name,
        description: dish.description || '',
        price: (dish.price_cents / 100).toFixed(2),
        image_url: dish.image_url || '',
        category_id: dish.category_id || '',
        is_available: dish.is_available,
      });
    }
  }, [dish]);

  const handleImageUpload = async (file: File) => {
    try {
      setUploadingImage(true);
      const response = await api.uploadImage(file);

      if (response.success) {
        setFormData((prev) => ({ ...prev, image_url: response.data.url }));
      }
    } catch (error: any) {
      setError(error.response?.data?.error?.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await onSubmit({
        name: formData.name,
        description: formData.description || undefined,
        price_cents: Math.round(parseFloat(formData.price) * 100),
        image_url: formData.image_url || undefined,
        category_id: formData.category_id || undefined,
        is_available: formData.is_available,
      });
      onClose();
    } catch (error: any) {
      setError(error.response?.data?.error?.message || 'Failed to save dish');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-2xl font-bold text-gray-900">
            {dish ? 'Edit Dish' : 'Add New Dish'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="error-text">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="name" className="label">
              Dish Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="input"
              required
              placeholder="Margherita Pizza"
            />
          </div>

          <div>
            <label htmlFor="description" className="label">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="input min-h-[100px]"
              placeholder="Fresh mozzarella, tomatoes, basil..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="price" className="label">
                Price ($) <span className="text-red-500">*</span>
              </label>
              <input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) =>
                  setFormData({ ...formData, price: e.target.value })
                }
                className="input"
                required
              />
            </div>

            <div>
              <label htmlFor="category" className="label">
                Category
              </label>
              <select
                id="category"
                value={formData.category_id}
                onChange={(e) =>
                  setFormData({ ...formData, category_id: e.target.value })
                }
                className="input"
              >
                <option value="">No Category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Image</label>
            {formData.image_url && (
              <img
                src={formData.image_url}
                alt="Dish"
                className="w-full h-48 object-cover rounded-lg border border-gray-200 mb-4"
              />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file);
              }}
              className="hidden"
              id="dish-image-upload"
              disabled={uploadingImage}
            />
            <label
              htmlFor="dish-image-upload"
              className="btn-outline cursor-pointer inline-flex items-center gap-2"
            >
              {uploadingImage ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  {formData.image_url ? 'Change Image' : 'Upload Image'}
                </>
              )}
            </label>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="is_available"
              type="checkbox"
              checked={formData.is_available}
              onChange={(e) =>
                setFormData({ ...formData, is_available: e.target.checked })
              }
              className="w-4 h-4 text-primary-600 rounded"
            />
            <label htmlFor="is_available" className="text-sm font-medium text-gray-700">
              Available for orders
            </label>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : dish ? 'Save Changes' : 'Add Dish'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={isSubmitting}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
