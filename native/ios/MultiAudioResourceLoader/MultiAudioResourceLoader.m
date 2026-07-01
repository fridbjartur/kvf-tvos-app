//
//  MultiAudioResourceLoader.m
//  React Native bridge for MultiAudioResourceLoader Swift module
//

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(MultiAudioResourceLoader, NSObject)

// Register the plugin with react-native-video
RCT_EXTERN_METHOD(registerVideoPlugin:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// Configure the resource loader with Jellyfin server details and audio track metadata
RCT_EXTERN_METHOD(configureResourceLoader:(NSString *)baseUrl
                  apiKey:(NSString *)apiKey
                  itemId:(NSString *)itemId
                  audioTracks:(NSArray *)audioTracks
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// Generate a custom protocol URL for multi-audio playback
RCT_EXTERN_METHOD(generateCustomUrl:(NSString *)itemId
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

@end
