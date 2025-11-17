import SwiftUI

extension Color {
    static let theme = ColorTheme()
}

struct ColorTheme {
    // Primary Colors
    let primary = Color("Primary", bundle: nil)
    let primaryVariant = Color("PrimaryVariant", bundle: nil)
    let secondary = Color("Secondary", bundle: nil)
    let secondaryVariant = Color("SecondaryVariant", bundle: nil)

    // Background & Surface
    let background = Color("Background", bundle: nil)
    let surface = Color("Surface", bundle: nil)
    let surfaceVariant = Color("SurfaceVariant", bundle: nil)

    // Text Colors
    let text = Color("Text", bundle: nil)
    let textSecondary = Color("TextSecondary", bundle: nil)
    let textTertiary = Color("TextTertiary", bundle: nil)

    // Semantic Colors
    let success = Color("Success", bundle: nil)
    let error = Color("Error", bundle: nil)
    let warning = Color("Warning", bundle: nil)
    let info = Color("Info", bundle: nil)

    // Order Status Colors
    let statusPending = Color.orange
    let statusConfirmed = Color.blue
    let statusReady = Color.purple
    let statusFulfilled = Color.green
    let statusCancelled = Color.red

    // Default fallbacks for asset catalog colors
    static func withFallback(_ name: String, _ fallback: Color) -> Color {
        // Note: Color(name, bundle:) returns the fallback system color if asset not found
        return Color(name, bundle: nil)
    }
}

// MARK: - Extended Color Definitions
extension ColorTheme {
    // Android Material colors for consistency
    static let orange = Color(red: 1.0, green: 0.596, blue: 0.0) // #FF9800
    static let blue = Color(red: 0.13, green: 0.588, blue: 0.953) // #2196F3
    static let green = Color(red: 0.298, green: 0.686, blue: 0.314) // #4CAF50
    static let red = Color(red: 0.957, green: 0.263, blue: 0.212) // #F44336
}
