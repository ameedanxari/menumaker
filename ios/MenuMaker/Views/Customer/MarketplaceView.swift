import SwiftUI

struct MarketplaceView: View {
    @StateObject private var viewModel = MarketplaceViewModel()
    @State private var selectedCuisine: String?

    var body: some View {
        VStack(spacing: 0) {
            // Search Bar
            SearchBar(text: $viewModel.searchQuery)
                .padding()

            // Cuisine Filter
            CuisineFilter(
                cuisines: viewModel.getCuisineTypes(),
                selectedCuisine: $selectedCuisine
            )

            // Sellers Grid
            if viewModel.isLoading {
                ProgressView()
                    .padding()
            } else if viewModel.filteredSellers.isEmpty {
                EmptyState(
                    icon: "storefront",
                    title: "No Sellers",
                    message: "No sellers found matching your criteria"
                )
            } else {
                ScrollView {
                    LazyVStack(spacing: 16) {
                        ForEach(viewModel.filteredSellers) { seller in
                            SellerCard(seller: seller)
                        }
                    }
                    .padding()
                }
            }
        }
        .background(Color.theme.background)
        .navigationTitle("Marketplace")
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Menu(content: {
                    Button("Sort by Distance") {
                        viewModel.sortByDistance()
                    }
                    Button("Sort by Rating") {
                        viewModel.sortByRating()
                    }
                    Button("Sort by Reviews") {
                        viewModel.sortByReviews()
                    }
                }, label: {
                    Image(systemName: "arrow.up.arrow.down")
                })
            }
        }
        .refreshable {
            await viewModel.refreshSellers()
        }
        .onChange(of: selectedCuisine) { newValue in
            viewModel.filterByCuisine(newValue)
        }
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

                ForEach(cuisines, id: \.self) { cuisine in
                    FilterChip(title: cuisine, isSelected: selectedCuisine == cuisine) {
                        selectedCuisine = cuisine
                    }
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
