import SwiftUI

struct MarketplaceView: View {
    @StateObject private var viewModel = MarketplaceViewModel()
    @State private var selectedCuisine: String?
    @State private var showSortOptions = false

    var body: some View {
        VStack(spacing: 0) {
            // Search Bar
            SearchBar(text: $viewModel.searchQuery)
                .padding()
                .accessibilityIdentifier("marketplace-search-bar")

            // Cuisine Filter
            CuisineFilter(
                cuisines: viewModel.getCuisineTypes(),
                selectedCuisine: $selectedCuisine
            )
            .accessibilityIdentifier("cuisine-filter")

            // Sellers Grid
            if viewModel.filteredSellers.isEmpty && !viewModel.isLoading {
                EmptyState(
                    icon: "storefront",
                    title: "No Sellers",
                    message: "No sellers found matching your criteria"
                )
                .accessibilityIdentifier("empty-marketplace-state")
            } else {
                ScrollView {
                    LazyVStack(spacing: 16) {
                        ForEach(viewModel.filteredSellers) { seller in
                            SellerCard(seller: seller)
                                .accessibilityIdentifier("seller-card-\(seller.id)")
                        }
                    }
                    .padding()
                }
                .accessibilityIdentifier("sellers-list")
            }
        }
        .background(Color.theme.background)
        .navigationTitle("Marketplace")
        .navigationBarTitleDisplayMode(.large)
        .accessibilityIdentifier("marketplace-screen")
        .navigationBarItems(trailing: Button(action: {
            showSortOptions = true
        }) {
            Image(systemName: "arrow.up.arrow.down")
        }
        .accessibilityIdentifier("sort-button"))
        .actionSheet(isPresented: $showSortOptions) {
            ActionSheet(
                title: Text("Sort By"),
                buttons: [
                    .default(Text("Distance")) {
                        viewModel.sortByDistance()
                    },
                    .default(Text("Rating")) {
                        viewModel.sortByRating()
                    },
                    .default(Text("Reviews")) {
                        viewModel.sortByReviews()
                    },
                    .cancel()
                ]
            )
        }
        .refreshable {
            await viewModel.refreshSellers()
        }
        .onChange(of: selectedCuisine) { newValue in
            viewModel.filterByCuisine(newValue)
        }
        .overlay(
            Group {
                if viewModel.isLoading {
                    ProgressView()
                        .padding()
                        .background(Color.theme.background.opacity(0.8))
                        .accessibilityIdentifier("loading-indicator")
                }
            }
        )
    }
}

struct CuisineFilter: View {
    let cuisines: [String]
    @Binding var selectedCuisine: String?

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                FilterChip(title: "All", isSelected: selectedCuisine == nil) {
                    selectedCuisine = nil
                }
                .accessibilityIdentifier("filter-all")

                ForEach(cuisines, id: \.self) { cuisine in
                    FilterChip(title: cuisine, isSelected: selectedCuisine == cuisine) {
                        selectedCuisine = cuisine
                    }
                    .accessibilityIdentifier("filter-\(cuisine.lowercased().replacingOccurrences(of: " ", with: "-"))")
                }
            }
            .padding(.horizontal)
        }
        .background(Color.theme.surface)
    }
}

struct SellerCard: View {
    let seller: MarketplaceSeller

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Logo
            if let logoUrl = seller.logoUrl {
                AsyncImage(url: URL(string: logoUrl)) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Image(systemName: "photo")
                        .foregroundColor(.gray)
                }
                .frame(height: 150)
                .frame(maxWidth: .infinity)
                .clipped()
            }

            VStack(alignment: .leading, spacing: 8) {
                // Name
                Text(seller.name)
                    .font(.headline)

                // Cuisine
                Text(seller.displayCuisine)
                    .font(.caption)
                    .foregroundColor(.theme.textSecondary)

                // Rating and Distance
                HStack {
                    HStack(spacing: 4) {
                        Image(systemName: "star.fill")
                            .font(.caption)
                            .foregroundColor(.yellow)

                        Text(seller.formattedRating)
                            .font(.caption)
                            .fontWeight(.medium)

                        Text("(\(seller.reviewCount))")
                            .font(.caption)
                            .foregroundColor(.theme.textSecondary)
                    }

                    Spacer()

                    if let distance = seller.formattedDistance {
                        HStack(spacing: 4) {
                            Image(systemName: "location.fill")
                                .font(.caption)
                                .foregroundColor(.theme.primary)

                            Text(distance)
                                .font(.caption)
                                .fontWeight(.medium)
                        }
                    }
                }
            }
            .padding(.horizontal)
            .padding(.bottom)
        }
        .background(Color.theme.surface)
        .cornerRadius(AppConstants.UI.cornerRadius)
    }
}

#Preview {
    NavigationView {
        MarketplaceView()
    }
}
