import SwiftUI

struct MainTabView: View {
    var body: some View {
        TabView {
            HomeView()
                .tabItem { Label("Home", systemImage: "house.fill") }

            PantryView()
                .tabItem { Label("Pantry", systemImage: "list.bullet") }
        }
    }
}
