import Capacitor
import Photos
import UIKit

@objc(LogmasterRecentPhotosPlugin)
final class LogmasterRecentPhotosPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "LogmasterRecentPhotosPlugin"
    let jsName = "LogmasterRecentPhotos"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "listRecentPhotos", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "loadRecentPhoto", returnType: CAPPluginReturnPromise),
    ]

    @objc func listRecentPhotos(_ call: CAPPluginCall) {
        let limit = min(max(call.getInt("limit") ?? 60, 1), 120)

        requestPhotoAccess { granted in
            guard granted else {
                call.reject("Photo library access denied")
                return
            }

            DispatchQueue.global(qos: .userInitiated).async {
                let fetchOptions = PHFetchOptions()
                fetchOptions.sortDescriptors = [
                    NSSortDescriptor(key: "creationDate", ascending: false),
                ]
                fetchOptions.fetchLimit = limit

                let assets = PHAsset.fetchAssets(with: .image, options: fetchOptions)
                let manager = PHImageManager.default()
                let requestOptions = PHImageRequestOptions()
                requestOptions.isSynchronous = true
                requestOptions.deliveryMode = .opportunistic
                requestOptions.resizeMode = .fast
                requestOptions.isNetworkAccessAllowed = true

                var photos: [[String: String]] = []
                assets.enumerateObjects { asset, _, _ in
                    var thumbnailBase64: String?
                    manager.requestImage(
                        for: asset,
                        targetSize: CGSize(width: 320, height: 320),
                        contentMode: .aspectFill,
                        options: requestOptions
                    ) { image, _ in
                        guard let image,
                              let data = image.jpegData(compressionQuality: 0.72) else { return }
                        thumbnailBase64 = data.base64EncodedString()
                    }
                    if let thumbnailBase64 {
                        photos.append([
                            "localIdentifier": asset.localIdentifier,
                            "thumbnailBase64": thumbnailBase64,
                        ])
                    }
                }

                call.resolve(["photos": photos])
            }
        }
    }

    @objc func loadRecentPhoto(_ call: CAPPluginCall) {
        guard let localIdentifier = call.getString("localIdentifier"), !localIdentifier.isEmpty else {
            call.reject("localIdentifier is required")
            return
        }

        requestPhotoAccess { granted in
            guard granted else {
                call.reject("Photo library access denied")
                return
            }

            DispatchQueue.global(qos: .userInitiated).async {
                let assets = PHAsset.fetchAssets(
                    withLocalIdentifiers: [localIdentifier],
                    options: nil
                )
                guard let asset = assets.firstObject else {
                    call.reject("Photo not found")
                    return
                }

                let options = PHImageRequestOptions()
                options.isSynchronous = true
                options.deliveryMode = .highQualityFormat
                options.isNetworkAccessAllowed = true
                options.version = .current

                var imageData: Data?
                PHImageManager.default().requestImageDataAndOrientation(
                    for: asset,
                    options: options
                ) { data, _, _, _ in
                    imageData = data
                }

                guard let imageData, !imageData.isEmpty else {
                    call.reject("Could not load photo")
                    return
                }

                let format = Self.detectFormat(from: imageData)
                call.resolve([
                    "base64": imageData.base64EncodedString(),
                    "format": format,
                ])
            }
        }
    }

    private func requestPhotoAccess(_ handler: @escaping (Bool) -> Void) {
        let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        switch status {
        case .authorized, .limited:
            handler(true)
        case .notDetermined:
            PHPhotoLibrary.requestAuthorization(for: .readWrite) { newStatus in
                handler(newStatus == .authorized || newStatus == .limited)
            }
        default:
            handler(false)
        }
    }

    private static func detectFormat(from data: Data) -> String {
        guard data.count >= 12 else { return "jpeg" }
        if data.starts(with: [0x89, 0x50, 0x4E, 0x47]) { return "png" }
        if data.starts(with: [0x47, 0x49, 0x46]) { return "gif" }
        if data[4...7] == Data([0x66, 0x74, 0x79, 0x70]) { return "heic" }
        return "jpeg"
    }
}
