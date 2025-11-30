import SwiftUI

struct SellerMenuView: View {
    let businessId: String
    @StateObject private var dishViewModel = DishViewModel()
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
                    .onAppear {
                        print("DEBUG: SellerMenuView - Loading dishes...")
                    }
            } else if filteredDishes.isEmpty {
                EmptyState(
                    icon: "fork.knife",
                    title: "No Menu Items",
                    message: "This seller hasn't added any menu items yet"
                )
                .onAppear {
                    print("DEBUG: SellerMenuView - No dishes found. Total dishes: \(dishViewModel.dishes.count), isLoading: \(dishViewModel.isLoading)")
                }
            } else {
                ScrollView {
                    VStack(spacing: 12) {
                        ForEach(filteredDishes) { dish in
                            MenuItemCard(dish: dish, onAddToCart: {
                                addToCart(dish)
                            })
                            .onAppear {
                                print("DEBUG: SellerMenuView - Rendering MenuItemCard for: \(dish.name)")
                            }
                        }
                    }
                    .padding()
                }
                .onAppear {
                    print("DEBUG: SellerMenuView - Showing \(filteredDishes.count) dishes")
                }
            }
        }
        .background(Color.theme.background)
        .navigationTitle("Menu")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            print("DEBUG: SellerMenuView - Starting to load dishes for businessId: \(businessId)")
            await dishViewModel.loadDishesByBusiness(businessId)
            print("DEBUG: SellerMenuView - Finished loading. Dishes count: \(dishViewModel.dishes.count)")
        }
    }

    private var filteredDishes: [Dish] {
        if let category = selectedCategory {
            return dishViewModel.dishes.filter { $0.category == category }
        }
        return dishViewModel.dishes
    }

    private func addToCart(_ dish: Dish) {
        CartRepository.shared.addItem(dish, businessId: businessId)
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
                print("DEBUG: Add to cart button tapped for dish: \(dish.name)")
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
            .accessibilityIdentifier("add-to-cart-button")
            .accessibilityLabel("Add to cart")
            .onAppear {
                print("DEBUG: MenuItemCard button appeared for dish: \(dish.name) with identifier: add-to-cart-button")
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("MenuItem")
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
