/**
 * useVideoPlayback - Error Classification Tests
 *
 * This suite exercises the pure helper functions exported from useVideoPlayback.ts
 * that are responsible for classifying playback errors and generating user-facing
 * error messages (e.g., classifyPlaybackError and getPlaybackErrorMessage).
 *
 * These tests are intentionally isolated from the main useVideoPlayback hook tests
 * so that the error-classification logic can be validated independently of any
 * React, DOM, or player integration concerns. Keeping this logic in a separate
 * suite ensures the tests remain fast, deterministic, and focused purely on the
 * string-matching and mapping behavior used to derive PlaybackErrorType values
 * and human-readable error messages.
 */

import { PlaybackErrorType, classifyPlaybackError, getPlaybackErrorMessage } from "../useVideoPlayback";

describe("classifyPlaybackError", () => {
  describe("NOT_FOUND errors", () => {
    it("should classify 'not found' errors", () => {
      expect(classifyPlaybackError(new Error("Video not found"))).toBe(PlaybackErrorType.NOT_FOUND);
      expect(classifyPlaybackError(new Error("Item not found on server"))).toBe(PlaybackErrorType.NOT_FOUND);
      expect(classifyPlaybackError(new Error("File not found"))).toBe(PlaybackErrorType.NOT_FOUND);
    });

    it("should classify HTTP 404 errors", () => {
      expect(classifyPlaybackError(new Error("HTTP 404"))).toBe(PlaybackErrorType.NOT_FOUND);
      expect(classifyPlaybackError(new Error("Server returned 404"))).toBe(PlaybackErrorType.NOT_FOUND);
    });

    it("should classify 'item does not exist' errors", () => {
      expect(classifyPlaybackError(new Error("Item does not exist"))).toBe(PlaybackErrorType.NOT_FOUND);
      expect(classifyPlaybackError(new Error("The item you requested does not exist"))).toBe(PlaybackErrorType.NOT_FOUND);
    });
  });

  describe("UNAUTHORIZED errors", () => {
    it("should classify 'unauthorized' errors", () => {
      expect(classifyPlaybackError(new Error("Unauthorized access"))).toBe(PlaybackErrorType.UNAUTHORIZED);
      expect(classifyPlaybackError(new Error("Not authorized to view this content"))).toBe(PlaybackErrorType.UNAUTHORIZED);
    });

    it("should classify HTTP 401 errors", () => {
      expect(classifyPlaybackError(new Error("HTTP 401"))).toBe(PlaybackErrorType.UNAUTHORIZED);
      expect(classifyPlaybackError(new Error("Server returned 401 Unauthorized"))).toBe(PlaybackErrorType.UNAUTHORIZED);
    });

    it("should classify authentication failure errors", () => {
      expect(classifyPlaybackError(new Error("Authentication failed"))).toBe(PlaybackErrorType.UNAUTHORIZED);
      expect(classifyPlaybackError(new Error("Authentication fail occurred"))).toBe(PlaybackErrorType.UNAUTHORIZED);
    });

    it("should classify invalid credentials errors", () => {
      expect(classifyPlaybackError(new Error("Invalid credentials provided"))).toBe(PlaybackErrorType.UNAUTHORIZED);
      expect(classifyPlaybackError(new Error("Invalid credentials detected"))).toBe(PlaybackErrorType.UNAUTHORIZED);
    });

    it("should classify NSURLErrorResourceUnavailable (iOS -1013)", () => {
      expect(classifyPlaybackError(new Error("Error -1013: Resource unavailable"))).toBe(PlaybackErrorType.UNAUTHORIZED);
      expect(classifyPlaybackError(new Error("error -1013"))).toBe(PlaybackErrorType.UNAUTHORIZED);
    });
  });

  describe("TIMEOUT errors", () => {
    it("should classify 'timed out' errors", () => {
      expect(classifyPlaybackError(new Error("Request timed out"))).toBe(PlaybackErrorType.TIMEOUT);
      expect(classifyPlaybackError(new Error("Connection timedout"))).toBe(PlaybackErrorType.TIMEOUT);
      expect(classifyPlaybackError(new Error("Operation timed out"))).toBe(PlaybackErrorType.TIMEOUT);
    });

    it("should classify timeout with various spellings", () => {
      expect(classifyPlaybackError(new Error("timeout occurred"))).toBe(PlaybackErrorType.TIMEOUT);
      expect(classifyPlaybackError(new Error("Request timeout"))).toBe(PlaybackErrorType.TIMEOUT);
    });

    it("should classify ETIMEDOUT errors", () => {
      expect(classifyPlaybackError(new Error("ETIMEDOUT"))).toBe(PlaybackErrorType.TIMEOUT);
      expect(classifyPlaybackError(new Error("Error: ETIMEDOUT - connection timeout"))).toBe(PlaybackErrorType.TIMEOUT);
    });
  });

  describe("CORRUPT errors", () => {
    it("should classify HostFunction errors", () => {
      expect(classifyPlaybackError(new Error("HostFunction: Something went wrong"))).toBe(PlaybackErrorType.CORRUPT);
      expect(classifyPlaybackError(new Error("HostFunction error in playback"))).toBe(PlaybackErrorType.CORRUPT);
    });

    it("should classify corrupted file errors", () => {
      expect(classifyPlaybackError(new Error("File corrupted"))).toBe(PlaybackErrorType.CORRUPT);
      expect(classifyPlaybackError(new Error("Video file is corrupted"))).toBe(PlaybackErrorType.CORRUPT);
    });

    it("should classify invalid format/data errors", () => {
      expect(classifyPlaybackError(new Error("Invalid format detected"))).toBe(PlaybackErrorType.CORRUPT);
      expect(classifyPlaybackError(new Error("Invalid data in stream"))).toBe(PlaybackErrorType.CORRUPT);
    });
  });

  describe("DECODE errors", () => {
    it("should classify decode errors", () => {
      expect(classifyPlaybackError(new Error("Decode failed"))).toBe(PlaybackErrorType.DECODE);
      expect(classifyPlaybackError(new Error("Video decode error"))).toBe(PlaybackErrorType.DECODE);
    });

    it("should classify codec not supported errors", () => {
      expect(classifyPlaybackError(new Error("Codec not supported"))).toBe(PlaybackErrorType.DECODE);
      expect(classifyPlaybackError(new Error("Video codec is not supported"))).toBe(PlaybackErrorType.DECODE);
    });

    it("should classify unable to play errors", () => {
      expect(classifyPlaybackError(new Error("Unable to play video"))).toBe(PlaybackErrorType.DECODE);
      expect(classifyPlaybackError(new Error("Unable to play this file"))).toBe(PlaybackErrorType.DECODE);
    });
  });

  describe("NETWORK errors", () => {
    it("should classify network error/fail/issue patterns", () => {
      expect(classifyPlaybackError(new Error("Network error occurred"))).toBe(PlaybackErrorType.NETWORK);
      expect(classifyPlaybackError(new Error("Network failure detected"))).toBe(PlaybackErrorType.NETWORK);
      expect(classifyPlaybackError(new Error("Network issue preventing playback"))).toBe(PlaybackErrorType.NETWORK);
    });

    it("should classify fetch errors", () => {
      expect(classifyPlaybackError(new Error("Fetch error: could not retrieve"))).toBe(PlaybackErrorType.NETWORK);
      expect(classifyPlaybackError(new Error("Fetch failed for resource"))).toBe(PlaybackErrorType.NETWORK);
    });

    it("should classify connection errors", () => {
      expect(classifyPlaybackError(new Error("Connection refused by server"))).toBe(PlaybackErrorType.NETWORK);
      expect(classifyPlaybackError(new Error("Connection reset by peer"))).toBe(PlaybackErrorType.NETWORK);
      expect(classifyPlaybackError(new Error("Connection closed unexpectedly"))).toBe(PlaybackErrorType.NETWORK);
    });

    it("should classify ECONNRESET/ECONNREFUSED errors", () => {
      expect(classifyPlaybackError(new Error("ECONNRESET"))).toBe(PlaybackErrorType.NETWORK);
      expect(classifyPlaybackError(new Error("ECONNREFUSED - connection refused"))).toBe(PlaybackErrorType.NETWORK);
    });

    it("should classify unable to connect errors", () => {
      expect(classifyPlaybackError(new Error("Unable to connect to server"))).toBe(PlaybackErrorType.NETWORK);
    });
  });

  describe("UNKNOWN errors", () => {
    it("should classify unrecognized errors", () => {
      expect(classifyPlaybackError(new Error("Something went wrong"))).toBe(PlaybackErrorType.UNKNOWN);
      expect(classifyPlaybackError(new Error("Unexpected error"))).toBe(PlaybackErrorType.UNKNOWN);
      expect(classifyPlaybackError(new Error("Random error message"))).toBe(PlaybackErrorType.UNKNOWN);
    });

    it("should handle null and undefined", () => {
      expect(classifyPlaybackError(null)).toBe(PlaybackErrorType.UNKNOWN);
      expect(classifyPlaybackError(undefined)).toBe(PlaybackErrorType.UNKNOWN);
    });

    it("should handle non-Error objects", () => {
      expect(classifyPlaybackError("String error")).toBe(PlaybackErrorType.UNKNOWN);
      expect(classifyPlaybackError(123)).toBe(PlaybackErrorType.UNKNOWN);
      expect(classifyPlaybackError({})).toBe(PlaybackErrorType.UNKNOWN);
    });
  });

  describe("Edge cases", () => {
    it("should handle errors from plain objects with message property", () => {
      expect(classifyPlaybackError({ message: "Network error" })).toBe(PlaybackErrorType.NETWORK);
      expect(classifyPlaybackError({ message: "Unauthorized" })).toBe(PlaybackErrorType.UNAUTHORIZED);
      expect(classifyPlaybackError({ message: "Not found" })).toBe(PlaybackErrorType.NOT_FOUND);
    });

    it("should handle case-insensitive matching", () => {
      expect(classifyPlaybackError(new Error("NETWORK ERROR"))).toBe(PlaybackErrorType.NETWORK);
      expect(classifyPlaybackError(new Error("unauthorized ACCESS"))).toBe(PlaybackErrorType.UNAUTHORIZED);
      expect(classifyPlaybackError(new Error("NOT FOUND"))).toBe(PlaybackErrorType.NOT_FOUND);
    });

    it("should prioritize more specific patterns (order matters)", () => {
      // UNAUTHORIZED patterns should match before NETWORK
      expect(classifyPlaybackError(new Error("Unauthorized - network issue"))).toBe(PlaybackErrorType.UNAUTHORIZED);

      // NOT_FOUND should match before generic patterns
      expect(classifyPlaybackError(new Error("404 not found"))).toBe(PlaybackErrorType.NOT_FOUND);
    });
  });
});

