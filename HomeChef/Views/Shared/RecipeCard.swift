import SwiftUI

// Every recipe card shows required equipment — constant proof the app respects
// the constraint the user declared. (spec §5.1)
struct RecipeCard: View {
    let scored: ScoredRecipe
    let palette: Palette

    private var recipe: Recipe { scored.recipe }
    private var isReady: Bool { scored.bucket == .ready }

    var body: some View {
        HStack(spacing: Space.md) {
            // Hero thumbnail
            AsyncImage(url: recipe.imageUrl.flatMap(URL.init)) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().aspectRatio(contentMode: .fill)
                default:
                    Rectangle().foregroundStyle(palette.surfaceAlt)
                }
            }
            .frame(width: 80, height: 80)
            .clipShape(RoundedRectangle(cornerRadius: Radius.sm))

            VStack(alignment: .leading, spacing: Space.xs) {
                // Recipe title
                Text(recipe.title)
                    .font(TypeScale.bodyStrong)
                    .foregroundStyle(palette.text)
                    .lineLimit(2)

                // Metadata line
                HStack(spacing: Space.xs) {
                    Image(systemName: "clock")
                        .imageScale(.small)
                    Text("\(recipe.totalTimeMinutes) min")
                    Text("·")
                    Text(recipe.equipmentRequired.map(\.displayName).joined(separator: ", "))
                }
                .font(TypeScale.caption)
                .foregroundStyle(palette.textMuted)

                // Pantry status or missing ingredients
                if isReady {
                    Text("You have it all")
                        .font(TypeScale.caption)
                        .foregroundStyle(palette.ready)
                } else if !scored.missing.isEmpty {
                    MissingChips(
                        missingIds: scored.missing,
                        palette: palette
                    )
                }

                // Tier 2 attribution (required by Spoonacular terms)
                if recipe.source == .tier2 {
                    Text("via Spoonacular")
                        .font(TypeScale.caption)
                        .foregroundStyle(palette.textMuted)
                }
            }

            Spacer(minLength: 0)
        }
        .padding(Space.md)
        .background(palette.surface)
        .clipShape(RoundedRectangle(cornerRadius: Radius.md))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .stroke(palette.border, lineWidth: 1)
        )
        // Announced as one unit by VoiceOver — not four fragments (spec §9)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityDescription)
    }

    private var accessibilityDescription: String {
        var parts = [recipe.title, "\(recipe.totalTimeMinutes) minutes"]
        if isReady {
            parts.append("You have all ingredients")
        } else {
            parts.append("Missing: \(scored.missing.prefix(3).joined(separator: ", "))")
        }
        return parts.joined(separator: ", ")
    }
}

// MARK: - Missing ingredient chips

private struct MissingChips: View {
    let missingIds: [IngredientId]
    let palette: Palette

    var body: some View {
        // Show first 3 missing; the rest are implicit
        let visible = missingIds.prefix(3)
        FlowLayout(spacing: Space.xs) {
            ForEach(Array(visible), id: \.self) { id in
                Text(lookupIngredient(id)?.displayName ?? id)
                    .font(TypeScale.caption)
                    .foregroundStyle(palette.textMuted)
                    .padding(.horizontal, Space.sm)
                    .padding(.vertical, 2)
                    .background(palette.surfaceAlt)
                    .clipShape(Capsule())
                    .accessibilityLabel("Missing: \(lookupIngredient(id)?.displayName ?? id)")
                    .accessibilityHint("Removes this from your pantry if you have it")
            }
            if missingIds.count > 3 {
                Text("+\(missingIds.count - 3) more")
                    .font(TypeScale.caption)
                    .foregroundStyle(palette.textMuted)
            }
        }
    }
}

// MARK: - Helpers

extension Equipment {
    var displayName: String {
        switch self {
        case .microwave:    return "Microwave"
        case .stove:        return "Stove"
        case .oven:         return "Oven"
        case .airFryer:     return "Air fryer"
        case .kettle:       return "Kettle"
        case .blender:      return "Blender"
        case .riceCooker:   return "Rice cooker"
        case .toasterOven:  return "Toaster oven"
        case .none:         return "No cook"
        }
    }
}

// Simple left-to-right wrapping layout for chips
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var height: CGFloat = 0
        var x: CGFloat = 0
        var rowHeight: CGFloat = 0

        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x + size.width > width, x > 0 {
                height += rowHeight + spacing
                x = 0
                rowHeight = 0
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        height += rowHeight
        return CGSize(width: width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0

        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX, x > bounds.minX {
                y += rowHeight + spacing
                x = bounds.minX
                rowHeight = 0
            }
            view.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}
