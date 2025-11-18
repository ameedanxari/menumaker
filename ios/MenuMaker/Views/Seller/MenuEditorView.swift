import SwiftUI

struct MenuEditorView: View {
    @StateObject private var viewModel = DishViewModel()
    @State private var showAddDish = false
    @State private var selectedCategory: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Search and Filter
                SearchBar(text: $viewModel.searchQuery)

                CategoryFilter(
                    categories: viewModel.categories,
                    selectedCategory: $selectedCategory
                )

                // Dishes List
                if viewModel.isLoading {
                    ProgressView()
                        .padding()
                } else if viewModel.filteredDishes.isEmpty {
                    EmptyState(
                        icon: "fork.knife",
                        title: "No Dishes",
                        message: "Add your first dish to get started"
                    )
                } else {
                    ForEach(viewModel.filteredDishes) { dish in
                        DishCard(dish: dish, viewModel: viewModel)
                    }
                    .onDelete { indexSet in
                        for index in indexSet {
                            let dish = viewModel.filteredDishes[index]
                            Task {
                                await viewModel.deleteDish(dish.id)
                            }
                        }
                    }
                }
            }
            .padding()
        }
        .background(Color.theme.background)
        .navigationTitle("Menu")
        .accessibilityIdentifier("menu-editor-screen")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: { showAddDish = true }) {
                    Image(systemName: "plus.circle.fill")
                }
                .accessibilityLabel("Add Item")
                .accessibilityIdentifier("add-item-button")
            }
        }
        .sheet(isPresented: $showAddDish) {
            AddDishView(viewModel: viewModel)
        }
        .refreshable {
            await viewModel.refreshDishes()
        }
    }
}

struct DishCard: View {
    let dish: Dish
    @ObservedObject var viewModel: DishViewModel
    @State private var showEdit = false

    var body: some View {
        HStack(spacing: 12) {
            // Image
            if let imageUrl = dish.imageUrl {
                AsyncImage(url: URL(string: imageUrl)) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Image(systemName: "photo")
                        .foregroundColor(.gray)
                }
                .frame(width: 60, height: 60)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }

            // Info
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(dish.name)
                        .font(.subheadline)
                        .fontWeight(.semibold)

                    Text(dish.vegetarianBadge)
                        .font(.caption)
                }

                Text(dish.formattedPrice)
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(.theme.primary)

                if let category = dish.category {
                    Text(category)
                        .font(.caption2)
                        .foregroundColor(.theme.textSecondary)
                }
            }

            Spacer()

            // Availability Toggle
            Toggle("", isOn: Binding(
                get: { dish.isAvailable },
                set: { _ in
                    Task {
                        await viewModel.toggleAvailability(dish.id)
                    }
                }
            ))
            .labelsHidden()
            .accessibility(label: Text("Available"))
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(AppConstants.UI.cornerRadius)
        .accessibilityIdentifier("MenuItemCell")
        .onTapGesture {
            showEdit = true
        }
        .sheet(isPresented: $showEdit) {
            EditDishView(dish: dish, viewModel: viewModel)
        }
    }
}

struct CategoryFilter: View {
    let categories: [String]
    @Binding var selectedCategory: String?

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                FilterChip(title: "All", isSelected: selectedCategory == nil) {
                    selectedCategory = nil
                }

                ForEach(categories, id: \.self) { category in
                    FilterChip(title: category, isSelected: selectedCategory == category) {
                        selectedCategory = category
                    }
                }
            }
            .padding(.horizontal)
        }
    }
}

struct FilterChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.caption)
                .fontWeight(.medium)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isSelected ? Color.theme.primary : Color.theme.surface)
                .foregroundColor(isSelected ? .white : .theme.text)
                .cornerRadius(16)
        }
    }
}

struct AddDishView: View {
    @ObservedObject var viewModel: DishViewModel
    @Environment(\.dismiss) var dismiss
    @State private var name = ""
    @State private var description = ""
    @State private var price = ""
    @State private var category = ""
    @State private var isVegetarian = false
    @State private var isAvailable = true

