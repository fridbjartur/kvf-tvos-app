import ExpoModulesCore
import UIKit
#if os(tvOS)
import AVKit
#endif

/// Adds a "next episode" button to the transport bar of the visible AVPlayerViewController.
///
/// React views layered over the native player cannot take focus from it, so the
/// button has to live inside the player. In the transport bar it sits in the row
/// above the scrubber, next to the audio and subtitle buttons: it appears with the
/// native controls, and up/down move between it and the scrubber as usual.
public class KvfUpNextModule: Module {
  #if os(tvOS)
  private static let actionIdentifier = UIAction.Identifier("dev.fridbjartur.kvf.upNext")
  private weak var controller: AVPlayerViewController?
  /// Ignores selections that belong to an earlier `show`.
  private var generation = 0
  #endif

  public func definition() -> ModuleDefinition {
    Name("KvfUpNext")

    Events("onSelect")

    AsyncFunction("show") { (title: String) -> Bool in
      self.show(title)
    }.runOnQueue(.main)

    AsyncFunction("hide") {
      self.hide()
    }.runOnQueue(.main)

    OnDestroy {
      #if os(tvOS)
      let controller = self.controller
      DispatchQueue.main.async {
        if let controller { Self.removeAction(from: controller) }
      }
      #endif
    }
  }

  #if os(tvOS)
  private func show(_ title: String) -> Bool {
    guard let player = Self.findPlayerController() else { return false }
    if let previous = controller, previous !== player {
      Self.removeAction(from: previous)
    }
    generation += 1
    let current = generation
    controller = player

    let action = UIAction(title: title, image: UIImage(systemName: "forward.end.fill"), identifier: Self.actionIdentifier) { [weak self] _ in
      guard let self, self.generation == current else { return }
      self.sendEvent("onSelect", [:])
    }
    // Keep any items react-native-video or the system added.
    player.transportBarCustomMenuItems = Self.otherItems(in: player) + [action]
    return true
  }

  private func hide() {
    generation += 1
    if let controller { Self.removeAction(from: controller) }
    controller = nil
  }

  private static func otherItems(in player: AVPlayerViewController) -> [UIMenuElement] {
    player.transportBarCustomMenuItems.filter { ($0 as? UIAction)?.identifier != actionIdentifier }
  }

  private static func removeAction(from player: AVPlayerViewController) {
    player.transportBarCustomMenuItems = otherItems(in: player)
  }

  /// react-native-video hosts its native controls in an AVPlayerViewController.
  /// Find the front-most one that is on screen.
  private static func findPlayerController() -> AVPlayerViewController? {
    let windows = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .filter { !$0.isHidden }
    for window in windows.reversed() {
      if let found = find(in: window) { return found }
    }
    return nil
  }

  private static func find(in view: UIView) -> AVPlayerViewController? {
    if view.isHidden { return nil }
    if let player = view.next as? AVPlayerViewController { return player }
    for subview in view.subviews.reversed() {
      if let found = find(in: subview) { return found }
    }
    return nil
  }
  #else
  private func show(_ title: String) -> Bool { false }
  private func hide() {}
  #endif
}
