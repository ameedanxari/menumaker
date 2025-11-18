import SwiftUI

/// View for sellers to manage their reviews and replies
struct SellerReviewsView: View {
    @StateObject private var viewModel = ReviewViewModel()
    @State private var showSortOptions = false
    @State private var selectedReview: Review?
    @State private var replyText = ""
    @State private var showReplySheet = false

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Statistics Card
                statisticsSection

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
        .navigationTitle("My Reviews")
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
        .sheet(isPresented: $showReplySheet) {
            if let review = selectedReview {
                ReplySheet(
                    review: review,
                    replyText: $replyText,
                    onSubmit: {
                        Task {
                            await viewModel.replyToReview(review.id, reply: replyText)
                            showReplySheet = false
                            replyText = ""
                            selectedReview = nil
                        }
                    },
                    onCancel: {
                        showReplySheet = false
                        replyText = ""
                        selectedReview = nil
                    }
                )
            }
        }
    }

    // MARK: - Statistics Section

    private var statisticsSection: some View {
        VStack(spacing: 20) {
            // Average Rating
            HStack(spacing: 40) {
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

                    Text("\(viewModel.totalReviews) Total Reviews")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .accessibilityIdentifier("total-reviews-count")
                }

                // Stats Grid
                VStack(spacing: 12) {
                    StatRow(label: "5 ★", count: viewModel.getRatingCount(for: 5))
                    StatRow(label: "4 ★", count: viewModel.getRatingCount(for: 4))
                    StatRow(label: "3 ★", count: viewModel.getRatingCount(for: 3))
                    StatRow(label: "2 ★", count: viewModel.getRatingCount(for: 2))
                    StatRow(label: "1 ★", count: viewModel.getRatingCount(for: 1))
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

                ForEach([5, 4, 3, 2, 1], id: \.self) { rating in
                    FilterChip(
                        title: "\(rating) ★",
                        isSelected: viewModel.selectedRatingFilter == rating
                    ) {
                        viewModel.filterByRating(rating)
                    }
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
                    message: "Your reviews will appear here"
                )
                .accessibilityIdentifier("empty-state")
            } else {
                ForEach(viewModel.filteredReviews) { review in
                    SellerReviewItemView(
                        review: review,
                        onReply: {
                            selectedReview = review
                            if let existingReply = review.sellerReply {
                                replyText = existingReply.reply
                            }
                            showReplySheet = true
                        }
                    )
                    .accessibilityIdentifier("ReviewItem")
                }
            }
        }
    }
}

// MARK: - Stat Row

struct StatRow: View {
    let label: String
    let count: Int

    var body: some View {
        HStack {
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
                .frame(width: 40, alignment: .leading)

            Spacer()

            Text("\(count)")
                .font(.caption)
                .fontWeight(.medium)
        }
    }
}

// MARK: - Seller Review Item View

struct SellerReviewItemView: View {
    let review: Review
    let onReply: () -> Void

    @State private var isExpanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(review.customerName)
                        .font(.headline)

                    HStack(spacing: 4) {
                        ForEach(1...5, id: \.self) { index in
                            Image(systemName: index <= review.rating ? "star.fill" : "star")
                                .foregroundColor(.yellow)
                                .font(.caption)
                        }

                        Text(review.formattedDate)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .padding(.leading, 4)
                    }
                }

                Spacer()

                // Reply Badge
                if review.hasSellerReply {
                    HStack(spacing: 4) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                            .font(.caption)
                        Text("Replied")
                            .font(.caption)
                            .foregroundColor(.green)
                    }
                } else {
                    Text("New")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.orange.opacity(0.2))
                        .foregroundColor(.orange)
                        .cornerRadius(8)
                }
            }

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
                        }
                    }
                }
            }

            // Your Reply
            if let sellerReply = review.sellerReply {
                VStack(alignment: .leading, spacing: 8) {
                    Divider()

                    HStack {
                        Text("Your Reply")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.theme.primary)
                        Spacer()
                        Text(sellerReply.formattedDate)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    Text(sellerReply.reply)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .padding(.top, 4)
            }

            // Actions
            HStack {
                Button(action: {
                    isExpanded.toggle()
                }) {
                    Text(isExpanded ? "Show Less" : "Show More")
                        .font(.caption)
                        .foregroundColor(.theme.primary)
                }

                Spacer()

                Button(action: onReply) {
                    HStack(spacing: 4) {
                        Image(systemName: review.hasSellerReply ? "pencil" : "arrowshape.turn.up.left")
                        Text(review.hasSellerReply ? "Edit Reply" : "Reply")
                    }
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color.theme.primary)
                    .cornerRadius(12)
                }
                .accessibilityLabel("Reply")
            }
        }
        .padding()
        .background(Color.white)
        .cornerRadius(12)
        .shadow(color: Color.black.opacity(0.05), radius: 4, x: 0, y: 2)
    }
}

// MARK: - Reply Sheet

struct ReplySheet: View {
    let review: Review
    @Binding var replyText: String
    let onSubmit: () -> Void
    let onCancel: () -> Void

    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                // Review Summary
                VStack(alignment: .leading, spacing: 12) {
                    Text("Replying to:")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    HStack {
                        Text(review.customerName)
                            .font(.headline)

                        HStack(spacing: 4) {
                            ForEach(1...5, id: \.self) { index in
                                Image(systemName: index <= review.rating ? "star.fill" : "star")
                                    .foregroundColor(.yellow)
                                    .font(.caption)
                            }
                        }
                    }

                    if let comment = review.comment {
                        Text(comment)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .lineLimit(3)
                    }
                }
                .padding()
                .background(Color.theme.surface)
                .cornerRadius(12)

                // Reply Field
                VStack(alignment: .leading, spacing: 8) {
                    Text("Your Reply")
                        .font(.headline)

                    ZStack(alignment: .topLeading) {
                        if replyText.isEmpty {
                            Text("Thank you for your feedback...")
                                .foregroundColor(.secondary)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 12)
                        }

                        TextEditor(text: $replyText)
                            .frame(minHeight: 120)
                            .padding(4)
                            .background(Color.theme.surface)
                            .cornerRadius(8)
                    }

                    Text("\(replyText.count)/500 characters")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                }

                Spacer()

                // Submit Button
                Button(action: onSubmit) {
                    Text(review.hasSellerReply ? "Update Reply" : "Send Reply")
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(!replyText.isEmpty ? Color.theme.primary : Color.gray)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                }
                .disabled(replyText.isEmpty)
                .accessibilityLabel("Send")
            }
            .padding()
            .background(Color.theme.background)
            .navigationTitle("Reply to Review")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        onCancel()
                    }
                }
            }
        }
    }
}

#Preview {
    NavigationView {
        SellerReviewsView()
    }
}
