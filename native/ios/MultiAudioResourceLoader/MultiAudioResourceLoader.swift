//
//  MultiAudioResourceLoader.swift
//  Custom HLS manifest generator for seamless multi-audio track switching
//

import Foundation
import React
import AVFoundation
import react_native_video

/// Main singleton class that implements AVAssetResourceLoaderDelegate
/// to serve combined HLS manifests for multi-audio track switching
class MultiAudioResourceLoaderDelegate: NSObject, AVAssetResourceLoaderDelegate {

    // MARK: - Singleton

    static let shared = MultiAudioResourceLoaderDelegate()

    private override init() {
        super.init()
    }

    // MARK: - Properties

    private var jellyfinBaseUrl: String = ""
    private var apiKey: String = ""
    private var itemId: String = ""
    private var audioTrackInfo: [[String: Any]] = []

    private let session = URLSession.shared
    private let queue = DispatchQueue(label: "com.tomotv.multiaudio", qos: .userInitiated)

    // MARK: - Configuration

    /// Configure the resource loader with Jellyfin connection details
    func configure(baseUrl: String, apiKey: String, itemId: String, audioTracks: [[String: Any]]) {
        self.jellyfinBaseUrl = baseUrl
        self.apiKey = apiKey
        self.itemId = itemId
        self.audioTrackInfo = audioTracks

        NSLog("[MultiAudioResourceLoader] Configured for item: \(itemId) with \(audioTracks.count) audio tracks")
    }

    // MARK: - AVAssetResourceLoaderDelegate

    func resourceLoader(_ resourceLoader: AVAssetResourceLoader, shouldWaitForLoadingOfRequestedResource loadingRequest: AVAssetResourceLoadingRequest) -> Bool {
        #if DEBUG
        NSLog("[MultiAudioResourceLoader] Resource requested: \(loadingRequest.request.url?.absoluteString ?? "unknown")")
        #endif

        // Only handle our custom protocol (jellyfin-multi://)
        guard let url = loadingRequest.request.url,
              url.scheme == "jellyfin-multi" else {
            NSLog("[MultiAudioResourceLoader] Not our protocol, rejecting")
            return false
        }

        // Handle request on background queue
        queue.async {
            do {
                // Master manifest request - combine all manifests
                NSLog("[MultiAudioResourceLoader] Master manifest request")

                let (manifests, manifestUrls) = try self.fetchAllManifests()
                let combinedManifestString = try self.generateMultivariantManifest(from: manifests, fetchUrls: manifestUrls)

                // Convert string to data
                guard let combinedManifest = combinedManifestString.data(using: .utf8) else {
                    throw NSError(
                        domain: "MultiAudioResourceLoader",
                        code: 7,
                        userInfo: [NSLocalizedDescriptionKey: "Failed to encode manifest to UTF-8"]
                    )
                }

                NSLog("[MultiAudioResourceLoader] Generated combined manifest (\(combinedManifest.count) bytes)")

                // Provide manifest data to AVPlayer
                if let dataRequest = loadingRequest.dataRequest {
                    dataRequest.respond(with: combinedManifest)
                }

                // Set content type
                if let contentInfoRequest = loadingRequest.contentInformationRequest {
                    contentInfoRequest.contentType = "application/vnd.apple.mpegurl" // HLS MIME type
                    contentInfoRequest.contentLength = Int64(combinedManifest.count)
                    contentInfoRequest.isByteRangeAccessSupported = false
                }

                // Mark request as finished
                loadingRequest.finishLoading()

                NSLog("[MultiAudioResourceLoader] Request completed successfully")

            } catch {
                NSLog("[MultiAudioResourceLoader] Error serving manifest: \(error.localizedDescription)")
                loadingRequest.finishLoading(with: error)
            }
        }

        return true // We'll handle this request
    }

    // MARK: - Private Methods

    func fetchAllManifests() throws -> ([String], [String]) {
        var manifests: [String] = []
        var manifestUrls: [String] = []

        for (arrayIndex, trackInfo) in audioTrackInfo.enumerated() {
            // Get actual Jellyfin stream index from track metadata
            guard let streamIndex = trackInfo["Index"] as? Int else {
                NSLog("[MultiAudioResourceLoader] ⚠️ Missing Index for track \(arrayIndex + 1), skipping")
                continue
            }

            let manifestUrl = buildManifestUrl(audioStreamIndex: streamIndex)

            NSLog("[MultiAudioResourceLoader] Fetching manifest for stream \(streamIndex) (\(arrayIndex + 1)/\(audioTrackInfo.count))")
            #if DEBUG
            NSLog("[MultiAudioResourceLoader] Manifest URL: \(manifestUrl)")
            #endif

            // Fetch manifest synchronously (we're already on background queue)
            let manifest = try fetchManifest(from: manifestUrl)
            manifests.append(manifest)
            manifestUrls.append(manifestUrl)
        }

        return (manifests, manifestUrls)
    }

