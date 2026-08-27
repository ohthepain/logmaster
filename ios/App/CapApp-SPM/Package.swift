// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v16)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.4.2"),
        .package(name: "CapacitorCommunityBackgroundGeolocation", path: "../../../node_modules/.pnpm/@capacitor-community+background-geolocation@1.2.26_@capacitor+core@8.4.2/node_modules/@capacitor-community/background-geolocation"),
        .package(name: "CapacitorApp", path: "../../../node_modules/.pnpm/@capacitor+app@8.1.1_@capacitor+core@8.4.2/node_modules/@capacitor/app"),
        .package(name: "CapacitorGeolocation", path: "../../../node_modules/.pnpm/@capacitor+geolocation@8.2.0_@capacitor+core@8.4.2/node_modules/@capacitor/geolocation"),
        .package(name: "CapacitorLocalNotifications", path: "../../../node_modules/.pnpm/@capacitor+local-notifications@8.2.1_@capacitor+core@8.4.2/node_modules/@capacitor/local-notifications"),
        .package(name: "CapawesomeCapacitorGoogleSignIn", path: "../../../node_modules/.pnpm/@capawesome+capacitor-google-sign-in@0.1.3_@capacitor+core@8.4.2/node_modules/@capawesome/capacitor-google-sign-in"),
        .package(name: "LogmasterAppleMap", path: "../../../node_modules/.pnpm/logmaster-apple-map@file+plugins+logmaster-apple-map_@capacitor+core@8.4.2/node_modules/logmaster-apple-map")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorCommunityBackgroundGeolocation", package: "CapacitorCommunityBackgroundGeolocation"),
                .product(name: "CapacitorApp", package: "CapacitorApp"),
                .product(name: "CapacitorGeolocation", package: "CapacitorGeolocation"),
                .product(name: "CapacitorLocalNotifications", package: "CapacitorLocalNotifications"),
                .product(name: "CapawesomeCapacitorGoogleSignIn", package: "CapawesomeCapacitorGoogleSignIn"),
                .product(name: "LogmasterAppleMap", package: "LogmasterAppleMap")
            ]
        )
    ]
)
