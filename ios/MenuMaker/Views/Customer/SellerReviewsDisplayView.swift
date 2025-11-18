import SwiftUI

/// View for displaying all reviews on a seller profile
struct SellerReviewsDisplayView: View {
    let businessId: String
    @StateObject private var viewModel = ReviewViewModel()
    @State private var showSortOptions = false
    @State private var showReportDialog = false
    @State private var selectedReviewId: String?
    @State private var reportReason = ""

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Rating Summary
                ratingSummarySection

                // Filter Buttons
                filterSection

                // Sort Button
                sortButton

                // Reviews List
                reviewsListSection
            }
            .padding()
        }
        .background(Color.theme.background)
        .navigationTitle("Reviews")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.loadReviews()
        }
        .refreshable {
            await viewModel.refreshReviews()
        }
        .actionSheet(isPresented: $showSortOptions) {
            ActionSheet(
                title: Text("Sort Reviews"),
                buttons: [
                    .default(Text("Most Recent")) {
                        viewModel.sortByMostRecent()
                    },
                    .default(Text("Most Helpful")) {
                        viewModel.sortByMostHelpful()
                    },
                    .default(Text("Highest Rating")) {
                        viewModel.sortByHighestRating()
                    },
                    .default(Text("Lowest Rating")) {
                        viewModel.sortByLowestRating()
                    },
                    .cancel()
                ]
            )
        }
        .alert("Report Review", isPresented: $showReportDialog) {
            TextField("Reason", text: $reportReason)
            Button("Report", role: .destructive) {
                if let reviewId = selectedReviewId {
                    Task {
                        await viewModel.reportReview(reviewId, reason: reportReason)
                    }
                }
                reportReason = ""
            }
            Button("Cancel", role: .cancel) {
                reportReason = ""
            }
        } message: {
            Text("Please provide a reason for reporting this review")
        }
    }

    // MARK: - Rating Summary Section

    private var ratingSummarySection: some View {
        VStack(spacing: 16) {
            // Average Rating
            HStack(spacing: 16) {
                VStack {
                    Text(viewModel.getFormattedAverageRating())
                        .font(.system(size: 48, weight: .bold))
                        .foregroundColor(.theme.primary)
                        .accessibilityIdentifier("average-rating")

                    HStack(spacing: 4) {
                        ForEach(1...5, id: \.self) { index in
                            Image(systemName: index <= Int(viewModel.averageRating.rounded()) ? "star.fill" : "star")
                                .foregroundColor(.yellow)
                                .font(.caption)
                        }
                    }

                    Text("\(viewModel.totalReviews) reviews")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .accessibilityIdentifier("total-reviews-count")
                }
                .frame(maxWidth: .infinity)

                // Rating Distribution
                if let distribution = viewModel.ratingDistribution {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach([5, 4, 3, 2, 1], id: \.self) { rating in
                            RatingBar(
                                rating: rating,
                                count: viewModel.getRatingCount(for: rating),
                                percentage: distribution.percentage(for: rating)
                            )
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
            }
        }
        .padding()
        .background(Color.white)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 2)
    }

    // MARK: - Filter Section

    private var filterSection: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                FilterChip(
                    title: "All",
                    isSelected: viewModel.selectedRatingFilter == nil
                ) {
                    viewModel.filterByRating(nil)
                }
                .accessibilityIdentifier("filter-all")

                ForEach([5, 4, 3, 2, 1], id: \.self) { rating in
                    FilterChip(
                        title: "\(rating) ★",
                        isSelected: viewModel.selectedRatingFilter == rating
                    ) {
                        viewModel.filterByRating(rating)
                    }
                    .accessibilityIdentifier("filter-\(rating)-star")
                }
            }
        }
    }

    // MARK: - Sort Button

    private var sortButton: some View {
        Button(action: { showSortOptions = true }) {
            HStack {
                Text("Sort")
                    .fontWeight(.medium)
                Image(systemName: "arrow.up.arrow.down")
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(Color.theme.surface)
            .foregroundColor(.theme.primary)
            .cornerRadius(20)
        }
        .accessibilityLabel("Sort")
        .frame(maxWidth: .infinity, alignment: .trailing)
    }

    // MARK: - Reviews List Section

    private var reviewsListSection: some View {
        VStack(spacing: 16) {
            if viewModel.isLoading && viewModel.filteredReviews.isEmpty {
                ProgressView()
                    .padding()
            } else if viewModel.filteredReviews.isEmpty {
                EmptyState(
                    icon: "star.slash",
                    title: "No Reviews Yet",
                    message: "Be the first to review!"
                )
                .accessibilityIdentifier("empty-state")
            } else {
                ForEach(viewModel.filteredReviews) { review in
                    ReviewItemView(
                        review: review,
                        onHelpful: {
                            Task {
                                await viewModel.markReviewAsHelpful(review.id)
                            }
                        },
                        onReport: {
                            selectedReviewId = review.id
                            showReportDialog = true
                        }
                    )
                    .accessibilityIdentifier("ReviewItem")
                }
            }
        }
    }
}

