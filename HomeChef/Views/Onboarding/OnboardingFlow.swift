import SwiftUI

// Three screens, under 60 seconds (spec §3).
// Onboarding is a tax the user pays before receiving any value.
// Keep it short, make each screen obviously worth it, and never ask twice.
struct OnboardingFlow: View {
    let onComplete: () -> Void

    @Environment(DecisionViewModel.self) private var viewModel
    @Environment(\.colorScheme) private var colorScheme
    private var palette: Palette { colorScheme == .dark ? .dark : .light }

    @State private var step = 0

    // Equipment tier selection
    @State private var selectedEquipmentTier: EquipmentTier = .fullKitchen
    @State private var extraEquipment: Set<Equipment> = []

    // Dietary restrictions
    @State private var selectedDietary: Set<DietaryTag> = []
    @State private var selectedAllergens: Set<String> = []

    var body: some View {
        VStack(spacing: 0) {
            // Progress dots
            HStack(spacing: Space.sm) {
                ForEach(0..<3) { i in
                    Circle()
                        .frame(width: 8, height: 8)
                        .foregroundStyle(i == step ? palette.accent : palette.border)
                }
            }
            .padding(.top, Space.lg)

            switch step {
            case 0:
                EquipmentStep(
                    selectedTier: $selectedEquipmentTier,
                    extraEquipment: $extraEquipment,
                    palette: palette
                ) { step = 1 }

            case 1:
                RestrictionsStep(
                    selectedDietary: $selectedDietary,
                    selectedAllergens: $selectedAllergens,
                    palette: palette
                ) { step = 2 }

            default:
                StaplesStep(palette: palette) {
                    saveAndFinish()
                }
            }
        }
        .background(palette.bg)
    }

    private func saveAndFinish() {
        // Save equipment to LocalStorage for use before Supabase is wired
        let allEquipment = selectedEquipmentTier.equipment
            .union(extraEquipment)
            .map { $0.rawValue }
        LocalStorage.set("equipment", value: allEquipment)
        LocalStorage.set("dietary", value: Array(selectedDietary).map { $0.rawValue })
        LocalStorage.set("allergens", value: Array(selectedAllergens))
        onComplete()
    }
}

// MARK: - Equipment step (spec §3.1)

private struct EquipmentStep: View {
    @Binding var selectedTier: EquipmentTier
    @Binding var extraEquipment: Set<Equipment>
    let palette: Palette
    let onContinue: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.lg) {
            VStack(alignment: .leading, spacing: Space.sm) {
                Text("What's in your kitchen?")
                    .font(TypeScale.display)
                    .foregroundStyle(palette.text)
                Text("We'll only suggest meals you can actually cook.")
                    .font(TypeScale.body)
                    .foregroundStyle(palette.textMuted)
            }

            // Tier cards — single select
            VStack(spacing: Space.sm) {
                ForEach(EquipmentTier.allCases) { tier in
                    EquipmentTierCard(
                        tier: tier,
                        isSelected: selectedTier == tier,
                        palette: palette
                    ) { selectedTier = tier }
                }
            }

            // Addon pills — multi select
            VStack(alignment: .leading, spacing: Space.sm) {
                Text("Anything else?")
                    .font(TypeScale.heading)
                    .foregroundStyle(palette.text)

                FlowLayout(spacing: Space.sm) {
                    ForEach(EquipmentTier.addons, id: \.self) { item in
                        TogglePill(
                            label: item.displayName,
                            isOn: extraEquipment.contains(item),
                            palette: palette
                        ) {
                            if extraEquipment.contains(item) {
                                extraEquipment.remove(item)
                            } else {
                                extraEquipment.insert(item)
                            }
                        }
                    }
                }
            }

            Spacer()

            ContinueButton(label: "Continue", palette: palette, action: onContinue)
                .padding(.bottom, Space.xl)
        }
        .padding(Space.md)
    }
}

