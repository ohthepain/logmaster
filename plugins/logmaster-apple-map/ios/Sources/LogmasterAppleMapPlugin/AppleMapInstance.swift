import Foundation
import MapKit
import UIKit
import WebKit

private enum AppleMapEntryMarkerStyle {
    static let hitRadius: CGFloat = 36
    static let selectedScale: CGFloat = 1.35
}

private enum AppleMapCameraMath {
    static let minDistance: CLLocationDistance = 80
    static let maxDistance: CLLocationDistance = 20_000_000
    static let maxPitch: CGFloat = 70
    static let pitchPointsToDegrees: CGFloat = 0.28

    static func distance(of camera: MKMapCamera) -> CLLocationDistance {
        if #available(iOS 16.0, *) {
            return camera.centerCoordinateDistance
        }
        return camera.altitude
    }

    static func setDistance(_ camera: MKMapCamera, _ distance: CLLocationDistance) {
        let clamped = min(max(distance, minDistance), maxDistance)
        if #available(iOS 16.0, *) {
            camera.centerCoordinateDistance = clamped
        } else {
            camera.altitude = clamped
        }
    }

    static func zoom(_ camera: MKMapCamera, by factor: Double) {
        guard factor > 0, factor.isFinite else { return }
        setDistance(camera, distance(of: camera) / factor)
    }

    /// Drag up (negative y) increases pitch, matching Apple Maps.
    static func tilt(_ camera: MKMapCamera, byPoints dy: CGFloat) {
        camera.pitch = min(max(camera.pitch - dy * pitchPointsToDegrees, 0), maxPitch)
    }
}

final class MapTouchForwarderView: UIView {
    weak var mapView: MKMapView?
    var passThroughRects: [CGRect] = []
    var onUserInteraction: (() -> Void)?
    var onEntryTap: ((String) -> Void)?
    var onEntryPreview: ((String, CGPoint) -> Void)?
    var entryIdAtPoint: ((CGPoint) -> String?)?

    private var pinchRecognizer: UIPinchGestureRecognizer?
    private var twoFingerPanRecognizer: UIPanGestureRecognizer?
    private var longPressRecognizer: UILongPressGestureRecognizer?
    private var panRecognizer: UIPanGestureRecognizer?
    private var suppressNextEntryTap = false

    private func shouldPassThrough(at point: CGPoint) -> Bool {
        passThroughRects.contains(where: { $0.contains(point) })
    }

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        isMultipleTouchEnabled = true