// MARK: - Rating Bar

struct RatingBar: View {
    let rating: Int
    let count: Int
    let percentage: Double

    var body: some View {
        HStack(spacing: 8) {
            Text("\(rating) ★")
                .font(.caption)
                .frame(width: 40, alignment: .leading)

            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    Rectangle()
                        .fill(Color.gray.opacity(0.2))
                        .frame(height: 4)

                    Rectangle()
                        .fill(Color.yellow)
                        .frame(width: geometry.size.width * (percentage / 100), height: 4)
                }
            }
            .frame(height: 4)

            Text("\(count)")
                .font(.caption)
                .foregroundColor(.secondary)
                .frame(width: 30, alignment: .trailing)
        }
    }
}

// MARK: - Review Item View

struct ReviewItemView: View {
    let review: Review
    let onHelpful: () -> Void
    let onReport: () -> Void

    @State private var isExpanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header (Name + Rating)
            HStack {
                Text(review.customerName)
                    .font(.headline)
                    .accessibilityIdentifier("reviewer-name")

                Spacer()

                HStack(spacing: 4) {
                    ForEach(1...5, id: \.self) { index in
                        Image(systemName: index <= review.rating ? "star.fill" : "star")
                            .foregroundColor(.yellow)
                            .font(.caption)
                    }
                }
            }

            // Date
            Text(review.formattedDate)
                .font(.caption)
                .foregroundColor(.secondary)

            // Comment
            if let comment = review.comment {
                Text(comment)
                    .font(.body)
                    .lineLimit(isExpanded ? nil : 3)
            }

            // Photos
            if let imageUrls = review.imageUrls, !imageUrls.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(imageUrls, id: \.self) { url in
                            AsyncImage(url: URL(string: url)) { image in
                                image
                                    .resizable()
                                    .scaledToFill()
                            } placeholder: {
                                Rectangle()
                                    .fill(Color.gray.opacity(0.2))
                            }
                            .frame(width: 80, height: 80)
                            .cornerRadius(8)
                            .accessibilityIdentifier("ReviewPhoto")
                        }
                    }
                }
            }

            // Seller Reply
            if let sellerReply = review.sellerReply {
                VStack(alignment: .leading, spacing: 8) {
                    Divider()

                    HStack {
                        Image(systemName: "storefront")
                            .foregroundColor(.theme.primary)
                        Text("Seller Reply")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.theme.primary)
                        Spacer()
                        Text(sellerReply.formattedDate)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .accessibilityIdentifier("seller-reply-label")

                    Text(sellerReply.reply)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .padding(.top, 4)
            }

            // Action Buttons
            HStack(spacing: 16) {
                Button(action: onHelpful) {
                    HStack(spacing: 4) {
                        Image(systemName: review.isHelpful ? "hand.thumbsup.fill" : "hand.thumbsup")
                        Text("Helpful (\(review.helpfulCount))")
                            .font(.caption)
                    }
                    .foregroundColor(review.isHelpful ? .theme.primary : .secondary)
                }
                .accessibilityLabel("Helpful")

                Spacer()

                Button(action: {
                    isExpanded.toggle()
                }) {
                    Text(isExpanded ? "Show Less" : "Show More")
                        .font(.caption)
                        .foregroundColor(.theme.primary)
                }

                Button(action: onReport) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.caption)
                        .foregroundColor(review.isReported ? .red : .secondary)
                }
                .accessibilityLabel("Report")
                .disabled(review.isReported)
            }
        }
        .padding()
        .background(Color.white)
        .cornerRadius(12)
        .shadow(color: Color.black.opacity(0.05), radius: 4, x: 0, y: 2)
    }
}

// MARK: - Filter Chip

struct FilterChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline)
                .fontWeight(isSelected ? .semibold : .regular)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(isSelected ? Color.theme.primary : Color.theme.surface)
                .foregroundColor(isSelected ? .white : .primary)
                .cornerRadius(20)
        }
    }
}

#Preview {
    NavigationView {
        SellerReviewsDisplayView(businessId: "test-business-id")
    }
}
