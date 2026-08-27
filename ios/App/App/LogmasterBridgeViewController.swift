import Capacitor

@objc(LogmasterBridgeViewController)
final class LogmasterBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(LogmasterLiveActivityPlugin())
    }
}
