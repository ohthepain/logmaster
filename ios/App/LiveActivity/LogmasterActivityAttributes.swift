import ActivityKit
import Foundation

struct LogmasterActivityAttributes: ActivityAttributes {
    struct EntrySummary: Codable, Hashable {
        let id: String
        let symbol: String
        let timestamp: Date
        let autoCreatedUnedited: Bool
        let legColor: String
    }

    struct ContentState: Codable, Hashable {
        let tripName: String
        let mode: String
        let locationName: String
        let sailsUp: Bool
        let engineOn: Bool
        let previousLogAt: Date
        let nextLogAt: Date
        let stationarySince: Date?
        let stationaryKind: String?
        let latestEntryId: String?
        let recentEntries: [EntrySummary]
        let deepLinkURL: String
    }

    let tripId: String
    let activityStartedAt: Date
}
