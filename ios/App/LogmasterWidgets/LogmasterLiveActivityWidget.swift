import ActivityKit
import SwiftUI
import WidgetKit

struct LogmasterLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        configuration
    }

    private var configuration: some WidgetConfiguration {
        ActivityConfiguration(for: LogmasterActivityAttributes.self) { context in
            LogmasterActivityContent(context: context)
                .widgetURL(URL(string: context.state.deepLinkURL))
                .activityBackgroundTint(Color(red: 0.82, green: 0.82, blue: 0.84))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    if context.state.mode == "stationary" {
                        ResumeRecordingLink(urlString: context.state.deepLinkURL)
                    } else {
                        VesselIcon(sailsUp: context.state.sailsUp)
                    }
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.state.locationName)
                        .font(.headline)
                        .lineLimit(1)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if context.state.mode == "stationary" {
                        StationaryStatusPill(kind: context.state.stationaryKind)
                    } else {
                        TrailingStatus(state: context.state)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    ExpandedBottom(state: context.state)
                }
            } compactLeading: {
                CompactLeading(state: context.state)
            } compactTrailing: {
                TrailingStatus(state: context.state)
            } minimal: {
                CompactLeading(state: context.state)
            }
            .widgetURL(URL(string: context.state.deepLinkURL))
            .keylineTint(.cyan)
        }
    }
}

private struct LogmasterActivityContent: View {
    let context: ActivityViewContext<LogmasterActivityAttributes>

    @ViewBuilder
    var body: some View {
        if #available(iOSApplicationExtension 18.0, *) {
            AdaptiveActivityContent(context: context)
        } else {
            MediumActivityContent(state: context.state)
        }
    }
}

@available(iOSApplicationExtension 18.0, *)
private struct AdaptiveActivityContent: View {
    @Environment(\.activityFamily) private var activityFamily
    let context: ActivityViewContext<LogmasterActivityAttributes>

    @ViewBuilder
    var body: some View {
        switch activityFamily {
        case .small:
            SmallActivityContent(state: context.state)
        case .medium:
            MediumActivityContent(state: context.state)
        @unknown default:
            MediumActivityContent(state: context.state)
        }
    }
}

private struct MediumActivityContent: View {
    let state: LogmasterActivityAttributes.ContentState

    var body: some View {
        VStack(spacing: 0) {
            VStack(spacing: 13) {
                if state.mode == "stationary" {
                    StationaryHeader(state: state)
                    Text(state.locationName)
                        .font(.headline)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity)
                    EntryRow(entries: state.recentEntries)
                } else {
                    topRow
                    secondRow
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, state.mode == "stationary" ? 12 : 15)

            if state.mode == "stationary" {
                StationaryDuration(state: state)
            }
        }
        .foregroundStyle(Color(red: 0.10, green: 0.11, blue: 0.13))
    }

    @ViewBuilder
    private var topRow: some View {
        if state.mode == "moving" {
            HStack(spacing: 12) {
                VesselIcon(sailsUp: state.sailsUp)
                Text(state.locationName)
                    .font(.headline)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity)
                CompassCountdown(state: state)
            }
        } else {
            Text(state.locationName)
                .font(.headline)
                .lineLimit(1)
                .frame(maxWidth: .infinity)
        }
    }

    @ViewBuilder
    private var secondRow: some View {
        switch state.mode {
        case "moving":
            HourProgress(state: state)
        case "stationary":
            EntryRow(entries: state.recentEntries)
        default:
            StartTripLink(urlString: state.deepLinkURL)
        }
    }
}

private struct StationaryHeader: View {
    let state: LogmasterActivityAttributes.ContentState

    var body: some View {
        HStack {
            ResumeRecordingLink(urlString: state.deepLinkURL)
            Spacer()
            StationaryStatusPill(kind: state.stationaryKind)
        }
    }
}

private struct StationaryStatusPill: View {
    let kind: String?