private struct EquipmentTierCard: View {
    let tier: EquipmentTier
    let isSelected: Bool
    let palette: Palette
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Space.md) {
                Image(systemName: isSelected ? "checkmark.square.fill" : "square")
                    .foregroundStyle(isSelected ? palette.accent : palette.textMuted)
                    .imageScale(.large)

                VStack(alignment: .leading, spacing: 2) {
                    Text(tier.label)
                        .font(TypeScale.bodyStrong)
                        .foregroundStyle(palette.text)
                    Text(tier.subtitle)
                        .font(TypeScale.caption)
                        .foregroundStyle(palette.textMuted)
                }

                Spacer()
            }
            .padding(Space.md)
            .frame(height: 72)
            .background(palette.surface)
            .clipShape(RoundedRectangle(cornerRadius: Radius.md))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .stroke(isSelected ? palette.accent : palette.border, lineWidth: isSelected ? 2 : 1)
            )
        }
        .accessibilityLabel(tier.label)
        .accessibilityHint(tier.subtitle)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

// MARK: - Restrictions step (spec §3.2)

private struct RestrictionsStep: View {
    @Binding var selectedDietary: Set<DietaryTag>
    @Binding var selectedAllergens: Set<String>
    let palette: Palette
    let onContinue: () -> Void

    private let commonAllergens = ["nuts", "dairy", "gluten", "eggs", "soy", "shellfish", "fish"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.lg) {
                VStack(alignment: .leading, spacing: Space.sm) {
                    Text("Any restrictions?")
                        .font(TypeScale.display)
                        .foregroundStyle(palette.text)
                    // danger is reserved for allergen warnings — this copy earns it
                    Text("We'll never suggest a recipe with these. Promise.")
                        .font(TypeScale.body)
                        .foregroundStyle(palette.textMuted)
                }

                VStack(alignment: .leading, spacing: Space.sm) {
                    Text("DIET")
                        .font(TypeScale.caption)
                        .foregroundStyle(palette.textMuted)

                    FlowLayout(spacing: Space.sm) {
                        ForEach(DietaryTag.allCases, id: \.self) { tag in
                            TogglePill(
                                label: tag.displayName,
                                isOn: selectedDietary.contains(tag),
                                palette: palette
                            ) {
                                if selectedDietary.contains(tag) {
                                    selectedDietary.remove(tag)
                                } else {
                                    selectedDietary.insert(tag)
                                }
                            }
                        }
                    }
                }

                VStack(alignment: .leading, spacing: Space.sm) {
                    Text("ALLERGENS")
                        .font(TypeScale.caption)
                        .foregroundStyle(palette.textMuted)

                    FlowLayout(spacing: Space.sm) {
                        ForEach(commonAllergens, id: \.self) { allergen in
                            TogglePill(
                                label: allergen.capitalized,
                                isOn: selectedAllergens.contains(allergen),
                                palette: palette,
                                accentColor: palette.danger
                            ) {
                                if selectedAllergens.contains(allergen) {
                                    selectedAllergens.remove(allergen)
                                } else {
                                    selectedAllergens.insert(allergen)
                                }
                            }
                        }
                    }
                }
            }
            .padding(Space.md)
        }

        ContinueButton(label: "Continue", palette: palette, action: onContinue)
            .padding([.horizontal, .bottom], Space.md)
    }
}

// MARK: - Staples step (spec §3.3)

private struct StaplesStep: View {
    let palette: Palette
    let onContinue: () -> Void

    @State private var removedStaples: Set<String> = []

