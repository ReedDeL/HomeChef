import SwiftUI

// The most important screen in the product.
// Converts "I don't know what to eat" into three answers in under ten seconds.
struct HomeView: View {
    @Environment(DecisionViewModel.self) private var viewModel
    @Environment(\.colorScheme) private var colorScheme
    private var palette: Palette { colorScheme == .dark ? .dark : .light }

    @State private var selectedTime: Minutes?
    @State private var preferredCuisine: String?
    @State private var navigateToResults = false

    // Time options shown as tiles — three buttons, not a slider.
    // A slider is a decision; three buttons are a reflex.
    private let timeTiles: [(label: String, sublabel: String, minutes: Minutes)] = [
        ("15", "min", 15),
        ("30", "min", 30),
        ("60+", "min", 60),
    ]

    private let cuisines = ["Italian", "Asian", "Mexican", "Indian", "American", "Mediterranean"]

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ScrollView {
                    VStack(alignment: .leading, spacing: Space.lg) {
                        // Greeting
                        Text("Evening")
                            .font(TypeScale.caption)
                            .foregroundStyle(palette.textMuted)
                            .padding(.top, Space.xl)

                        // Primary prompt
                        Text("How much time\ndo you have?")
                            .font(TypeScale.display)
                            .foregroundStyle(palette.text)

                        // Time tiles — tapping goes straight to results (spec §4)
                        HStack(spacing: Space.md) {
                            ForEach(timeTiles, id: \.minutes) { tile in
                                TimeTileButton(
                                    label: tile.label,
                                    sublabel: tile.sublabel,
                                    isSelected: selectedTime == tile.minutes,
                                    palette: palette
                                ) {
                                    selectedTime = tile.minutes
                                    runDecision(time: tile.minutes)
                                    navigateToResults = true
                                }
                            }
                        }

                        Divider().overlay(palette.border)

                        // Optional cuisine — de-emphasized, never competes with primary action
                        VStack(alignment: .leading, spacing: Space.sm) {
                            Label("Feeling like something?", systemImage: "fork.knife")
                                .font(TypeScale.caption)
                                .foregroundStyle(palette.textMuted)

                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: Space.sm) {
                                    CuisineChip(
                                        label: "Any",
                                        isSelected: preferredCuisine == nil,
                                        palette: palette
                                    ) { preferredCuisine = nil }

                                    ForEach(cuisines, id: \.self) { cuisine in
                                        CuisineChip(
                                            label: cuisine,
                                            isSelected: preferredCuisine == cuisine,
                                            palette: palette
                                        ) {
                                            preferredCuisine = preferredCuisine == cuisine
                                                ? nil : cuisine
                                        }
                                    }
                                }
                            }
                        }
                    }
                    .padding(.horizontal, Space.md)
                }

                // Bottom CTA area
                VStack(spacing: Space.sm) {
                    // Primary CTA — fallback for users who expect an explicit confirm
                    Button {
                        guard let time = selectedTime else { return }
                        runDecision(time: time)
                        navigateToResults = true
                    } label: {
                        Text("Show me meals")
                            .font(TypeScale.bodyStrong)
                            .foregroundStyle(palette.accentText)
                            .frame(maxWidth: .infinity)
                            .frame(height: TouchTarget.primaryCtaHeight)
                            .background(selectedTime == nil ? palette.border : palette.accent)
                            .clipShape(RoundedRectangle(cornerRadius: Radius.md))
                    }
                    .disabled(selectedTime == nil)
                    .accessibilityLabel("Show me meal suggestions")
                    .padding(.horizontal, Space.md)

                    // Pantry count — reassurance that the app knows what you have
                    Button {
                        // TODO: switch to pantry tab
                    } label: {
                        Text("📸 Update pantry")
                            .font(TypeScale.caption)
                            .foregroundStyle(palette.textMuted)
                    }
                    .accessibilityLabel("Update your pantry")
                    .padding(.bottom, Space.lg)
                }
                .background(palette.bg)
            }
            .background(palette.bg)
            .navigationDestination(isPresented: $navigateToResults) {
                ResultsView(
                    timeLimit: selectedTime ?? 30,
                    preferredCuisine: preferredCuisine
                )
            }
        }
    }

    private func runDecision(time: Minutes) {
        viewModel.recompute(
            catalog: tier1Catalog,
            timeLimit: time,
            preferredCuisine: preferredCuisine
        )
    }
}

// MARK: - Sub-components

private struct TimeTileButton: View {
    let label: String
    let sublabel: String
    let isSelected: Bool
    let palette: Palette
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: Space.xs) {
                Text(label)
                    .font(TypeScale.title)
                    .foregroundStyle(isSelected ? palette.accentText : palette.text)
                Text(sublabel)
                    .font(TypeScale.caption)
                    .foregroundStyle(isSelected ? palette.accentText : palette.textMuted)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 96)
            .background(isSelected ? palette.accent : palette.surface)
            .clipShape(RoundedRectangle(cornerRadius: Radius.lg))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.lg)
                    .stroke(isSelected ? palette.accent : palette.border, lineWidth: 1)
            )
        }
        .accessibilityLabel("\(label) \(sublabel)")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

private struct CuisineChip: View {
    let label: String
    let isSelected: Bool
    let palette: Palette
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(TypeScale.caption)
                .foregroundStyle(isSelected ? palette.accentText : palette.textMuted)
                .padding(.horizontal, Space.md)
                .padding(.vertical, Space.sm)
                .background(isSelected ? palette.accent : palette.surfaceAlt)
                .clipShape(Capsule())
        }
        .accessibilityLabel("\(label) cuisine")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}