        let pinch = UIPinchGestureRecognizer(target: self, action: #selector(handlePinch(_:)))
        pinch.cancelsTouchesInView = true
        pinch.delaysTouchesBegan = false
        pinch.delegate = self
        addGestureRecognizer(pinch)
        pinchRecognizer = pinch

        let pan = UIPanGestureRecognizer(target: self, action: #selector(handlePan(_:)))
        pan.minimumNumberOfTouches = 1
        pan.maximumNumberOfTouches = 1
        pan.cancelsTouchesInView = true
        pan.delaysTouchesBegan = false
        pan.delegate = self
        addGestureRecognizer(pan)
        panRecognizer = pan

        let twoFingerPan = UIPanGestureRecognizer(target: self, action: #selector(handleTwoFingerPan(_:)))
        twoFingerPan.minimumNumberOfTouches = 2
        twoFingerPan.maximumNumberOfTouches = 2
        twoFingerPan.cancelsTouchesInView = true
        twoFingerPan.delaysTouchesBegan = false
        twoFingerPan.delegate = self
        addGestureRecognizer(twoFingerPan)
        twoFingerPanRecognizer = twoFingerPan

        let longPress = UILongPressGestureRecognizer(target: self, action: #selector(handleLongPress(_:)))
        longPress.minimumPressDuration = 0.4
        longPress.allowableMovement = 12
        longPress.cancelsTouchesInView = false
        longPress.delaysTouchesBegan = false
        longPress.delegate = self
        addGestureRecognizer(longPress)
        longPressRecognizer = longPress

        let tap = UITapGestureRecognizer(target: self, action: #selector(handleTap(_:)))
        tap.cancelsTouchesInView = false
        tap.delaysTouchesBegan = false
        tap.delegate = self
        tap.require(toFail: longPress)
        addGestureRecognizer(tap)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func point(inside testPoint: CGPoint, with event: UIEvent?) -> Bool {
        guard bounds.contains(testPoint) else { return false }
        return !shouldPassThrough(at: testPoint)
    }

    override func hitTest(_ hitPoint: CGPoint, with event: UIEvent?) -> UIView? {
        guard bounds.contains(hitPoint), !shouldPassThrough(at: hitPoint) else { return nil }
        return self
    }

    private func mutateCamera(_ body: (MKMapCamera) -> Void) {
        guard let mapView else { return }
        let camera = mapView.camera.copy() as! MKMapCamera
        body(camera)
        mapView.setCamera(camera, animated: false)
    }

    @objc private func handleLongPress(_ gesture: UILongPressGestureRecognizer) {
        guard gesture.state == .began, let mapView else { return }
        let point = gesture.location(in: mapView)
        guard !shouldPassThrough(at: gesture.location(in: self)) else { return }
        if let entryId = entryIdAtPoint?(point) {
            suppressNextEntryTap = true
            onEntryPreview?(entryId, point)
        }
    }

    @objc private func handleTap(_ gesture: UITapGestureRecognizer) {
        guard gesture.state == .ended, let mapView else { return }
        if suppressNextEntryTap {
            suppressNextEntryTap = false
            return
        }
        let point = gesture.location(in: mapView)
        guard !shouldPassThrough(at: gesture.location(in: self)) else { return }
        if let entryId = entryIdAtPoint?(point) {
            onEntryTap?(entryId)
        }
    }

    @objc private func handlePan(_ gesture: UIPanGestureRecognizer) {
        guard let mapView else { return }
        if gesture.state == .began {
            onUserInteraction?()
            if let webView = mapView.superview as? WKWebView {
                webView.scrollView.contentOffset = .zero
            }
        }
        guard gesture.state == .changed else { return }

        let translation = gesture.translation(in: self)
        gesture.setTranslation(.zero, in: self)

        let width = max(bounds.width, 1)
        let height = max(bounds.height, 1)
        let mapRect = mapView.visibleMapRect
        let deltaX = Double(translation.x / width) * mapRect.size.width
        let deltaY = Double(translation.y / height) * mapRect.size.height

        mutateCamera { camera in
            let centerPoint = MKMapPoint(camera.centerCoordinate)
            let shifted = MKMapPoint(
                x: centerPoint.x - deltaX,
                y: centerPoint.y - deltaY
            )
            camera.centerCoordinate = shifted.coordinate
        }
    }

    @objc private func handleTwoFingerPan(_ gesture: UIPanGestureRecognizer) {
        guard gesture.numberOfTouches == 2 else { return }
        if gesture.state == .began {
            onUserInteraction?()
        }
        guard gesture.state == .changed else { return }

        let translation = gesture.translation(in: self)
        gesture.setTranslation(.zero, in: self)

        if let pinch = pinchRecognizer, pinch.state == .began || pinch.state == .changed {
            return
        }

        mutateCamera { camera in
            AppleMapCameraMath.tilt(camera, byPoints: translation.y)
        }
    }

    @objc private func handlePinch(_ gesture: UIPinchGestureRecognizer) {
        guard let mapView else { return }
        if gesture.state == .began {
            onUserInteraction?()
        }
        guard gesture.state == .changed else { return }

        let scale = max(0.05, min(Double(gesture.scale), 20))
        gesture.scale = 1

        let pinchPoint = gesture.location(in: mapView)
        let coordinateUnderPinch = mapView.convert(pinchPoint, toCoordinateFrom: mapView)

        mutateCamera { camera in
            AppleMapCameraMath.zoom(camera, by: scale)
        }

        mutateCamera { camera in
            let newCoordinateUnderPinch = mapView.convert(pinchPoint, toCoordinateFrom: mapView)
            camera.centerCoordinate = CLLocationCoordinate2D(
                latitude: camera.centerCoordinate.latitude
                    + (coordinateUnderPinch.latitude - newCoordinateUnderPinch.latitude),
                longitude: camera.centerCoordinate.longitude
                    + (coordinateUnderPinch.longitude - newCoordinateUnderPinch.longitude)
            )
        }
    }
}

extension MapTouchForwarderView: UIGestureRecognizerDelegate {
    override func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
        let point = gestureRecognizer.location(in: self)
        guard !shouldPassThrough(at: point) else { return false }

        if gestureRecognizer === panRecognizer, let mapView {
            let mapPoint = gestureRecognizer.location(in: mapView)
            if entryIdAtPoint?(mapPoint) != nil {
                return false
            }
        }

        return true
    }

    func gestureRecognizer(
        _ gestureRecognizer: UIGestureRecognizer,
        shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
    ) -> Bool {
        let pair = [gestureRecognizer, otherGestureRecognizer]
        let pinchAndTilt = pair.contains(where: { $0 === pinchRecognizer })
            && pair.contains(where: { $0 === twoFingerPanRecognizer })
        return pinchAndTilt
    }
}

struct EntryMarker {
    let entryId: String
    let coordinate: CLLocationCoordinate2D
    let image: UIImage?
}

struct EntryCircleMarker {
    let overlay: MKCircle
    let entryId: String
}

struct PlaybackMarker {
    let coordinate: CLLocationCoordinate2D
    let heading: Double
}

final class LogEntryMarkerAnnotation: NSObject, MKAnnotation {
    let entryId: String
    var coordinate: CLLocationCoordinate2D
    let image: UIImage?

    init(entryId: String, coordinate: CLLocationCoordinate2D, image: UIImage?) {
        self.entryId = entryId
        self.coordinate = coordinate
        self.image = image
        super.init()
    }
}

final class PlaybackBoatAnnotation: NSObject, MKAnnotation {
    @objc dynamic var coordinate: CLLocationCoordinate2D
    var heading: Double

    init(coordinate: CLLocationCoordinate2D, heading: Double) {
        self.coordinate = coordinate
        self.heading = heading
        super.init()
    }
}

final class AppleMapViewDelegate: NSObject, MKMapViewDelegate {
    var selectedEntryId: String?
    var entryMarkerScale: (LogEntryMarkerAnnotation) -> CGFloat = { _ in 1 }

    func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
        if let polyline = overlay as? MKPolyline {
            let renderer = MKPolylineRenderer(polyline: polyline)
            renderer.strokeColor = UIColor(red: 235 / 255, green: 69 / 255, blue: 57 / 255, alpha: 0.95)
            renderer.lineWidth = 3
            renderer.lineCap = .round
            renderer.lineJoin = .round
            return renderer
        }

        if let circle = overlay as? MKCircle {
            let renderer = MKCircleRenderer(circle: circle)
            renderer.fillColor = UIColor.white
            renderer.strokeColor = UIColor(red: 235 / 255, green: 69 / 255, blue: 57 / 255, alpha: 0.95)
            renderer.lineWidth = 2
            return renderer
        }

        return MKOverlayRenderer(overlay: overlay)
    }

    func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
        if annotation is MKUserLocation {
            return nil
        }
        guard let marker = annotation as? LogEntryMarkerAnnotation else {
            guard let boat = annotation as? PlaybackBoatAnnotation else { return nil }
            let identifier = "playback-boat-marker"
            let view = mapView.dequeueReusableAnnotationView(withIdentifier: identifier)
                ?? MKAnnotationView(annotation: boat, reuseIdentifier: identifier)
            view.annotation = boat
            view.image = UIImage(systemName: "sailboat.fill")?
                .withTintColor(UIColor(red: 235 / 255, green: 69 / 255, blue: 57 / 255, alpha: 1), renderingMode: .alwaysOriginal)
            view.backgroundColor = .white
            view.layer.cornerRadius = 15
            view.layer.borderWidth = 1.5
            view.layer.borderColor = UIColor.black.withAlphaComponent(0.65).cgColor
            view.bounds = CGRect(x: 0, y: 0, width: 30, height: 30)
            view.transform = CGAffineTransform(rotationAngle: CGFloat(boat.heading * .pi / 180))
            view.displayPriority = .required
            view.collisionMode = .circle
            return view
        }
        let identifier = "log-entry-marker"
        let view = mapView.dequeueReusableAnnotationView(withIdentifier: identifier)
            ?? MKAnnotationView(annotation: marker, reuseIdentifier: identifier)
        view.annotation = marker
        view.image = marker.image
        view.canShowCallout = false
        view.displayPriority = marker.entryId == selectedEntryId ? .required : .defaultHigh
        view.collisionMode = .circle
        let scale = entryMarkerScale(marker)
        view.transform = CGAffineTransform(scaleX: scale, y: scale)
        view.layer.zPosition = marker.entryId == selectedEntryId ? 100 : 0
        return view
    }
}

final class AppleMapInstance {
    let mapView: MKMapView
    let delegate: AppleMapViewDelegate
    let touchForwarder: MapTouchForwarderView
    var trackOverlay: MKPolyline?
    var entryOverlays: [MKCircle] = []
    var entryCircleMarkers: [EntryCircleMarker] = []
    var entryAnnotations: [LogEntryMarkerAnnotation] = []
    var playbackAnnotation: PlaybackBoatAnnotation?
    var selectedEntryId: String?
    var onEntrySelected: ((String) -> Void)?
    var onEntryPreview: ((String, CGPoint) -> Void)?
    var interactive = false
    private weak var webView: WKWebView?

    init() {
        delegate = AppleMapViewDelegate()
        touchForwarder = MapTouchForwarderView(frame: .zero)
        mapView = MKMapView(frame: .zero)
        mapView.delegate = delegate
        mapView.isRotateEnabled = false
        mapView.isPitchEnabled = true
        mapView.pointOfInterestFilter = MKPointOfInterestFilter(including: [])
        mapView.showsCompass = false
        mapView.overrideUserInterfaceStyle = .light
        mapView.isHidden = true
        mapView.isUserInteractionEnabled = false

        touchForwarder.mapView = mapView
        touchForwarder.onUserInteraction = { [weak self] in
            self?.setFollowUserLocation(false)
        }
        touchForwarder.entryIdAtPoint = { [weak self] point in
            self?.entryId(at: point)
        }
        touchForwarder.onEntryTap = { [weak self] entryId in
            self?.onEntrySelected?(entryId)
        }
        touchForwarder.onEntryPreview = { [weak self] entryId, point in
            self?.onEntryPreview?(entryId, point)
        }
        delegate.entryMarkerScale = { [weak self] marker in
            marker.entryId == self?.selectedEntryId
                ? AppleMapEntryMarkerStyle.selectedScale
                : 1
        }

        if #available(iOS 16.0, *) {
            let config = MKStandardMapConfiguration(
                elevationStyle: .realistic,
                emphasisStyle: .muted
            )
            config.pointOfInterestFilter = MKPointOfInterestFilter(including: [])
            config.showsTraffic = false
            mapView.preferredConfiguration = config
        } else {
            mapView.mapType = .standard
        }
    }

    func attach(to webView: WKWebView, interactive: Bool) {
        self.webView = webView
        self.interactive = interactive

        Self.configureHostScrollView(webView, mapInteractive: interactive)
        webView.scrollView.contentOffset = .zero
        webView.scrollView.contentInset = .zero

        mapView.removeFromSuperview()
        touchForwarder.removeFromSuperview()

        webView.insertSubview(mapView, at: 0)
        mapView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        applyHostBounds()

        if interactive {
            webView.insertSubview(touchForwarder, aboveSubview: webView.scrollView)
            touchForwarder.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            touchForwarder.frame = webView.bounds
            touchForwarder.isHidden = false
        } else {
            touchForwarder.isHidden = true
        }
    }

    private static func configureHostScrollView(_ webView: WKWebView, mapInteractive: Bool) {
        let scrollView = webView.scrollView
        scrollView.isScrollEnabled = !mapInteractive
        scrollView.bounces = !mapInteractive
        scrollView.bouncesZoom = !mapInteractive
        scrollView.panGestureRecognizer.isEnabled = !mapInteractive
        scrollView.pinchGestureRecognizer?.isEnabled = !mapInteractive
        if mapInteractive {
            scrollView.minimumZoomScale = 1
            scrollView.maximumZoomScale = 1
            scrollView.contentOffset = .zero
            scrollView.contentInset = .zero
        }
        for recognizer in scrollView.gestureRecognizers ?? [] {
            if let pan = recognizer as? UIPanGestureRecognizer, pan !== scrollView.panGestureRecognizer {
                pan.isEnabled = !mapInteractive
            }
        }
    }

    func zoom(by factor: Double) {
        let camera = mapView.camera.copy() as! MKMapCamera
        AppleMapCameraMath.zoom(camera, by: factor)
        mapView.setCamera(camera, animated: false)
    }

    func setFollowUserLocation(_ follow: Bool) {
        guard mapView.showsUserLocation else {
            mapView.setUserTrackingMode(.none, animated: true)
            return
        }
        mapView.setUserTrackingMode(follow ? .follow : .none, animated: true)
    }

    func applyHostBounds() {
        guard let webView else { return }
        webView.layoutIfNeeded()
        let bounds = webView.bounds
        guard bounds.width >= 1, bounds.height >= 1 else { return }
        mapView.frame = bounds
        mapView.isHidden = false
        if interactive {
            Self.configureHostScrollView(webView, mapInteractive: true)
            touchForwarder.frame = bounds
        }
    }

    func setInteractionEnabled(_ enabled: Bool) {
        guard interactive else {
            touchForwarder.isUserInteractionEnabled = false
            return
        }
        touchForwarder.isUserInteractionEnabled = enabled
    }

    func setTouchCaptureSuspended(_ suspended: Bool, fullScreenPassThrough: CGRect) {
        if suspended {
            touchForwarder.isUserInteractionEnabled = false
            touchForwarder.passThroughRects = [fullScreenPassThrough]
        } else if interactive {
            touchForwarder.isUserInteractionEnabled = true
        }
    }

    func applyPassThroughRects(_ rects: [CGRect]) {
        touchForwarder.passThroughRects = rects
    }

    func setTrack(_ coordinates: [CLLocationCoordinate2D]) {
        if let trackOverlay {
            mapView.removeOverlay(trackOverlay)
            self.trackOverlay = nil
        }
        guard coordinates.count >= 2 else { return }
        var mutable = coordinates
        let polyline = MKPolyline(coordinates: &mutable, count: mutable.count)
        trackOverlay = polyline
        mapView.addOverlay(polyline)
    }

    func setSelectedEntryId(_ entryId: String?) {
        selectedEntryId = entryId
        delegate.selectedEntryId = entryId
        refreshEntryAnnotationViews()
    }

    func entryId(at point: CGPoint) -> String? {
        let hitRadius = AppleMapEntryMarkerStyle.hitRadius
        var nearestId: String?
        var nearestDistance = hitRadius

        for annotation in entryAnnotations {
            let markerPoint = mapView.convert(annotation.coordinate, toPointTo: mapView)
            let distance = hypot(markerPoint.x - point.x, markerPoint.y - point.y)
            if distance <= nearestDistance {
                nearestDistance = distance
                nearestId = annotation.entryId
            }
        }

        for marker in entryCircleMarkers {
            let markerPoint = mapView.convert(marker.overlay.coordinate, toPointTo: mapView)
            let distance = hypot(markerPoint.x - point.x, markerPoint.y - point.y)
            if distance <= nearestDistance {
                nearestDistance = distance
                nearestId = marker.entryId
            }
        }

        return nearestId
    }

    private func refreshEntryAnnotationViews() {
        for annotation in entryAnnotations {
            guard let view = mapView.view(for: annotation) else { continue }
            let scale = delegate.entryMarkerScale(annotation)
            view.transform = CGAffineTransform(scaleX: scale, y: scale)
            view.layer.zPosition = annotation.entryId == selectedEntryId ? 100 : 0
            view.displayPriority = annotation.entryId == selectedEntryId ? .required : .defaultHigh
        }
    }

    func setEntryPoints(_ markers: [EntryMarker]) {
        if !entryAnnotations.isEmpty {
            mapView.removeAnnotations(entryAnnotations)
            entryAnnotations = []
        }
        for circle in entryOverlays {
            mapView.removeOverlay(circle)
        }
        entryOverlays = []
        entryCircleMarkers = []

        for marker in markers {
            if let image = marker.image {
                let annotation = LogEntryMarkerAnnotation(
                    entryId: marker.entryId,
                    coordinate: marker.coordinate,
                    image: image
                )
                entryAnnotations.append(annotation)
                mapView.addAnnotation(annotation)
                continue
            }
            let circle = MKCircle(center: marker.coordinate, radius: 18)
            entryOverlays.append(circle)
            entryCircleMarkers.append(EntryCircleMarker(overlay: circle, entryId: marker.entryId))
            mapView.addOverlay(circle)
        }
        refreshEntryAnnotationViews()
    }

    func setPlaybackPosition(_ marker: PlaybackMarker?) {
        guard let marker else {
            if let playbackAnnotation {
                mapView.removeAnnotation(playbackAnnotation)
                self.playbackAnnotation = nil
            }
            return
        }

        if let annotation = playbackAnnotation {
            annotation.coordinate = marker.coordinate
            annotation.heading = marker.heading
            if let view = mapView.view(for: annotation) {
                view.transform = CGAffineTransform(rotationAngle: CGFloat(marker.heading * .pi / 180))
            }
            return
        }

        let annotation = PlaybackBoatAnnotation(
            coordinate: marker.coordinate,
            heading: marker.heading
        )
        playbackAnnotation = annotation
        mapView.addAnnotation(annotation)
    }
}