    var body: some View {
        NavigationView {
            Form {
                Section("Basic Information") {
                    TextField("Item Name", text: $name)
                        .accessibilityIdentifier("item-name-field")

                    VStack(alignment: .leading) {
                        TextEditor(text: $description)
                            .frame(minHeight: 80)
                            .overlay(
                                Group {
                                    if description.isEmpty {
                                        Text("Description")
                                            .foregroundColor(.gray)
                                            .padding(.leading, 4)
                                            .padding(.top, 8)
                                            .allowsHitTesting(false)
                                    }
                                },
                                alignment: .topLeading
                            )
                    }
                    .accessibilityIdentifier("item-description-field")

                    TextField("Price", text: $price)
                        .keyboardType(.decimalPad)
                        .accessibilityIdentifier("item-price-field")

                    TextField("Category", text: $category)
                        .accessibilityIdentifier("item-category-field")

                    Button(action: {
                        // Photo upload functionality placeholder
                    }) {
                        HStack {
                            Image(systemName: "photo")
                            Text("Upload Photo")
                        }
                    }
                    .accessibility(label: Text("Upload Photo"))
                }

                Section("Options") {
                    Toggle("Vegetarian", isOn: $isVegetarian)
                    Toggle("Available", isOn: $isAvailable)
                        .accessibility(label: Text("Available"))
                }
            }
            .navigationTitle("Add Dish")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") { dismiss() }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save") {
                        Task {
                            await saveDish()
                        }
                    }
                    .disabled(name.isEmpty || price.isEmpty)
                }
            }
        }
    }

    private func saveDish() async {
        guard let priceValue = Double(price) else { return }

        await viewModel.createDish(DishViewModel.CreateDishParams(
            name: name,
            description: description.isEmpty ? nil : description,
            price: priceValue,
            category: category.isEmpty ? nil : category,
            isVegetarian: isVegetarian,
            isAvailable: isAvailable,
            image: nil
        ))

        dismiss()
    }
}

// MARK: - Edit Dish View

struct EditDishView: View {
    let dish: Dish
    @ObservedObject var viewModel: DishViewModel
    @Environment(\.dismiss) var dismiss
    @State private var name: String
    @State private var description: String
    @State private var price: String
    @State private var category: String
    @State private var isVegetarian: Bool
    @State private var isAvailable: Bool

    init(dish: Dish, viewModel: DishViewModel) {
        self.dish = dish
        self.viewModel = viewModel
        _name = State(initialValue: dish.name)
        _description = State(initialValue: dish.description ?? "")
        _price = State(initialValue: String(format: "%.0f", Double(dish.priceCents) / 100.0))
        _category = State(initialValue: dish.category ?? "")
        _isVegetarian = State(initialValue: dish.isVegetarian)
        _isAvailable = State(initialValue: dish.isAvailable)
    }

    var body: some View {
        NavigationView {
            Form {
                Section("Basic Information") {
                    TextField("Item Name", text: $name)
                        .accessibilityIdentifier("item-name-field")

                    VStack(alignment: .leading) {
                        TextEditor(text: $description)
                            .frame(minHeight: 80)
                            .overlay(
                                Group {
                                    if description.isEmpty {
                                        Text("Description")
                                            .foregroundColor(.gray)
                                            .padding(.leading, 4)
                                            .padding(.top, 8)
                                            .allowsHitTesting(false)
                                    }
                                },
                                alignment: .topLeading
                            )
                    }
                    .accessibilityIdentifier("item-description-field")

                    TextField("Price", text: $price)
                        .keyboardType(.decimalPad)
                        .accessibilityIdentifier("item-price-field")

                    TextField("Category", text: $category)
                        .accessibilityIdentifier("item-category-field")

                    Button(action: {
                        // Photo upload functionality placeholder
                    }) {
                        HStack {
                            Image(systemName: "photo")
                            Text("Upload Photo")
                        }
                    }
                    .accessibility(label: Text("Upload Photo"))
                }

                Section("Options") {
                    Toggle("Vegetarian", isOn: $isVegetarian)
                    Toggle("Available", isOn: $isAvailable)
                        .accessibility(label: Text("Available"))
                }
            }
            .navigationTitle("Edit Dish")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") { dismiss() }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save") {
                        Task {
                            await updateDish()
                        }
                    }
                    .disabled(name.isEmpty || price.isEmpty)
                }
            }
        }
    }

    private func updateDish() async {
        guard let priceValue = Double(price) else { return }

        await viewModel.updateDish(dish.id, params: DishViewModel.CreateDishParams(
            name: name,
            description: description.isEmpty ? nil : description,
            price: priceValue,
            category: category.isEmpty ? nil : category,
            isVegetarian: isVegetarian,
            isAvailable: isAvailable,
            image: nil
        ))

        dismiss()
    }
}

#Preview {
    NavigationView {
        MenuEditorView()
    }
}
