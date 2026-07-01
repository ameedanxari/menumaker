import { Pencil, Trash2, ImageIcon } from 'lucide-react';

interface DishCardProps {
  dish: {
    id: string;
    name: string;
    description?: string;
    price_cents: number;
    image_url?: string;
    is_available: boolean;
    category?: { name: string };
  };
  onEdit: () => void;
  onDelete: () => void;
}

export function DishCard({ dish, onEdit, onDelete }: DishCardProps) {
  return (
    <div
      className="card hover:shadow-md transition-shadow"
      data-dish-name={dish.name}
      data-available={String(dish.is_available)}
    >
      <div className="flex gap-4">
        {/* Image */}
        <div className="w-24 h-24 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
          {dish.image_url ? (
            <img
              src={dish.image_url}
              alt={dish.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-gray-400" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-gray-900">{dish.name}</h3>
              {dish.category && (
                <span className="text-xs text-gray-500">{dish.category.name}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onEdit}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Edit dish"
                type="button"
              >
                <Pencil className="w-4 h-4 text-gray-600" />
                <span className="sr-only">Edit</span>
              </button>
              <button
                onClick={onDelete}
                className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete dish"
                type="button"
              >
                <Trash2 className="w-4 h-4 text-red-600" />
                <span className="sr-only">Delete</span>
              </button>
            </div>
          </div>

          {dish.description && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
              {dish.description}
            </p>
          )}

          <div className="flex items-center justify-between mt-2">
            <span className="font-semibold text-primary-600">
              ${(dish.price_cents / 100).toFixed(2)}
            </span>
            <span
              className={`text-xs px-2 py-1 rounded-full ${
                dish.is_available
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {dish.is_available ? 'Available' : 'Unavailable'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
