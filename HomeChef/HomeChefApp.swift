import SwiftUI

@main
struct HomeChefApp: App {
    @AppStorage("onboarding_done") private var onboardingDone = false
    @State private var viewModel = DecisionViewModel()

    var body: some Scene {
        WindowGroup {
            Group {
                if onboardingDone {
                    MainTabView()
                } else {
                    OnboardingFlow {
                        onboardingDone = true
                    }
                }
            }
            .environment(viewModel)
        }
    }
}
