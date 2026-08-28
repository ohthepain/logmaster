import Foundation
import Capacitor
import MapKit
import WebKit

@objc(LogmasterAppleMapPlugin)
public class LogmasterAppleMapPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LogmasterAppleMapPlugin"
    public let jsName = "LogmasterAppleMap"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "create", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "destroy", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setLayout", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setVisible", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setCamera", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "fitCoordinates", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setOverlays", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setSelectedEntry", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setPlaybackPosition", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setShowsUserLocation", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setInteractionEnabled", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setTouchCaptureSuspended", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "adjustZoom", returnType: CAPPluginReturnPromise),
    ]

    private var maps: [String: AppleMapInstance] = [:]

    @objc func create(_ call: CAPPluginCall) {
        guard let mapId = call.getString("mapId"), !mapId.isEmpty else {
            call.reject("mapId is required")
            return
        }

        let interactive = call.getBool("interactive") ?? true

        DispatchQueue.main.async {
            if self.maps[mapId] != nil {
                call.resolve()
                return
            }

            guard let webView = self.bridge?.webView else {
                call.reject("Could not find host view")
                return
            }

            webView.isOpaque = false
            webView.backgroundColor = .clear
            webView.scrollView.backgroundColor = .clear

            let instance = AppleMapInstance()
            instance.attach(to: webView, interactive: interactive)
            instance.onEntrySelected = { [weak self] entryId in
                self?.notifyListeners("entrySelected", data: [
                    "mapId": mapId,
                    "entryId": entryId,
                ])
            }
            instance.onEntryPreview = { [weak self] entryId, point in
                self?.notifyListeners("entryPreview", data: [
                    "mapId": mapId,
                    "entryId": entryId,
                    "x": point.x,
                    "y": point.y,
                ])
            }
            self.maps[mapId] = instance
            self.scheduleLayoutRetry(for: mapId, attempt: 0) {
                call.resolve()
            }
        }
    }

    @objc func destroy(_ call: CAPPluginCall) {
        guard let mapId = call.getString("mapId"), !mapId.isEmpty else {
            call.reject("mapId is required")
            return
        }

        DispatchQueue.main.async {
            guard let instance = self.maps.removeValue(forKey: mapId) else {
                call.resolve()
                return
            }
            instance.touchForwarder.removeFromSuperview()
            instance.mapView.removeFromSuperview()
            call.resolve()
        }
    }

    @objc func setLayout(_ call: CAPPluginCall) {
        guard let mapId = call.getString("mapId") else {
            call.reject("mapId is required")
            return
        }

        DispatchQueue.main.async {
            guard let instance = self.maps[mapId] else {
                call.reject("Map not found")
                return
            }
            if let raw = call.getArray("passThrough") as? [[String: Any]] {
                let rects = Self.parsePassThroughRects(raw)
                instance.applyPassThroughRects(rects)
            }
            call.resolve()
        }
    }

    @objc func setVisible(_ call: CAPPluginCall) {
        guard let mapId = call.getString("mapId"),
              let visible = call.getBool("visible") else {
            call.reject("mapId and visible are required")
            return
        }

        DispatchQueue.main.async {
            guard let instance = self.maps[mapId] else {
                call.reject("Map not found")
                return
            }
            if visible {
                instance.applyHostBounds()
            }
            instance.mapView.isHidden = !visible
            call.resolve()
        }
    }

    @objc func setCamera(_ call: CAPPluginCall) {
        guard let mapId = call.getString("mapId"),
              let center = call.getObject("center"),
              let latitude = center["latitude"] as? Double,
              let longitude = center["longitude"] as? Double else {
            call.reject("mapId and center are required")
            return
        }

        let spanLat = call.getDouble("spanLatitude") ?? 0.08
        let spanLng = call.getDouble("spanLongitude") ?? 0.08

        DispatchQueue.main.async {
            guard let instance = self.maps[mapId] else {
                call.reject("Map not found")
                return
            }
            instance.applyHostBounds()
            let region = MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: latitude, longitude: longitude),
                span: MKCoordinateSpan(latitudeDelta: spanLat, longitudeDelta: spanLng)
            )
            instance.mapView.setRegion(region, animated: false)
            call.resolve()
        }
    }

    @objc func fitCoordinates(_ call: CAPPluginCall) {
        guard let mapId = call.getString("mapId"),
              let raw = call.getArray("coordinates") as? [[String: Any]] else {
            call.reject("mapId and coordinates are required")
            return
        }

        let padding = call.getDouble("padding") ?? 48
        let coordinates = Self.parseCoordinates(raw)
        guard !coordinates.isEmpty else {
            call.reject("coordinates must not be empty")
            return
        }

        DispatchQueue.main.async {
            guard let instance = self.maps[mapId] else {
                call.reject("Map not found")
                return
            }
            instance.applyHostBounds()

            if coordinates.count == 1, let only = coordinates.first {
                let region = MKCoordinateRegion(
                    center: only,
                    span: MKCoordinateSpan(latitudeDelta: 0.06, longitudeDelta: 0.06)
                )
                instance.mapView.setRegion(region, animated: false)
                call.resolve()
                return
            }

            var mutable = coordinates
            let polyline = MKPolyline(coordinates: &mutable, count: mutable.count)
            let rect = polyline.boundingMapRect
            let edge = UIEdgeInsets(
                top: padding,
                left: padding,
                bottom: padding,
                right: padding
            )
            instance.mapView.setVisibleMapRect(rect, edgePadding: edge, animated: true)
            call.resolve()
        }
    }

    @objc func setOverlays(_ call: CAPPluginCall) {
        guard let mapId = call.getString("mapId") else {
            call.reject("mapId is required")
            return
        }

        let track = Self.parseCoordinates(call.getArray("track") as? [[String: Any]] ?? [])
        let entryPoints = Self.parseEntryMarkers(call.getArray("entryPoints") as? [[String: Any]] ?? [])

        DispatchQueue.main.async {
            guard let instance = self.maps[mapId] else {
                call.reject("Map not found")
                return
            }
            instance.setTrack(track)
            instance.setEntryPoints(entryPoints)
            call.resolve()
        }
    }

    @objc func setSelectedEntry(_ call: CAPPluginCall) {
        guard let mapId = call.getString("mapId") else {
            call.reject("mapId is required")
            return
        }

        DispatchQueue.main.async {
            guard let instance = self.maps[mapId] else {
                call.reject("Map not found")
                return
            }
            instance.setSelectedEntryId(call.getString("selectedEntryId"))
            call.resolve()
        }
    }

    @objc func setShowsUserLocation(_ call: CAPPluginCall) {
        guard let mapId = call.getString("mapId"),
              let show = call.getBool("show") else {
            call.reject("mapId and show are required")
            return
        }

        let follow = call.getBool("follow") ?? false

        DispatchQueue.main.async {
            guard let instance = self.maps[mapId] else {
                call.reject("Map not found")
                return
            }
            instance.mapView.showsUserLocation = show
            instance.setFollowUserLocation(follow)
            call.resolve()
        }
    }

    @objc func setPlaybackPosition(_ call: CAPPluginCall) {
        guard let mapId = call.getString("mapId") else {
            call.reject("mapId is required")
            return
        }

        var marker: PlaybackMarker?
        if let position = call.getObject("position"),
           let latitude = position["latitude"] as? Double,
           let longitude = position["longitude"] as? Double {
            marker = PlaybackMarker(
                coordinate: CLLocationCoordinate2D(latitude: latitude, longitude: longitude),
                heading: position["heading"] as? Double ?? 0
            )
        }

        DispatchQueue.main.async {
            guard let instance = self.maps[mapId] else {
                call.reject("Map not found")
                return
            }
            instance.setPlaybackPosition(marker)
            call.resolve()
        }
    }

    @objc func setInteractionEnabled(_ call: CAPPluginCall) {
        guard let mapId = call.getString("mapId"),
              let enabled = call.getBool("enabled") else {
            call.reject("mapId and enabled are required")
            return
        }

        DispatchQueue.main.async {
            guard let instance = self.maps[mapId] else {
                call.reject("Map not found")
                return
            }
            instance.setInteractionEnabled(enabled)
            call.resolve()
        }
    }

    /// Suspend the native touch-capture layer so full-screen web UI (tutorial, modals) receives taps.
    @objc func setTouchCaptureSuspended(_ call: CAPPluginCall) {
        guard let suspended = call.getBool("suspended") else {
            call.reject("suspended is required")
            return
        }

        DispatchQueue.main.async {
            guard let webView = self.bridge?.webView else {
                call.resolve()
                return
            }
            let fullScreen = CGRect(origin: .zero, size: webView.bounds.size)
            for instance in self.maps.values {
                instance.setTouchCaptureSuspended(suspended, fullScreenPassThrough: fullScreen)
            }
            call.resolve()
        }
    }

    @objc func adjustZoom(_ call: CAPPluginCall) {
        guard let mapId = call.getString("mapId"),
              let factor = call.getDouble("factor"), factor > 0 else {
            call.reject("mapId and factor are required")
            return
        }

        DispatchQueue.main.async {
            guard let instance = self.maps[mapId] else {
                call.reject("Map not found")
                return
            }
            instance.setFollowUserLocation(false)
            instance.zoom(by: factor)
            call.resolve()
        }
    }

    private func hostView() -> UIView? {
        bridge?.webView
    }

    private func scheduleLayoutRetry(for mapId: String, attempt: Int, completion: @escaping () -> Void) {
        guard let instance = maps[mapId], let hostView = hostView() else {
            completion()
            return
        }

        hostView.layoutIfNeeded()
        instance.applyHostBounds()

        let bounds = instance.mapView.frame
        if bounds.width >= 1, bounds.height >= 1 {
            completion()
            return
        }

        guard attempt < 20 else {
            completion()
            return
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
            self.scheduleLayoutRetry(for: mapId, attempt: attempt + 1, completion: completion)
        }
    }

    private static func parsePassThroughRects(_ raw: [[String: Any]]) -> [CGRect] {
        raw.compactMap { item in
            guard let x = item["x"] as? Double,
                  let y = item["y"] as? Double,
                  let width = item["width"] as? Double,
                  let height = item["height"] as? Double,
                  width >= 1, height >= 1 else {
                return nil
            }
            return CGRect(x: x, y: y, width: width, height: height)
        }
    }

    private static func parseCoordinates(_ raw: [[String: Any]]) -> [CLLocationCoordinate2D] {
        raw.compactMap { item in
            guard let latitude = item["latitude"] as? Double,
                  let longitude = item["longitude"] as? Double else {
                return nil
            }
            return CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
        }
    }

    private static func parseEntryMarkers(_ raw: [[String: Any]]) -> [EntryMarker] {
        raw.compactMap { item in
            guard let entryId = item["entryId"] as? String, !entryId.isEmpty,
                  let latitude = item["latitude"] as? Double,
                  let longitude = item["longitude"] as? Double else {
                return nil
            }
            return EntryMarker(
                entryId: entryId,
                coordinate: CLLocationCoordinate2D(latitude: latitude, longitude: longitude),
                image: image(fromDataUrl: item["imageDataUrl"] as? String)
            )
        }
    }

    private static func image(fromDataUrl dataUrl: String?) -> UIImage? {
        guard let dataUrl, !dataUrl.isEmpty else { return nil }
        let payload: String
        if let comma = dataUrl.firstIndex(of: ",") {
            payload = String(dataUrl[dataUrl.index(after: comma)...])
        } else {
            payload = dataUrl
        }
        guard let data = Data(base64Encoded: payload, options: [.ignoreUnknownCharacters]),
              let image = UIImage(data: data),
              let cgImage = image.cgImage else {
            return nil
        }
        return UIImage(cgImage: cgImage, scale: 2, orientation: .up)
    }
}
