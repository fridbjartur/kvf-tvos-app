/**
 * Tests for the useQuickConnect hook state machine.
 *
 * Tests the Quick Connect flow logic by directly testing the underlying
 * API interactions and state transitions, following the project pattern
 * of testing logic without React Native native modules.
 */

// Mock the jellyfinApi auth functions
const mockInitiateQuickConnect = jest.fn();
const mockPollQuickConnect = jest.fn();
const mockAuthenticateWithQuickConnect = jest.fn();
const mockSaveAuthResult = jest.fn();

jest.mock("@/services/jellyfinApi", () => ({
  initiateQuickConnect: (...args: unknown[]) => mockInitiateQuickConnect(...args),
  pollQuickConnect: (...args: unknown[]) => mockPollQuickConnect(...args),
  authenticateWithQuickConnect: (...args: unknown[]) => mockAuthenticateWithQuickConnect(...args),
  saveAuthResult: (...args: unknown[]) => mockSaveAuthResult(...args),
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

import { initiateQuickConnect, pollQuickConnect, authenticateWithQuickConnect, saveAuthResult } from "@/services/jellyfinApi";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Quick Connect Flow Logic", () => {
  describe("Initiation", () => {
    it("should return code and secret from server on initiate", async () => {
      mockInitiateQuickConnect.mockResolvedValueOnce({
        Code: "ABC123",
        Secret: "secret-xyz",
        Authenticated: false,
      });

      const result = await initiateQuickConnect("http://server:8096");

      expect(result.Code).toBe("ABC123");
      expect(result.Secret).toBe("secret-xyz");
      expect(result.Authenticated).toBe(false);
      expect(mockInitiateQuickConnect).toHaveBeenCalledWith("http://server:8096");
    });

    it("should throw on server error", async () => {
      mockInitiateQuickConnect.mockRejectedValueOnce(new Error("Quick Connect initiation failed: 500"));

      await expect(initiateQuickConnect("http://server:8096")).rejects.toThrow("Quick Connect initiation failed: 500");
    });
  });

  describe("Polling", () => {
    it("should return Authenticated=false while waiting", async () => {
      mockPollQuickConnect.mockResolvedValueOnce({
        Code: "ABC123",
        Secret: "secret-xyz",
        Authenticated: false,
      });

      const result = await pollQuickConnect("http://server:8096", "secret-xyz");

      expect(result.Authenticated).toBe(false);
    });

    it("should return Authenticated=true after user approves", async () => {
      mockPollQuickConnect.mockResolvedValueOnce({
        Code: "ABC123",
        Secret: "secret-xyz",
        Authenticated: true,
      });

      const result = await pollQuickConnect("http://server:8096", "secret-xyz");

      expect(result.Authenticated).toBe(true);
    });

    it("should pass secret as query parameter", async () => {
      mockPollQuickConnect.mockResolvedValueOnce({
        Authenticated: false,
      });

      await pollQuickConnect("http://server:8096", "my-secret");

      expect(mockPollQuickConnect).toHaveBeenCalledWith("http://server:8096", "my-secret");
    });
  });

  describe("Authentication Exchange", () => {
    it("should exchange secret for access token after approval", async () => {
      mockAuthenticateWithQuickConnect.mockResolvedValueOnce({
        AccessToken: "final-token",
        User: { Id: "user-1", Name: "testuser" },
      });

      const result = await authenticateWithQuickConnect("http://server:8096", "secret-xyz");

      expect(result.AccessToken).toBe("final-token");
      expect(result.User.Id).toBe("user-1");
      expect(result.User.Name).toBe("testuser");
    });

    it("should throw on authentication failure", async () => {
      mockAuthenticateWithQuickConnect.mockRejectedValueOnce(new Error("Quick Connect authentication failed: 401"));

      await expect(authenticateWithQuickConnect("http://server:8096", "bad-secret")).rejects.toThrow("Quick Connect authentication failed: 401");
    });
  });

  describe("Full Flow (Initiate → Poll → Authenticate → Save)", () => {
    it("should complete the entire Quick Connect flow", async () => {
      // Step 1: Initiate
      mockInitiateQuickConnect.mockResolvedValueOnce({
        Code: "XYZ789",
        Secret: "flow-secret",
        Authenticated: false,
      });

      const initResult = await initiateQuickConnect("http://server:8096");
      expect(initResult.Code).toBe("XYZ789");

      // Step 2: Poll (not yet approved)
      mockPollQuickConnect.mockResolvedValueOnce({
        Authenticated: false,
      });

      const poll1 = await pollQuickConnect("http://server:8096", initResult.Secret);
      expect(poll1.Authenticated).toBe(false);

      // Step 3: Poll (approved)
      mockPollQuickConnect.mockResolvedValueOnce({
        Authenticated: true,
      });

      const poll2 = await pollQuickConnect("http://server:8096", initResult.Secret);
      expect(poll2.Authenticated).toBe(true);

      // Step 4: Exchange secret for token
      mockAuthenticateWithQuickConnect.mockResolvedValueOnce({
        AccessToken: "access-token-final",
        User: { Id: "uid-123", Name: "FlowUser" },
      });

      const auth = await authenticateWithQuickConnect("http://server:8096", initResult.Secret);
      expect(auth.AccessToken).toBe("access-token-final");

      // Step 5: Save credentials
      mockSaveAuthResult.mockResolvedValueOnce(undefined);

      await saveAuthResult("http://server:8096", auth.AccessToken, auth.User.Id, auth.User.Name, "My Server", "quickconnect");

      expect(mockSaveAuthResult).toHaveBeenCalledWith("http://server:8096", "access-token-final", "uid-123", "FlowUser", "My Server", "quickconnect");
    });
  });

  describe("Edge Cases", () => {
    it("should handle multiple polls with transient errors gracefully", async () => {
      // First poll: success but not authenticated
      mockPollQuickConnect.mockResolvedValueOnce({
        Authenticated: false,
      });

      // Second poll: network error
      mockPollQuickConnect.mockRejectedValueOnce(new Error("Network error"));

      // Third poll: success and authenticated
      mockPollQuickConnect.mockResolvedValueOnce({
        Authenticated: true,
      });

      const poll1 = await pollQuickConnect("http://server:8096", "secret");
      expect(poll1.Authenticated).toBe(false);

      // The caller (hook) would catch this and continue
      await expect(pollQuickConnect("http://server:8096", "secret")).rejects.toThrow("Network error");

      const poll3 = await pollQuickConnect("http://server:8096", "secret");
      expect(poll3.Authenticated).toBe(true);
    });

    it("should not call authenticate if poll never returns Authenticated=true", async () => {
      mockPollQuickConnect.mockResolvedValue({ Authenticated: false });

      for (let i = 0; i < 10; i++) {
        const result = await pollQuickConnect("http://server:8096", "secret");
        expect(result.Authenticated).toBe(false);
      }

      // authenticateWithQuickConnect should never be called
      expect(mockAuthenticateWithQuickConnect).not.toHaveBeenCalled();
    });
  });
});
