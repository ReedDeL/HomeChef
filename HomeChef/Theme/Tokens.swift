// Design tokens — the single source of truth for color, type, and spacing.
// Values transcribed from docs/04_UIUX_SPEC.md §1.
// Hardcoding a color or spacing number anywhere else is a review-blocking rule.

import SwiftUI

// MARK: - Color

/// `danger` is reserved exclusively for allergen warnings — not validation
/// errors, not destructive buttons. If red always means "this could hurt you,"
/// red keeps meaning it.
struct Palette {
    let bg:         Color
    let surface:    Color
    let surfaceAlt: Color
    let text:       Color
    let textMuted:  Color
    let accent:     Color
    let accentText: Color
    let ready:      Color
    let near:       Color
    let far:        Color
    let danger:     Color
    let border:     Color
}

extension Palette {
    static let light = Palette(
        bg:         Color(hex: "FFFCF8"),
        surface:    Color(hex: "FFFFFF"),
        surfaceAlt: Color(hex: "F5F0E8"),
        text:       Color(hex: "1A1613"),
        textMuted:  Color(hex: "6B6259"),
        accent:     Color(hex: "D94F14"),
        accentText: Color(hex: "FFFFFF"),
        ready:      Color(hex: "2E7D4F"),
        near:       Color(hex: "C77D12"),
        far:        Color(hex: "8A8079"),
        danger:     Color(hex: "C62828"),
        border:     Color(hex: "E5DDD2")
    )

    static let dark = Palette(
        bg:         Color(hex: "151312"),
        surface:    Color(hex: "221F1D"),
        surfaceAlt: Color(hex: "2C2825"),
        text:       Color(hex: "F5F0E8"),
        textMuted:  Color(hex: "A69C91"),
        accent:     Color(hex: "FF7A3D"),
        accentText: Color(hex: "151312"),
        ready:      Color(hex: "4CAF7D"),
        near:       Color(hex: "E8A33D"),
        far:        Color(hex: "9C938B"),
        danger:     Color(hex: "FF6B6B"),
        border:     Color(hex: "38332F")
    )
}

extension Color {
    init(hex: String) {
        var int: UInt64 = 0
        Scanner(string: hex.trimmingCharacters(in: .alphanumerics.inverted))
            .scanHexInt64(&int)
        let r = Double((int >> 16) & 0xFF) / 255
        let g = Double((int >>  8) & 0xFF) / 255
        let b = Double( int        & 0xFF) / 255
        self.init(.sRGB, red: r, green: g, blue: b, opacity: 1)
    }
}

// MARK: - Typography

/// System font stack only — a custom font costs bundle size and a layout shift.
enum TypeScale {
    static let display    = Font.system(size: 34, weight: .bold)
    static let title      = Font.system(size: 24, weight: .bold)
    static let heading    = Font.system(size: 19, weight: .semibold)
    static let body       = Font.system(size: 17, weight: .regular)
    static let bodyStrong = Font.system(size: 17, weight: .semibold)
    static let caption    = Font.system(size: 14, weight: .regular)
    /// Cook mode only — readable from arm's length across a counter.
    static let cookStep   = Font.system(size: 28, weight: .medium)
}

// MARK: - Spacing (4pt base scale)

enum Space {
    static let xs:  CGFloat = 4
    static let sm:  CGFloat = 8
    static let md:  CGFloat = 16
    static let lg:  CGFloat = 24
    static let xl:  CGFloat = 32
    static let xxl: CGFloat = 48
}

// MARK: - Corner radius

enum Radius {
    static let sm:   CGFloat = 8
    static let md:   CGFloat = 12
    static let lg:   CGFloat = 20
    static let full: CGFloat = 999
}

// MARK: - Touch targets

/// Minimum touch target sizes in points.
/// Cook mode is oversized deliberately — operated with a knuckle or the back of a hand.
enum TouchTarget {
    static let standard:        CGFloat = 44
    static let cookMode:        CGFloat = 64
    static let primaryCtaHeight: CGFloat = 56
}