    var body: some View {
        Text(kind == "anchored" ? "Anchored" : "Moored")
            .font(.caption2.bold())
            .foregroundStyle(.white)
            .padding(.horizontal, 11)
            .padding(.vertical, 6)
            .background(Color(red: 0.08, green: 0.38, blue: 0.23), in: Capsule())
    }
}

private struct SmallActivityContent: View {
    let state: LogmasterActivityAttributes.ContentState

    var body: some View {
        VStack(spacing: 9) {
            if state.mode == "stationary" {
                StationaryHeader(state: state)
                Text(state.locationName)
                    .font(.headline)
                    .lineLimit(1)
                EntryRow(entries: state.recentEntries, compact: true)
                StationaryDuration(state: state, compact: true)
            } else {
                Text(state.locationName)
                    .font(.headline)
                    .lineLimit(1)
                switch state.mode {
                case "moving":
                    HStack {
                        VesselIcon(sailsUp: state.sailsUp)
                        Spacer()
                        CompassCountdown(state: state)
                    }
                    HourProgress(state: state)
                default:
                    StartTripLink(urlString: state.deepLinkURL)
                }
            }
        }
        .padding(12)
        .foregroundStyle(.white)
    }
}

private struct VesselIcon: View {
    let sailsUp: Bool

    var body: some View {
        Image(systemName: sailsUp ? "sailboat.fill" : "ferry.fill")
            .font(.system(size: 19, weight: .semibold))
            .foregroundStyle(.cyan)
            .frame(width: 30, height: 30)
            .accessibilityLabel(sailsUp ? "Sails up" : "Sails down")
    }
}

private struct CompassCountdown: View {
    let state: LogmasterActivityAttributes.ContentState

    var body: some View {
        ZStack {
            Image(systemName: "circle.dotted.and.circle")
                .font(.system(size: 36))
                .foregroundStyle(.cyan.opacity(0.8))
            Text(timerInterval: state.previousLogAt...state.nextLogAt, countsDown: true)
                .font(.system(size: 8, weight: .bold, design: .rounded))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .frame(width: 28)
        }
        .frame(width: 38, height: 38)
        .accessibilityLabel("Time until next hourly log")
    }
}

private struct HourProgress: View {
    let state: LogmasterActivityAttributes.ContentState

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "clock.arrow.circlepath")
                .accessibilityLabel("Previous hourly log")
            ProgressView(
                timerInterval: state.previousLogAt...state.nextLogAt,
                countsDown: false
            )
            .tint(.cyan)
            Image(systemName: "mappin.and.ellipse")
                .accessibilityLabel("Next log destination")
        }
        .font(.caption.weight(.semibold))
    }
}

private struct EntryRow: View {
    let entries: [LogmasterActivityAttributes.EntrySummary]
    var compact = false

    var body: some View {
        HStack(spacing: 0) {
            if entries.isEmpty {
                Text("No log entries yet")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(entries.indices, id: \.self) { index in
                    let entry = entries[index]
                    if index > entries.startIndex {
                        Rectangle()
                            .fill(Color(logmasterHex: entry.legColor))
                            .frame(maxWidth: .infinity)
                            .frame(height: 2)
                    }
                    ZStack {
                        Circle()
                            .fill(.white.opacity(0.78))
                        if entry.autoCreatedUnedited {
                            Circle()
                                .stroke(
                                    Color(logmasterHex: entry.legColor),
                                    style: StrokeStyle(
                                        lineWidth: compact ? 1.5 : 2,
                                        dash: compact ? [2.5, 2] : [3, 2.5]
                                    )
                                )
                        } else {
                            Circle()
                                .stroke(
                                    Color(logmasterHex: entry.legColor),
                                    lineWidth: compact ? 1.5 : 2
                                )
                        }
                        Image(systemName: entry.symbol)
                            .font(.system(size: compact ? 10 : 12, weight: .semibold))
                            .foregroundStyle(Color(red: 0.16, green: 0.17, blue: 0.19))
                    }
                    .frame(width: compact ? 27 : 35, height: compact ? 27 : 35)
                }
            }
        }
        .frame(maxWidth: .infinity)
    }
}

