import SwiftUI

struct ResultsView: View {
    let timeLimit: Minutes
    let preferredCuisine: String?

    @Environment(DecisionViewModel.self) private var viewModel
    @Environment(\.colorScheme) private var colorScheme
    private var palette: Palette { colorScheme == .dark ? .dark : .light }

    // Bottom two buckets are collapsed by default (spec §5.1)
    @State private var collapsedBuckets: Set<Bucket> = [.missingSome, .groceryRun]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.lg) {
                if viewModel.isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, minHeight: 200)
                } else if let decision = viewModel.decision {
                    // Relaxation banner — never silent (spec §5.3)
                    ForEach(visibleRelaxations(decision.appliedRelaxations), id: \.bannerText) { r in
                        RelaxationBanner(relaxation: r, palette: palette)
                    }

                    BucketSection(
                        title: "✅  MAKE IT NOW",
                        color: palette.ready,
                        recipes: decision.buckets[.ready] ?? [],
                        isCollapsed: false,
                        palette: palette
                    )

                    BucketSection(
                        title: "🟡  MISSING A FEW",
                        color: palette.near,
                        recipes: decision.buckets[.missingFew] ?? [],
                        isCollapsed: false,
                        palette: palette
                    )

                    CollapsibleBucketSection(
                        title: "⚪  MISSING MORE",
                        color: palette.far,
                        recipes: decision.buckets[.missingSome] ?? [],
                        bucket: .missingSome,
                        collapsedBuckets: $collapsedBuckets,
                        palette: palette
                    )

                    CollapsibleBucketSection(
                        title: "⚪  GROCERY RUN",
                        color: palette.far,
                        recipes: decision.buckets[.groceryRun] ?? [],
                        bucket: .groceryRun,
                        collapsedBuckets: $collapsedBuckets,
                        palette: palette
                    )
                }
            }
            .padding(Space.md)
        }
        .background(palette.bg)
        .navigationTitle("\(timeLimit) min")
        .navigationBarTitleDisplayMode(.inline)
    }

    // tier2Escalation is the one silent step — it adds options without
    // removing constraints, so there is nothing to disclose (spec §5.3)
    private func visibleRelaxations(_ relaxations: [Relaxation]) -> [Relaxation] {
        relaxations.filter {
            if case .tier2Escalation = $0 { return false }
            return true
        }
    }
}

// MARK: - Relaxation banner

private struct RelaxationBanner: View {
    let relaxation: Relaxation
    let palette: Palette

    var body: some View {
        HStack(alignment: .top, spacing: Space.sm) {
            Image(systemName: "info.circle")
                .foregroundStyle(palette.textMuted)
            Text(bannerText)
                .font(TypeScale.body)
                .foregroundStyle(palette.text)
        }
        .padding(Space.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(palette.surfaceAlt)
        .clipShape(RoundedRectangle(cornerRadius: Radius.md))
        .accessibilityElement(children: .combine)
    }

    var bannerText: String {
        switch relaxation {
        case .timeWidened(let from, let to):
            return "Nothing fits \(from) min. Here's what works in \(to)."
        case .cuisineDropped(let cuisine):
            return "Dropped \(cuisine) filter to find more options."
        case .bucketPromoted(let bucket):
            switch bucket {
            case .missingFew:  return "Nothing fully ready. Showing what's close."
            case .missingSome: return "Showing recipes with a few missing ingredients."
            default:           return "Showing all available recipes."
            }
        case .tier2Escalation:
            return "" // never shown — filtered before this view
        }
    }
}

extension Relaxation {
    var bannerText: String {
        switch self {
        case .timeWidened(let f, let t): return "time_\(f)_\(t)"
        case .cuisineDropped(let c):     return "cuisine_\(c)"
        case .bucketPromoted(let b):     return "bucket_\(b.rawValue)"
        case .tier2Escalation:           return "tier2"
        }
    }
}

// MARK: - Bucket sections

private struct BucketSection: View {
    let title: String
    let color: Color
    let recipes: [ScoredRecipe]
    let isCollapsed: Bool
    let palette: Palette

    var body: some View {
        if !recipes.isEmpty {
            VStack(alignment: .leading, spacing: Space.sm) {
                Text(title)
                    .font(TypeScale.heading)
                    .foregroundStyle(color)

                ForEach(recipes, id: \.recipe.id) { scored in
                    RecipeCard(scored: scored, palette: palette)
                }
            }
        }
    }
}

private struct CollapsibleBucketSection: View {
    let title: String
    let color: Color
    let recipes: [ScoredRecipe]
    let bucket: Bucket
    @Binding var collapsedBuckets: Set<Bucket>
    let palette: Palette

    private var isCollapsed: Bool { collapsedBuckets.contains(bucket) }

    var body: some View {
        if !recipes.isEmpty {
            VStack(alignment: .leading, spacing: Space.sm) {
                Button {
                    if isCollapsed {
                        collapsedBuckets.remove(bucket)
                    } else {
                        collapsedBuckets.insert(bucket)
                    }
                } label: {
                    HStack {
                        Text(title)
                            .font(TypeScale.heading)
                            .foregroundStyle(color)
                        Spacer()
                        Text("(\(recipes.count))")
                            .font(TypeScale.caption)
                            .foregroundStyle(palette.textMuted)
                        Image(systemName: isCollapsed ? "chevron.down" : "chevron.up")
                            .font(TypeScale.caption)
                            .foregroundStyle(palette.textMuted)
                    }
                }
                .accessibilityLabel("\(title), \(recipes.count) recipes, \(isCollapsed ? "collapsed" : "expanded")")
                .accessibilityHint("Double tap to \(isCollapsed ? "expand" : "collapse")")

                if !isCollapsed {
                    ForEach(recipes, id: \.recipe.id) { scored in
                        RecipeCard(scored: scored, palette: palette)
                    }
                }
            }
        }
    }
}