describe("getPlaybackErrorMessage", () => {
  it("should return user-friendly message for NOT_FOUND", () => {
    const message = getPlaybackErrorMessage(PlaybackErrorType.NOT_FOUND);
    expect(message).toBe("Video not found on server");
  });

  it("should return user-friendly message for UNAUTHORIZED", () => {
    const message = getPlaybackErrorMessage(PlaybackErrorType.UNAUTHORIZED);
    expect(message).toBe("Authentication failed. Your session may have expired.");
  });

  it("should return user-friendly message for NETWORK", () => {
    const message = getPlaybackErrorMessage(PlaybackErrorType.NETWORK);
    expect(message).toBe("Unable to connect to Jellyfin server");
  });

  it("should return user-friendly message for TIMEOUT", () => {
    const message = getPlaybackErrorMessage(PlaybackErrorType.TIMEOUT);
    expect(message).toBe("Connection timed out. Please check your network");
  });

  it("should return user-friendly message for CORRUPT", () => {
    const message = getPlaybackErrorMessage(PlaybackErrorType.CORRUPT);
    expect(message).toBe("This video file appears to be corrupted or in an unsupported format");
  });

  it("should return user-friendly message for DECODE", () => {
    const message = getPlaybackErrorMessage(PlaybackErrorType.DECODE);
    expect(message).toBe("Unable to decode video. Try a different quality setting");
  });

  it("should return user-friendly message for UNKNOWN without original error", () => {
    const message = getPlaybackErrorMessage(PlaybackErrorType.UNKNOWN);
    expect(message).toBe("Failed to load video");
  });

  it("should include original error for UNKNOWN type", () => {
    const message = getPlaybackErrorMessage(PlaybackErrorType.UNKNOWN, "Something went wrong");
    expect(message).toBe("Playback error: Something went wrong");
  });

  it("should NOT append original error for classified error types", () => {
    // For all classified types, original error is not appended to message
    expect(getPlaybackErrorMessage(PlaybackErrorType.NETWORK, "ECONNREFUSED")).toBe("Unable to connect to Jellyfin server");
    expect(getPlaybackErrorMessage(PlaybackErrorType.UNAUTHORIZED, "401 Unauthorized")).toBe("Authentication failed. Your session may have expired.");
    expect(getPlaybackErrorMessage(PlaybackErrorType.NOT_FOUND, "404 Not Found")).toBe("Video not found on server");
    expect(getPlaybackErrorMessage(PlaybackErrorType.TIMEOUT, "ETIMEDOUT")).toBe("Connection timed out. Please check your network");
    expect(getPlaybackErrorMessage(PlaybackErrorType.CORRUPT, "File corrupted")).toBe("This video file appears to be corrupted or in an unsupported format");
    expect(getPlaybackErrorMessage(PlaybackErrorType.DECODE, "Codec error")).toBe("Unable to decode video. Try a different quality setting");
  });
});
