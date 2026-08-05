import SwiftUI

struct PantryView: View {
    @Environment(DecisionViewModel.self) private var viewModel
    @Environment(\.colorScheme) private var colorScheme
    private var palette: Palette { colorScheme == .dark ? .dark : .light }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Entry paths — always visible (spec §8)
                HStack(spacing: Space.md) {
                    Button {
                        // TODO: open camera for pantry photo
                    } label: {
                        Label("Add by photo", systemImage: "camera.fill")
                            .font(TypeScale.bodyStrong)
                            .foregroundStyle(palette.accentText)
                            .frame(maxWidth: .infinity)
                            .frame(height: TouchTarget.primaryCtaHeight)
                            .background(palette.accent)
                            .clipShape(RoundedRectangle(cornerRadius: Radius.md))
                    }
                    .accessibilityLabel("Add ingredients by photo")

                    Button {
                        // TODO: open manual add sheet
                    } label: {
                        Label("Add manually", systemImage: "plus")
                            .font(TypeScale.body)
                            .foregroundStyle(palette.accent)
                            .frame(height: TouchTarget.primaryCtaHeight)
                            .padding(.horizontal, Space.md)
                            .background(palette.surface)
                            .clipShape(RoundedRectangle(cornerRadius: Radius.md))
                            .overlay(
                                RoundedRectangle(cornerRadius: Radius.md)
                                    .stroke(palette.border, lineWidth: 1)
                            )
                    }
                    .accessibilityLabel("Add ingredient manually")
                }
                .padding(Space.md)

                Divider().overlay(palette.border)

                // Pantry list
                if let householdId = viewModel.householdId {
                    // Once connected, show real inventory here
                    Text("Household: \(householdId)")
                        .font(TypeScale.caption)
                        .foregroundStyle(palette.textMuted)
                        .padding()
                } else {
                    ContentUnavailableView {
                        Label("Your pantry is empty", systemImage: "refrigerator")
                    } description: {
                        Text("Take a photo of your fridge or add items manually to get started.")
                    } actions: {
                        Button("Take a photo") {
                            // TODO: open camera
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(palette.accent)
                    }
                }
            }
            .background(palette.bg)
            .navigationTitle("Pantry")
        }
    }
}
