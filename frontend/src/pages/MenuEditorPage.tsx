import { useEffect, useState } from 'react';
import { useBusinessStore } from '../stores/businessStore';
import { useMenuStore } from '../stores/menuStore';
import { DishCard } from '../components/menu/DishCard';
import { DishFormModal } from '../components/menu/DishFormModal';
import {
  Plus,
  Search,
  ChefHat,
  ListOrdered,
  Loader2,
  Upload,
  CheckCircle,
  Archive,
} from 'lucide-react';

export default function MenuEditorPage() {
  const { currentBusiness } = useBusinessStore();
  const {
    dishes,
    categories,
    menus,
    currentMenu,
    activeMenu,
    fetchDishes,
    fetchCategories,
    fetchMenus,
    fetchActiveMenu,
    createDish,
    updateDish,
    deleteDish,
    createCategory,
    createMenu,
    addDishToMenu,
    removeDishFromMenu,
    publishMenu,
    archiveMenu,
    setCurrentMenu,
    isLoading,
  } = useMenuStore();

  const [activeTab, setActiveTab] = useState<'dishes' | 'menus'>('dishes');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showDishModal, setShowDishModal] = useState(false);
  const [editingDish, setEditingDish] = useState<any>(null);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showNewMenuModal, setShowNewMenuModal] = useState(false);
  const [newMenuName, setNewMenuName] = useState('');
  const [newMenuDescription, setNewMenuDescription] = useState('');

  useEffect(() => {
    if (currentBusiness) {
      fetchDishes(currentBusiness.id);
      fetchCategories(currentBusiness.id);
      fetchMenus(currentBusiness.id);
      fetchActiveMenu(currentBusiness.id);
    }
  }, [currentBusiness, fetchDishes, fetchCategories, fetchMenus, fetchActiveMenu]);

  const filteredDishes = dishes.filter((dish) => {
    const matchesSearch = dish.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === 'all' ||
      (selectedCategory === 'none' && !dish.category_id) ||
      dish.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCreateDish = async (data: any) => {
    if (!currentBusiness) return;
    await createDish(currentBusiness.id, data);
  };

  const handleUpdateDish = async (data: any) => {
    if (!editingDish) return;
    await updateDish(editingDish.id, data);
  };

  const handleDeleteDish = async (id: string) => {
    if (confirm('Are you sure you want to delete this dish?')) {
      await deleteDish(id);
    }
  };

  const handleCreateCategory = async () => {
    if (!currentBusiness || !newCategoryName.trim()) return;
    try {
      await createCategory(currentBusiness.id, newCategoryName);
      setNewCategoryName('');
      setShowNewCategoryInput(false);
    } catch (_error) {
      console.error('Failed to create category:', _error);
    }
  };

  const handleCreateMenu = async () => {
    if (!currentBusiness || !newMenuName.trim()) return;
    try {
      await createMenu(currentBusiness.id, newMenuName, newMenuDescription);
      setNewMenuName('');
      setNewMenuDescription('');
      setShowNewMenuModal(false);
    } catch (_error) {
      console.error('Failed to create menu:', _error);
    }
  };

  const handleAddToMenu = async (dishId: string) => {
    if (!currentMenu) {
      alert('Please select or create a menu first');
      return;
    }
    try {
      await addDishToMenu(currentMenu.id, dishId);
    } catch (_error) {
      console.error('Failed to add dish to menu:', _error);
    }
  };

  const handleRemoveFromMenu = async (dishId: string) => {
    if (!currentMenu) return;
    try {
      await removeDishFromMenu(currentMenu.id, dishId);
    } catch (_error) {
      console.error('Failed to remove dish from menu:', _error);
    }
  };

  const handlePublishMenu = async () => {
    if (!currentMenu) return;
    if (confirm('Are you sure you want to publish this menu? This will replace your current active menu.')) {
      try {
        await publishMenu(currentMenu.id);
      } catch (_error) {
        console.error('Failed to publish menu:', _error);
      }
    }
  };

  const handleArchiveMenu = async () => {
    if (!currentMenu) return;
    if (confirm('Are you sure you want to archive this menu?')) {
      try {
        await archiveMenu(currentMenu.id);
      } catch (_error) {
        console.error('Failed to archive menu:', _error);
      }
    }
  };

  if (!currentBusiness) {
    return (
      <div className="card">
        <p className="text-gray-600">
          Please create a business profile first before managing your menu.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Menu Editor</h1>
        <p className="text-gray-600 mt-1">Create and manage your dishes and menus</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-8">
          <button
            onClick={() => setActiveTab('dishes')}
            className={`pb-4 px-1 border-b-2 font-medium transition-colors ${
              activeTab === 'dishes'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ChefHat className="w-5 h-5 inline-block mr-2" />
            Dishes ({dishes.length})
          </button>
          <button
            onClick={() => setActiveTab('menus')}
            className={`pb-4 px-1 border-b-2 font-medium transition-colors ${
              activeTab === 'menus'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ListOrdered className="w-5 h-5 inline-block mr-2" />
            Menus ({menus.length})
          </button>
        </nav>
      </div>

      {/* Dishes Tab */}
      {activeTab === 'dishes' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search dishes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-10"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input md:w-64"
            >
              <option value="all">All Categories</option>
              <option value="none">Uncategorized</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>

            <button
              onClick={() => {
                setEditingDish(null);
                setShowDishModal(true);
              }}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Dish
            </button>
          </div>

          {/* Category Management */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3">Categories</h3>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <span
                  key={cat.id}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                >
                  {cat.name}
                </span>
              ))}
              {showNewCategoryInput ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Category name"
                    className="input py-1 px-3 text-sm"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') handleCreateCategory();
                    }}
                  />
                  <button onClick={handleCreateCategory} className="btn-primary py-1 px-3 text-sm">
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowNewCategoryInput(false);
                      setNewCategoryName('');
                    }}
                    className="btn-secondary py-1 px-3 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewCategoryInput(true)}
                  className="px-3 py-1 border-2 border-dashed border-gray-300 text-gray-600 rounded-full text-sm hover:border-gray-400 hover:text-gray-700 transition-colors"
                >
                  + Add Category
                </button>
              )}
            </div>
          </div>

          {/* Dishes Grid */}
          {isLoading && dishes.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
          ) : filteredDishes.length === 0 ? (
            <div className="card text-center py-12">
              <ChefHat className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">
                {searchQuery || selectedCategory !== 'all'
                  ? 'No dishes found matching your filters'
                  : 'No dishes yet. Create your first dish to get started!'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDishes.map((dish) => (
                <DishCard
                  key={dish.id}
                  dish={dish}
                  onEdit={() => {
                    setEditingDish(dish);
                    setShowDishModal(true);
                  }}
                  onDelete={() => handleDeleteDish(dish.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Menus Tab */}
      {activeTab === 'menus' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
            <div className="flex-1">
              {activeMenu && (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-800 rounded-lg">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">{activeMenu.name}</span>
                  <span className="text-sm">is currently published</span>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowNewMenuModal(true)}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Menu
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Menu List */}
            <div className="lg:col-span-1">
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-4">Your Menus</h3>
                <div className="space-y-2">
                  {menus.map((menu) => (
                    <button
                      key={menu.id}
                      onClick={() => setCurrentMenu(menu)}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                        currentMenu?.id === menu.id
                          ? 'bg-primary-50 text-primary-900'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="font-medium">{menu.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            menu.status === 'published'
                              ? 'bg-green-100 text-green-800'
                              : menu.status === 'draft'
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {menu.status}
                        </span>
                        <span className="text-xs text-gray-500">
                          {menu.items?.length || 0} items
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Menu Editor */}
            <div className="lg:col-span-2">
              {currentMenu ? (
                <div className="card">
                  <div className="mb-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">{currentMenu.name}</h2>
                        {currentMenu.description && (
                          <p className="text-gray-600 mt-1">{currentMenu.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {currentMenu.status === 'draft' && (
                          <button
                            onClick={handlePublishMenu}
                            className="btn-primary inline-flex items-center gap-2"
                          >
                            <Upload className="w-4 h-4" />
                            Publish
                          </button>
                        )}
                        {currentMenu.status === 'published' && (
                          <button
                            onClick={handleArchiveMenu}
                            className="btn-secondary inline-flex items-center gap-2"
                          >
                            <Archive className="w-4 h-4" />
                            Archive
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Menu Items</h3>
                    {currentMenu.items && currentMenu.items.length > 0 ? (
                      <div className="space-y-2">
                        {currentMenu.items.map((item) => (
                          <div
                            key={item.dish_id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                          >
                            <div className="flex-1">
                              <div className="font-medium">{item.dish?.name}</div>
                              <div className="text-sm text-gray-600">
                                ${((item.price_override_cents || item.dish?.price_cents || 0) / 100).toFixed(2)}
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemoveFromMenu(item.dish_id)}
                              className="btn-secondary text-sm"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No items in this menu yet.</p>
                    )}
                  </div>

                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h3 className="font-semibold text-gray-900 mb-3">Add Dishes</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                      {dishes
                        .filter(
                          (dish) =>
                            !currentMenu.items?.some((item) => item.dish_id === dish.id)
                        )
                        .map((dish) => (
                          <button
                            key={dish.id}
                            onClick={() => handleAddToMenu(dish.id)}
                            className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-left"
                          >
                            <div className="w-12 h-12 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                              {dish.image_url ? (
                                <img
                                  src={dish.image_url}
                                  alt={dish.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <ChefHat className="w-5 h-5 text-gray-400" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{dish.name}</div>
                              <div className="text-sm text-gray-600">
                                ${(dish.price_cents / 100).toFixed(2)}
                              </div>
                            </div>
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="card text-center py-12">
                  <ListOrdered className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">
                    Select a menu to edit or create a new one
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showDishModal && (
        <DishFormModal
          dish={editingDish}
          categories={categories}
          onClose={() => {
            setShowDishModal(false);
            setEditingDish(null);
          }}
          onSubmit={editingDish ? handleUpdateDish : handleCreateDish}
        />
      )}

      {showNewMenuModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Create New Menu</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="menu-name" className="label">
                  Menu Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="menu-name"
                  type="text"
                  value={newMenuName}
                  onChange={(e) => setNewMenuName(e.target.value)}
                  className="input"
                  placeholder="Spring Menu 2024"
                />
              </div>
              <div>
                <label htmlFor="menu-description" className="label">
                  Description
                </label>
                <textarea
                  id="menu-description"
                  value={newMenuDescription}
                  onChange={(e) => setNewMenuDescription(e.target.value)}
                  className="input min-h-[80px]"
                  placeholder="Optional description..."
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={handleCreateMenu} className="btn-primary">
                  Create Menu
                </button>
                <button
                  onClick={() => {
                    setShowNewMenuModal(false);
                    setNewMenuName('');
                    setNewMenuDescription('');
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
