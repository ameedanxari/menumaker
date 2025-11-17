import SwiftUI
import PhotosUI

struct ReviewsView: View {
    @StateObject private var viewModel = ReviewViewModel()
    @Environment(\.dismiss) private var dismiss

    @State private var rating: Int = 5
    @State private var comment: String = ""
    @State private var customerName: String = ""
    @State private var selectedImages: [UIImage] = []
    @State private var showingImagePicker = false

    let businessId: String
    let orderId: String?

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    // Rating Section
                    ratingSection

                    // Comment Section
                    commentSection

                    // Photo Upload Section
                    photoSection

                    // Submit Button
                    submitButton
                }
                .padding()
            }
            .background(Color.theme.background)
            .navigationTitle("Write a Review")
            .navigationBarTitleDisplayMode(.inline)
            .accessibilityIdentifier("review-screen")
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
            .sheet(isPresented: $showingImagePicker) {
                ImagePicker(images: $selectedImages, selectionLimit: 3)
            }
        }
    }

    private var ratingSection: some View {
        VStack(spacing: 16) {
            Text("How was your experience?")
                .font(.title3)
                .fontWeight(.semibold)
                .accessibilityIdentifier("rating-title")

            HStack(spacing: 12) {
                ForEach(1...5, id: \.self) { index in
                    Button(action: { rating = index }) {
                        Image(systemName: index <= rating ? "star.fill" : "star")
                            .font(.system(size: 32))
                            .foregroundColor(index <= rating ? .yellow : .gray.opacity(0.3))
                    }
                    .accessibilityIdentifier("star-\(index)")
                }
            }
            .accessibilityIdentifier("rating-stars")

            Text(ratingDescription)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .accessibilityIdentifier("rating-description")
        }
        .padding()
        .background(Color.white)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 2)
    }

    private var commentSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Your Review")
                .font(.headline)
                .accessibilityIdentifier("comment-section-title")

            TextField("Your name", text: $customerName)
                .textFieldStyle(.roundedBorder)
                .accessibilityIdentifier("customer-name-field")

            ZStack(alignment: .topLeading) {
                if comment.isEmpty {
                    Text("Share more about your experience...")
                        .foregroundColor(.secondary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 12)
                }

                TextEditor(text: $comment)
                    .frame(minHeight: 120)
                    .padding(4)
                    .background(Color.theme.secondaryBackground)
                    .cornerRadius(8)
                    .accessibilityIdentifier("review-comment-field")
            }

            Text("\(comment.count)/500 characters")
                .font(.caption)
                .foregroundColor(.secondary)
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .padding()
        .background(Color.white)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 2)
    }

    private var photoSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Add Photos")
                    .font(.headline)
                    .accessibilityIdentifier("photo-section-title")

                Spacer()

                Text("\(selectedImages.count)/3")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            if selectedImages.isEmpty {
                Button(action: { showingImagePicker = true }) {
                    HStack {
                        Image(systemName: "photo")
                        Text("Add Photos")
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.theme.secondaryBackground)
                    .foregroundColor(.theme.primary)
                    .cornerRadius(12)
                }
                .accessibilityIdentifier("add-photos-button")
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(Array(selectedImages.enumerated()), id: \.offset) { index, image in
                            ZStack(alignment: .topTrailing) {
                                Image(uiImage: image)
                                    .resizable()
                                    .scaledToFill()
                                    .frame(width: 100, height: 100)
                                    .clipped()
                                    .cornerRadius(12)
                                    .accessibilityIdentifier("review-photo-\(index)")

                                Button(action: { selectedImages.remove(at: index) }) {
                                    Image(systemName: "xmark.circle.fill")
                                        .foregroundColor(.white)
                                        .background(Color.black.opacity(0.6))
                                        .clipShape(Circle())
                                }
                                .padding(4)
                                .accessibilityIdentifier("remove-photo-\(index)")
                            }
                        }

                        if selectedImages.count < 3 {
                            Button(action: { showingImagePicker = true }) {
                                VStack {
                                    Image(systemName: "plus")
                                    Text("Add")
                                        .font(.caption)
                                }
                                .frame(width: 100, height: 100)
                                .background(Color.theme.secondaryBackground)
                                .foregroundColor(.theme.primary)
                                .cornerRadius(12)
                            }
                            .accessibilityIdentifier("add-more-photos-button")
                        }
                    }
                }
            }
        }
        .padding()
        .background(Color.white)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 2)
    }

    private var submitButton: some View {
        Button(action: { submitReview() }) {
            if viewModel.isLoading {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
            } else {
                Text("Submit Review")
            }
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(isFormValid ? Color.theme.primary : Color.gray)
        .foregroundColor(.white)
        .cornerRadius(12)
        .disabled(!isFormValid || viewModel.isLoading)
        .accessibilityIdentifier("submit-review-button")
    }

    private var ratingDescription: String {
        switch rating {
        case 5: return "Excellent!"
        case 4: return "Great"
        case 3: return "Good"
        case 2: return "Fair"
        case 1: return "Poor"
        default: return ""
        }
    }

    private var isFormValid: Bool {
        !customerName.isEmpty && rating >= 1 && rating <= 5
    }

    private func submitReview() {
        guard isFormValid else { return }

        Task {
            await viewModel.createReview(
                customerName: customerName,
                rating: rating,
                comment: comment.isEmpty ? nil : comment,
                images: selectedImages.isEmpty ? nil : selectedImages
            )

            if viewModel.errorMessage == nil {
                dismiss()
            }
        }
    }
}

// Image Picker using PhotosUI
struct ImagePicker: UIViewControllerRepresentable {
    @Binding var images: [UIImage]
    var selectionLimit: Int = 1

    func makeUIViewController(context: Context) -> PHPickerViewController {
        var config = PHPickerConfiguration()
        config.selectionLimit = selectionLimit
        config.filter = .images

        let picker = PHPickerViewController(configuration: config)
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: PHPickerViewController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    class Coordinator: NSObject, PHPickerViewControllerDelegate {
        let parent: ImagePicker

        init(_ parent: ImagePicker) {
            self.parent = parent
        }

        func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
            picker.dismiss(animated: true)

            for result in results {
                if result.itemProvider.canLoadObject(ofClass: UIImage.self) {
                    result.itemProvider.loadObject(ofClass: UIImage.self) { [weak self] image, error in
                        if let image = image as? UIImage {
                            DispatchQueue.main.async {
                                self?.parent.images.append(image)
                            }
                        }
                    }
                }
            }
        }
    }
}

#Preview {
    ReviewsView(businessId: "business-123", orderId: nil)
}
