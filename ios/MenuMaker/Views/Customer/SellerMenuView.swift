import SwiftUI

struct SellerMenuView: View {
    let businessId: String
    @StateObject private var dishViewModel = DishViewModel()
    @StateObject private var cartRepository = CartRepository.shared
    @State private var selectedCategory: String?

    var body: some View {
        VStack(spacing: 0) {
            // Category Filter (if categories exist)
            if !dishViewModel.getCategories().isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        FilterChip(title: "All", isSelected: selectedCategory == nil) {
                            selectedCategory = nil
                        }

                        ForEach(dishViewModel.getCategories(), id: \.self) { category in
                            FilterChip(title: category, isSelected: selectedCategory == category) {
                                selectedCategory = category
                            }
                        }
                    }
                    .padding(.horizontal)
                    .padding(.vertical, 8)
                }
                .background(Color.theme.surface)
            }

            // Menu Items
            if dishViewModel.isLoading && dishViewModel.dishes.isEmpty {
                ProgressView()
                    .frame(maxHeight: .infinity)
            } else if filteredDishes.isEmpty {
                EmptyState(
                    icon: "fork.knife",
                    title: "No Menu Items",
                    message: "This seller hasn't added any menu items yet"
                )
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(filteredDishes) { dish in
                            MenuItemCard(dish: dish, onAddToCart: {
                                addToCart(dish)
                            })
                            .accessibilityIdentifier("MenuItem")
                        }
                    }
                    .padding()
                }
            }
        }
        .background(Color.theme.background)
        .navigationTitle("Menu")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await dishViewModel.loadDishesByBusiness(businessId)
        }
    }

    private var filteredDishes: [Dish] {
        if let category = selectedCategory {
            return dishViewModel.dishes.filter { $0.category == category }
        }
        return dishViewModel.dishes
    }

    private func addToCart(_ dish: Dish) {
        cartRepository.addItem(dish, businessId: businessId)
    }
}

struct MenuItemCard: View {
    let dish: Dish
    let onAddToCart: () -> Void
    @State private var showQuantitySelector = false

    var body: some View {
        HStack(spacing: 12) {
            // Dish Info
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(dish.name)
                        .font(.subheadline)
                        .fontWeight(.semibold)

                    if dish.isVegetarian {
                        Text("🌱")
                            .font(.caption)
                    }
                }

                if let description = dish.description {
                    Text(description)
                        .font(.caption)
                        .foregroundColor(.theme.textSecondary)
                        .lineLimit(2)
                }

                Text(dish.formattedPrice)
                    .font(.subheadline)
                    .fontWeight(.bold)
                    .foregroundColor(.theme.primary)
            }

            Spacer()

            // Image (if available)
            if let imageUrl = dish.imageUrl {
                AsyncImage(url: URL(string: imageUrl)) { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                } placeholder: {
                    Rectangle()
                        .fill(Color.gray.opacity(0.2))
                }
                .frame(width: 80, height: 80)
                .cornerRadius(AppConstants.UI.smallCornerRadius)
            }

            // Add Button
            Button(action: {
                onAddToCart()
                showQuantitySelector = true
                // Hide after animation
                DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
                    showQuantitySelector = false
                }
            }) {
                Image(systemName: "plus")
                    .font(.title3)
                    .foregroundColor(.white)
                    .frame(width: 36, height: 36)
                    .background(Color.theme.primary)
                    .clipShape(Circle())
            }
            .accessibilityLabel("Add to cart")
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(AppConstants.UI.cornerRadius)
    }
}

#Preview {
    NavigationView {
        SellerMenuView(businessId: "test-business-id")
    }
}