private struct StationaryDuration: View {
    let state: LogmasterActivityAttributes.ContentState
    var compact = false

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: state.stationaryKind == "anchored" ? "anchor" : "link")
                .foregroundStyle(.white.opacity(0.62))
            if let since = state.stationarySince {
                Text(state.stationaryKind == "anchored" ? "Anchored" : "Moored")
                    .foregroundStyle(.white.opacity(0.62))
                Text(timerInterval: since...Date.distantFuture, countsDown: false)
                    .monospacedDigit()
                    .foregroundStyle(.white)
            }
        }
        .font(compact ? .caption2.weight(.semibold) : .caption.weight(.semibold))
        .frame(maxWidth: .infinity)
        .padding(.vertical, compact ? 7 : 10)
        .background(Color(red: 0.25, green: 0.25, blue: 0.26))
        .accessibilityElement(children: .combine)
    }
}

private extension Color {
    init(logmasterHex hex: String) {
        let cleaned = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        if cleaned.count == 6 {
            self.init(
                red: Double((value >> 16) & 0xff) / 255,
                green: Double((value >> 8) & 0xff) / 255,
                blue: Double(value & 0xff) / 255
            )
        } else {
            self = .cyan
        }
    }
}

private struct StartTripLink: View {
    let urlString: String

    var body: some View {
        if let url = URL(string: urlString) {
            Link(destination: url) {
                Label("Start trip", systemImage: "record.circle")
                    .font(.subheadline.bold())
                    .foregroundStyle(.white)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 9)
                    .background(.red, in: Capsule())
            }
            .accessibilityHint("Opens logmaster and begins recording")
        }
    }
}

private struct ResumeRecordingLink: View {
    let urlString: String

    var body: some View {
        if let url = URL(string: urlString) {
            Link(destination: url) {
                ZStack {
                    Circle()
                        .fill(.white.opacity(0.75))
                    Circle()
                        .stroke(Color.black.opacity(0.14), lineWidth: 1)
                    Circle()
                        .fill(.red)
                        .frame(width: 13, height: 13)
                }
                .frame(width: 30, height: 30)
            }
            .accessibilityLabel("Resume trip recording")
            .accessibilityHint("Opens logmaster and resumes recording")
        }
    }
}

private struct CompactLeading: View {
    let state: LogmasterActivityAttributes.ContentState

    var body: some View {
        if state.mode == "stationary" {
            Image(systemName: state.stationaryKind == "anchored" ? "anchor" : "link")
                .foregroundStyle(.cyan)
        } else if state.mode == "planned" {
            Image(systemName: "record.circle")
                .foregroundStyle(.red)
        } else {
            VesselIcon(sailsUp: state.sailsUp)
        }
    }
}

private struct TrailingStatus: View {
    let state: LogmasterActivityAttributes.ContentState

    @ViewBuilder
    var body: some View {
        if state.mode == "moving" {
            Text(timerInterval: state.previousLogAt...state.nextLogAt, countsDown: true)
                .font(.caption2.bold())
                .monospacedDigit()
        } else if state.mode == "stationary", let since = state.stationarySince {
            Text(timerInterval: since...Date.distantFuture, countsDown: false)
                .font(.caption2.bold())
                .monospacedDigit()
        } else {
            Text("Ready")
                .font(.caption.bold())
        }
    }
}

private struct ExpandedBottom: View {
    let state: LogmasterActivityAttributes.ContentState

    @ViewBuilder
    var body: some View {
        switch state.mode {
        case "moving":
            HourProgress(state: state)
        case "stationary":
            EntryRow(entries: state.recentEntries)
        default:
            StartTripLink(urlString: state.deepLinkURL)
        }
    }
}
