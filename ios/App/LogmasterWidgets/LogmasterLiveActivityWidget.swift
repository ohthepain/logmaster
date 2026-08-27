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
                .activityBackgroundTint(Color(red: 0.035, green: 0.12, blue: 0.17))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    VesselIcon(sailsUp: context.state.sailsUp)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.state.locationName)
                        .font(.headline)
                        .lineLimit(1)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    TrailingStatus(state: context.state)
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
                topRow
                secondRow
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, state.mode == "stationary" ? 12 : 15)

            if state.mode == "stationary" {
                StationaryDuration(state: state)
            }
        }
        .foregroundStyle(.white)
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

private struct SmallActivityContent: View {
    let state: LogmasterActivityAttributes.ContentState

    var body: some View {
        VStack(spacing: 9) {
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
            case "stationary":
                EntryRow(entries: Array(state.recentEntries.suffix(4)))
                StationaryDuration(state: state, compact: true)
            default:
                StartTripLink(urlString: state.deepLinkURL)
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

    var body: some View {
        HStack(spacing: 10) {
            if entries.isEmpty {
                Text("No log entries yet")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.7))
            } else {
                ForEach(entries, id: \.id) { entry in
                    ZStack {
                        if entry.autoCreatedUnedited {
                            Circle()
                                .stroke(
                                    .white.opacity(0.8),
                                    style: StrokeStyle(lineWidth: 1.5, dash: [3, 3])
                                )
                        } else {
                            Circle()
                                .stroke(.white.opacity(0.8), lineWidth: 1.5)
                        }
                        Image(systemName: entry.symbol)
                            .font(.system(size: 12, weight: .semibold))
                    }
                    .frame(width: 31, height: 31)
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
            if let since = state.stationarySince {
                Text(state.stationaryKind == "anchored" ? "Anchored" : "Moored")
                Text(timerInterval: since...Date.distantFuture, countsDown: false)
                    .monospacedDigit()
            }
        }
        .font(compact ? .caption2.weight(.semibold) : .caption.weight(.semibold))
        .frame(maxWidth: .infinity)
        .padding(.vertical, compact ? 7 : 10)
        .background(Color.black.opacity(0.35))
        .accessibilityElement(children: .combine)
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