    private func buildManifestUrl(audioStreamIndex: Int) -> String {
        // Parse base URL
        guard var components = URLComponents(string: jellyfinBaseUrl) else {
            return jellyfinBaseUrl
        }

        var queryItems = components.queryItems ?? []

        // Add audioStreamIndex to select which audio track to encode
        queryItems.append(URLQueryItem(name: "audioStreamIndex", value: "\(audioStreamIndex)"))

        // Add UNIQUE playSessionId to force separate transcode session
        // This is critical: Jellyfin reuses transcode sessions without unique IDs,
        // resulting in all audio tracks playing the same audio
        let sessionId = "multi-audio-\(itemId)-track-\(audioStreamIndex)"
        queryItems.append(URLQueryItem(name: "playSessionId", value: sessionId))

        components.queryItems = queryItems

        return components.url?.absoluteString ?? jellyfinBaseUrl
    }

    private func fetchManifest(from urlString: String) throws -> String {
        guard let url = URL(string: urlString) else {
            throw NSError(
                domain: "MultiAudioResourceLoader",
                code: 3,
                userInfo: [NSLocalizedDescriptionKey: "Invalid manifest URL"]
            )
        }

        let semaphore = DispatchSemaphore(value: 0)
        var result: String?
        var fetchError: Error?

        let task = session.dataTask(with: url) { data, response, error in
            if let error = error {
                fetchError = error
            } else if let data = data, let manifestString = String(data: data, encoding: .utf8) {
                result = manifestString
            } else {
                fetchError = NSError(
                    domain: "MultiAudioResourceLoader",
                    code: 4,
                    userInfo: [NSLocalizedDescriptionKey: "Failed to decode manifest"]
                )
            }
            semaphore.signal()
        }

        task.resume()

        // Wait for request to complete (with timeout)
        let timeout = DispatchTime.now() + .seconds(30)
        if semaphore.wait(timeout: timeout) == .timedOut {
            task.cancel()
            throw NSError(
                domain: "MultiAudioResourceLoader",
                code: 5,
                userInfo: [NSLocalizedDescriptionKey: "Manifest fetch timeout"]
            )
        }

        if let error = fetchError {
            throw error
        }

        guard let manifest = result else {
            throw NSError(
                domain: "MultiAudioResourceLoader",
                code: 6,
                userInfo: [NSLocalizedDescriptionKey: "No manifest data received"]
            )
        }

        return manifest
    }

    func generateMultivariantManifest(from manifests: [String], fetchUrls: [String]) throws -> String {
        let generator = HLSManifestGenerator()

        let combinedManifestString = try generator.combine(
            manifests: manifests,
            audioTrackInfo: audioTrackInfo,
            fetchUrls: fetchUrls
        )

        return combinedManifestString
    }
}

// MARK: - React Native Bridge

/// React Native bridge module that exposes MultiAudioResourceLoaderDelegate to JavaScript
@objc(MultiAudioResourceLoader)
class MultiAudioResourceLoader: NSObject {

    private static var pluginRegistered = false

    // Store plugin instance to keep it alive
    private static var pluginInstance: MultiAudioVideoPlugin?

    @objc
    func registerVideoPlugin(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        // Only register once
        guard !MultiAudioResourceLoader.pluginRegistered else {
            NSLog("[MultiAudioResourceLoader] Plugin already registered")
            resolve(true)
            return
        }

        NSLog("[MultiAudioResourceLoader] Registering video plugin...")

        // Create plugin instance and keep it alive
        let plugin = MultiAudioVideoPlugin()
        MultiAudioResourceLoader.pluginInstance = plugin

        // Register plugin with react-native-video's manager
        DispatchQueue.main.async {
            ReactNativeVideoManager.shared.registerPlugin(plugin: plugin)
            NSLog("[MultiAudioResourceLoader] ✅ Plugin registered with ReactNativeVideoManager")
            MultiAudioResourceLoader.pluginRegistered = true
            resolve(true)
        }
    }

    @objc
    func configureResourceLoader(
        _ baseUrl: String,
        apiKey key: String,
        itemId id: String,
        audioTracks tracks: [[String: Any]],
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        DispatchQueue.global().async {
            MultiAudioResourceLoaderDelegate.shared.configure(
                baseUrl: baseUrl,
                apiKey: key,
                itemId: id,
                audioTracks: tracks
            )

            DispatchQueue.main.async {
                resolve(true)
            }
        }
    }

    @objc
    func generateCustomUrl(
        _ itemId: String,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        NSLog("[MultiAudioResourceLoader] generateCustomUrl called for item: \(itemId)")

        // Return custom protocol URL immediately
        // The react-native-video patch recognizes this as a network URL
        // The resource loader will fetch manifests lazily when AVPlayer requests them
        let customUrl = "jellyfin-multi://server/Videos/\(itemId)/master.m3u8"

        NSLog("[MultiAudioResourceLoader] ✅ Generated custom URL: \(customUrl)")

        DispatchQueue.main.async {
            resolve(customUrl)
        }
    }

    @objc
    static func requiresMainQueueSetup() -> Bool {
        return false
    }
}
