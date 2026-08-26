import Foundation
import MapKit
import UIKit
import WebKit

final class MapTouchForwarderView: UIView {
    weak var mapView: MKMapView?
    var passThroughRects: [CGRect] = []
    var onUserInteraction: (() -> Void)?

    private func shouldPassThrough(at point: CGPoint) -> Bool {
        passThroughRects.contains(where: { $0.contains(point) })
    }

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        isMultipleTouchEnabled = true

        let pan = UIPanGestureRecognizer(target: self, action: #selector(handlePan(_:)))
        pan.minimumNumberOfTouches = 1
        pan.maximumNumberOfTouches = 1
        pan.cancelsTouchesInView = false
        pan.delaysTouchesBegan = false
        pan.delegate = self
        addGestureRecognizer(pan)

        let twoFingerPan = UIPanGestureRecognizer(target: self, action: #selector(handleTwoFingerPan(_:)))
        twoFingerPan.minimumNumberOfTouches = 2
        twoFingerPan.maximumNumberOfTouches = 2
        twoFingerPan.cancelsTouchesInView = false
        twoFingerPan.delaysTouchesBegan = false
        twoFingerPan.delegate = self
        addGestureRecognizer(twoFingerPan)

        let pinch = UIPinchGestureRecognizer(target: self, action: #selector(handlePinch(_:)))
        pinch.cancelsTouchesInView = false
        pinch.delaysTouchesBegan = false
        pinch.delegate = self
        addGestureRecognizer(pinch)
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

    @objc private func handlePan(_ gesture: UIPanGestureRecognizer) {
        guard let mapView else { return }
        if gesture.state == .began {
            onUserInteraction?()
        }
        guard gesture.state == .changed || gesture.state == .ended else { return }

        let translation = gesture.translation(in: self)
        gesture.setTranslation(.zero, in: self)

        var region = mapView.region
        let span = region.span
        let width = max(bounds.width, 1)
        let height = max(bounds.height, 1)
        region.center.longitude -= Double(translation.x / width) * span.longitudeDelta
        region.center.latitude += Double(translation.y / height) * span.latitudeDelta
        mapView.setRegion(region, animated: false)
    }

    @objc private func handleTwoFingerPan(_ gesture: UIPanGestureRecognizer) {
        guard let mapView else { return }
        if gesture.state == .began {
            onUserInteraction?()
        }
        guard gesture.state == .changed else { return }

        let translation = gesture.translation(in: self)
        gesture.setTranslation(.zero, in: self)

        // Drag up to zoom in, down to zoom out (matches Apple Maps trackpad-style feel).
        let zoomFactor = exp(Double(-translation.y) / 180.0)
        var region = mapView.region
        region.span.latitudeDelta /= zoomFactor
        region.span.longitudeDelta /= zoomFactor
        mapView.setRegion(region, animated: false)
    }

    @objc private func handlePinch(_ gesture: UIPinchGestureRecognizer) {
        guard let mapView else { return }
        if gesture.state == .began {
            onUserInteraction?()
        }
        guard gesture.state == .changed else { return }

        var region = mapView.region
        let scale = max(0.05, min(Double(gesture.scale), 20))
        region.span.latitudeDelta /= scale
        region.span.longitudeDelta /= scale
        mapView.setRegion(region, animated: false)
        gesture.scale = 1
    }
}

extension MapTouchForwarderView: UIGestureRecognizerDelegate {
    override func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
        let point = gestureRecognizer.location(in: self)
        return !shouldPassThrough(at: point)
    }

    func gestureRecognizer(
        _ gestureRecognizer: UIGestureRecognizer,
        shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
    ) -> Bool {
        true
    }
}

final class AppleMapViewDelegate: NSObject, MKMapViewDelegate {
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
            renderer.fillColor = UIColor(red: 235 / 255, green: 69 / 255, blue: 57 / 255, alpha: 0.95)
            renderer.strokeColor = UIColor.white
            renderer.lineWidth = 2
            return renderer
        }

        return MKOverlayRenderer(overlay: overlay)
    }
}

final class AppleMapInstance {
    let mapView: MKMapView
    let delegate: AppleMapViewDelegate
    let touchForwarder: MapTouchForwarderView
    var trackOverlay: MKPolyline?
    var entryOverlays: [MKCircle] = []
    var interactive = false
    private weak var webView: WKWebView?

    init() {
        delegate = AppleMapViewDelegate()
        touchForwarder = MapTouchForwarderView(frame: .zero)
        mapView = MKMapView(frame: .zero)
        mapView.delegate = delegate
        mapView.isRotateEnabled = false
        mapView.isPitchEnabled = false
        mapView.pointOfInterestFilter = MKPointOfInterestFilter(including: [])
        mapView.showsCompass = false
        mapView.overrideUserInterfaceStyle = .light
        mapView.isHidden = true
        mapView.isUserInteractionEnabled = false

        touchForwarder.mapView = mapView
        touchForwarder.onUserInteraction = { [weak self] in
            self?.setFollowUserLocation(false)
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

        webView.scrollView.isScrollEnabled = !interactive
        webView.scrollView.bounces = !interactive
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

    func setEntryPoints(_ coordinates: [CLLocationCoordinate2D]) {
        for circle in entryOverlays {
            mapView.removeOverlay(circle)
        }
        entryOverlays = []
        for coordinate in coordinates {
            let circle = MKCircle(center: coordinate, radius: 18)
            entryOverlays.append(circle)
            mapView.addOverlay(circle)
        }
    }
}
