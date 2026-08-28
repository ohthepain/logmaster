import ActivityKit
import Capacitor
import Foundation

@objc(LogmasterLiveActivityPlugin)
final class LogmasterLiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "LogmasterLiveActivityPlugin"
    let jsName = "LogmasterLiveActivity"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "sync", returnType: CAPPluginReturnPromise),
    ]

    @objc func sync(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve(["active": false, "supported": false])
            return
        }

        if call.options["state"] is NSNull || call.getObject("state") == nil {
            Task {
                await LogmasterLiveActivityManager.endAll()
                call.resolve(["active": false, "supported": true])
            }
            return
        }

        guard let rawState = call.getObject("state"),
              let state = Self.parseState(rawState),
              let tripId = rawState["tripId"] as? String else {
            call.reject("Invalid Live Activity state")
            return
        }

        Task {
            do {
                let active = try await LogmasterLiveActivityManager.sync(
                    tripId: tripId,
                    state: state
                )
                call.resolve(["active": active, "supported": true])
            } catch {
                call.reject("Could not update Live Activity", nil, error)
            }
        }
    }

    @available(iOS 16.2, *)
    private static func parseState(
        _ raw: [String: Any]
    ) -> LogmasterActivityAttributes.ContentState? {
        guard let tripName = raw["tripName"] as? String,
              let mode = raw["mode"] as? String,
              let locationName = raw["locationName"] as? String,
              let previousLogAt = date(raw["previousLogAt"]),
              let nextLogAt = date(raw["nextLogAt"]),
              let deepLinkURL = raw["deepLinkURL"] as? String else {
            return nil
        }

        let entries = (raw["recentEntries"] as? [[String: Any]] ?? []).compactMap {
            entry -> LogmasterActivityAttributes.EntrySummary? in
            guard let id = entry["id"] as? String,
                  let symbol = entry["symbol"] as? String,
                  let timestamp = date(entry["timestamp"]) else {
                return nil
            }
            return .init(
                id: id,
                symbol: symbol,
                timestamp: timestamp,
                autoCreatedUnedited: bool(entry["autoCreatedUnedited"]),
                legColor: entry["legColor"] as? String ?? "#7ec8e8"
            )
        }

        return .init(
            tripName: tripName,
            mode: mode,
            locationName: locationName,
            sailsUp: bool(raw["sailsUp"]),
            engineOn: bool(raw["engineOn"]),
            previousLogAt: previousLogAt,
            nextLogAt: nextLogAt,
            stationarySince: date(raw["stationarySince"]),
            stationaryKind: raw["stationaryKind"] as? String,
            latestEntryId: raw["latestEntryId"] as? String,
            recentEntries: entries,
            deepLinkURL: deepLinkURL
        )
    }

    private static func bool(_ value: Any?) -> Bool {
        (value as? NSNumber)?.boolValue ?? (value as? Bool) ?? false
    }

    private static func date(_ value: Any?) -> Date? {
        guard let value = value as? String else { return nil }
        let precise = ISO8601DateFormatter()
        precise.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return precise.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }
}

@available(iOS 16.2, *)
private enum LogmasterLiveActivityManager {
    /// Rotate on the first new log after 7.5 hours, before ActivityKit's active window ends.
    private static let renewalAge: TimeInterval = 7.5 * 60 * 60

    static func sync(
        tripId: String,
        state: LogmasterActivityAttributes.ContentState
    ) async throws -> Bool {
        let activities = Activity<LogmasterActivityAttributes>.activities
        for activity in activities where activity.attributes.tripId != tripId {
            await activity.end(nil, dismissalPolicy: .immediate)
        }

        let existing = activities.first { $0.attributes.tripId == tripId }
        let hasNewEntry = existing?.content.state.latestEntryId != state.latestEntryId
        let shouldRenew = existing.map {
            hasNewEntry && Date().timeIntervalSince($0.attributes.activityStartedAt) >= renewalAge
        } ?? false

        if let existing, shouldRenew {
            await existing.end(nil, dismissalPolicy: .immediate)
        } else if let existing {
            await existing.update(content(for: state))
            return true
        }

        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return false }
        let attributes = LogmasterActivityAttributes(
            tripId: tripId,
            activityStartedAt: Date()
        )
        _ = try Activity.request(
            attributes: attributes,
            content: content(for: state),
            pushType: nil
        )
        return true
    }

    static func endAll() async {
        for activity in Activity<LogmasterActivityAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
    }

    private static func content(
        for state: LogmasterActivityAttributes.ContentState
    ) -> ActivityContent<LogmasterActivityAttributes.ContentState> {
        ActivityContent(
            state: state,
            staleDate: state.nextLogAt.addingTimeInterval(10 * 60)
        )
    }
}