    var body: some View {
        VStack(alignment: .leading, spacing: Space.lg) {
            VStack(alignment: .leading, spacing: Space.sm) {
                Text("We assumed you have these.")
                    .font(TypeScale.display)
                    .foregroundStyle(palette.text)
                Text("Tap any you don't.")
                    .font(TypeScale.body)
                    .foregroundStyle(palette.textMuted)
            }

            FlowLayout(spacing: Space.sm) {
                ForEach(stapleIngredientIds.prefix(20), id: \.self) { id in
                    let name = lookupIngredient(id)?.displayName ?? id
                    let isRemoved = removedStaples.contains(id)

                    Button {
                        if isRemoved { removedStaples.remove(id) }
                        else { removedStaples.insert(id) }
                    } label: {
                        Text(name)
                            .font(TypeScale.caption)
                            .foregroundStyle(isRemoved ? palette.textMuted : palette.text)
                            .padding(.horizontal, Space.md)
                            .padding(.vertical, Space.sm)
                            .background(isRemoved ? palette.surfaceAlt : palette.surface)
                            .clipShape(Capsule())
                            .overlay(
                                Capsule().stroke(
                                    isRemoved ? palette.border : palette.accent,
                                    lineWidth: 1
                                )
                            )
                    }
                    .accessibilityLabel(name)
                    .accessibilityHint(isRemoved ? "Tap to add back" : "Tap to remove from pantry")
                    .accessibilityAddTraits(isRemoved ? [] : .isSelected)
                }
            }

            Spacer()

            VStack(spacing: Space.sm) {
                ContinueButton(label: "Looks good", palette: palette, action: onContinue)
                Button("I'll add them manually") {
                    onContinue()
                }
                .font(TypeScale.body)
                .foregroundStyle(palette.textMuted)
            }
            .padding(.bottom, Space.xl)
        }
        .padding(Space.md)
    }
}

// MARK: - Shared sub-components

private struct ContinueButton: View {
    let label: String
    let palette: Palette
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(TypeScale.bodyStrong)
                .foregroundStyle(palette.accentText)
                .frame(maxWidth: .infinity)
                .frame(height: TouchTarget.primaryCtaHeight)
                .background(palette.accent)
                .clipShape(RoundedRectangle(cornerRadius: Radius.md))
        }
        .accessibilityLabel(label)
    }
}

private struct TogglePill: View {
    let label: String
    let isOn: Bool
    let palette: Palette
    var accentColor: Color? = nil
    let action: () -> Void

    private var activeColor: Color { accentColor ?? palette.accent }

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(TypeScale.caption)
                .foregroundStyle(isOn ? palette.accentText : palette.textMuted)
                .padding(.horizontal, Space.md)
                .padding(.vertical, Space.sm)
                .background(isOn ? activeColor : palette.surfaceAlt)
                .clipShape(Capsule())
        }
        .accessibilityLabel(label)
        .accessibilityAddTraits(isOn ? .isSelected : [])
    }
}

// MARK: - Equipment tier model

enum EquipmentTier: String, CaseIterable, Identifiable {
    case microwaveOnly
    case microwaveAndKettle
    case fullKitchen

    var id: String { rawValue }

    var label: String {
        switch self {
        case .microwaveOnly:       return "Microwave only"
        case .microwaveAndKettle:  return "Microwave + kettle"
        case .fullKitchen:         return "Full kitchen"
        }
    }

    var subtitle: String {
        switch self {
        case .microwaveOnly:       return "Dorm room basics"
        case .microwaveAndKettle:  return "Hot water too"
        case .fullKitchen:         return "Stove and oven"
        }
    }

    var equipment: Set<Equipment> {
        switch self {
        case .microwaveOnly:       return [.microwave]
        case .microwaveAndKettle:  return [.microwave, .kettle]
        case .fullKitchen:         return [.microwave, .stove, .oven]
        }
    }

    static let addons: [Equipment] = [.airFryer, .riceCooker, .blender, .toasterOven]
}

extension DietaryTag {
    var displayName: String {
        switch self {
        case .vegetarian:  return "Vegetarian"
        case .vegan:       return "Vegan"
        case .glutenFree:  return "Gluten-free"
        case .dairyFree:   return "Dairy-free"
        case .halal:       return "Halal"
        case .kosher:      return "Kosher"
        case .pescatarian: return "Pescatarian"
        case .keto:        return "Keto"
        }
    }
}
