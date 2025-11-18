import SwiftUI

struct FavoritesView: View {
    @StateObject private var viewModel = FavoriteViewModel()
    @State private var showDeleteConfirmation = false
    @State private var favoriteToDelete: Favorite?

    var body: some View {
        VStack(spacing: 0) {
            // Search Bar
            if !viewModel.favorites.isEmpty {
                SearchBar(text: $viewModel.searchQuery)
                    .padding()
                    .accessibilityIdentifier("favorites-search-bar")
            }

            // Favorites List
            if viewModel.isLoading && viewModel.favorites.isEmpty {
                ProgressView()
                    .frame(maxHeight: .infinity)
                    .accessibilityIdentifier("loading-indicator")
            } else if viewModel.filteredFavorites.isEmpty {
                EmptyState(
                    icon: "heart",
                    title: "No Favorites",
                    message: viewModel.searchQuery.isEmpty ?
                        "Save your favorite sellers to quickly access them later" :
                        "No favorites match your search"
                )
                .accessibilityIdentifier("empty-favorites-state")

                if viewModel.searchQuery.isEmpty {
                    Button(action: {
                        // Navigate to marketplace
                    }) {
                        Text("Explore Sellers")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .padding()
                    .accessibilityIdentifier("explore-button")
                }
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(viewModel.filteredFavorites) { favorite in
                            if let business = favorite.business {
                                FavoriteCard(
                                    favorite: favorite,
                                    onRemove: {
                                        favoriteToDelete = favorite
                                        showDeleteConfirmation = true
                                    }
                                )
                                .accessibilityIdentifier("FavoriteItem")
                            }
                        }
                    }
                    .padding()
                }
            }
        }
        .background(Color.theme.background)
        .navigationTitle("Favorites")
        .navigationBarTitleDisplayMode(.large)
        .accessibilityIdentifier("favorites-screen")
        .refreshable {
            await viewModel.refreshFavorites()
        }
        .confirmationDialog(
            "Remove Favorite",
            isPresented: $showDeleteConfirmation,
            presenting: favoriteToDelete
        ) { favorite in
            Button("Remove", role: .destructive) {
                Task {
                    await viewModel.removeFavorite(favorite.id)
                }
            }
        } message: { favorite in
            Text("Remove \(favorite.business?.name ?? "this seller") from favorites?")
        }
        .alert("Error", isPresented: .constant(viewModel.errorMessage != nil)) {
            Button("OK") {
                viewModel.clearError()
            }
        } message: {
            Text(viewModel.errorMessage ?? "")
        }
    }
}

struct FavoriteCard: View {
    let favorite: Favorite
    let onRemove: () -> Void

    var business: Business? {
        favorite.business
    }

    var body: some View {
        NavigationLink(destination: business.map { SellerMenuView(businessId: $0.id) }) {
            HStack(spacing: 12) {
                // Business Logo
                if let logoUrl = business?.logoUrl {
                    AsyncImage(url: URL(string: logoUrl)) { image in
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    } placeholder: {
                        Rectangle()
                            .fill(Color.gray.opacity(0.2))
                    }
                    .frame(width: 60, height: 60)
                    .cornerRadius(AppConstants.UI.smallCornerRadius)
                } else {
                    Image(systemName: "storefront")
                        .font(.title)
                        .foregroundColor(.secondary)
                        .frame(width: 60, height: 60)
                        .background(Color.gray.opacity(0.2))
                        .cornerRadius(AppConstants.UI.smallCornerRadius)
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text(business?.name ?? "Unknown")
                        .font(.headline)
                        .foregroundColor(.primary)

                    if let description = business?.description {
                        Text(description)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .lineLimit(2)
                    }

                    Text("Added \(favorite.formattedDate)")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .foregroundColor(.secondary)
                    .font(.caption)
            }
            .padding()
            .background(Color.theme.surface)
            .cornerRadius(AppConstants.UI.cornerRadius)
            .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                Button(role: .destructive) {
                    onRemove()
                } label: {
                    Label("Delete", systemImage: "trash")
                }
            }
        }
        .buttonStyle(PlainButtonStyle())
    }
}

#Preview {
    NavigationView {
        FavoritesView()
    }
}
