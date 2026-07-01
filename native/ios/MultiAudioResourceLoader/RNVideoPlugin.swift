//
//  RNVideoPlugin.swift
//  react-native-video plugin for multi-audio resource loader integration
//

import Foundation
import AVFoundation
import react_native_video

/// Plugin for react-native-video that intercepts AVAsset creation
/// and attaches the MultiAudioResourceLoaderDelegate for custom protocol handling
@objc(MultiAudioVideoPlugin)
class MultiAudioVideoPlugin: RNVAVPlayerPlugin {

    override public func overridePlayerAsset(source: VideoSource, asset: AVAsset) async -> OverridePlayerAssetResult? {
        NSLog("[MultiAudioVideoPlugin] overridePlayerAsset called")

        // Check if this is a multi-audio video with custom URL
        guard let urlAsset = asset as? AVURLAsset else {
            NSLog("[MultiAudioVideoPlugin] Asset is not AVURLAsset")
            return nil
        }

        let url = urlAsset.url.absoluteString
        NSLog("[MultiAudioVideoPlugin] Checking URL: \(url)")

        // Check for our custom protocol (jellyfin-multi://)
        guard url.starts(with: "jellyfin-multi://") else {
            NSLog("[MultiAudioVideoPlugin] Not our custom protocol, passing through")
            return nil
        }

        NSLog("[MultiAudioVideoPlugin] ✅ Detected multi-audio video: \(url)")

        // Create a new AVURLAsset with the same URL
        // (Can't modify existing asset, need to create new one)
        let customAsset = AVURLAsset(url: urlAsset.url)

        // Attach our resource loader delegate
        customAsset.resourceLoader.setDelegate(
            MultiAudioResourceLoaderDelegate.shared,
            queue: DispatchQueue.global(qos: .userInitiated)
        )

        NSLog("[MultiAudioVideoPlugin] Attached resource loader delegate")

        // Return the modified asset with type .partial
        // This allows react-native-video to continue its normal processing
        return OverridePlayerAssetResult(type: .partial, asset: customAsset)
    }
}
