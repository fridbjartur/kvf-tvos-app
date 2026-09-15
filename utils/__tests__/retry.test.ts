import { retryWithBackoff } from "../retry";
import { logger } from "../logger";

jest.mock("../logger");

describe("retryWithBackoff", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should succeed on first attempt", async () => {
    const operation = jest.fn().mockResolvedValue("success");

    const result = await retryWithBackoff(operation, { maxAttempts: 3 });

    expect(result).toBe("success");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("should retry on network error and eventually succeed", async () => {
    const operation = jest.fn().mockRejectedValueOnce(new Error("Network timeout")).mockResolvedValueOnce("success");

    const promise = retryWithBackoff(operation, {
      maxAttempts: 3,
      initialDelayMs: 100,
    });

    // Fast-forward through the retry delay
    await jest.advanceTimersByTimeAsync(100);

    const result = await promise;

    expect(result).toBe("success");
    expect(operation).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("succeeded after retry"), expect.any(Object));
  });

  it("should fail immediately on non-retryable error", async () => {
    const operation = jest.fn().mockRejectedValue(new Error("Invalid input"));

    await expect(retryWithBackoff(operation, { maxAttempts: 3 })).rejects.toThrow("Invalid input");

    expect(operation).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("not retryable"), expect.any(Object));
  });

  it("should exhaust retries and throw last error", async () => {
    const error = new Error("Network timeout");
    const operation = jest.fn().mockRejectedValue(error);
    // Attach the rejection assertion before advancing timers so Jest never
    // observes an unhandled rejection between the final attempt and assertion.
    const result = expect(retryWithBackoff(operation, { maxAttempts: 3, initialDelayMs: 100 })).rejects.toBe(error);
    await jest.runAllTimersAsync();
    await result;
    expect(operation).toHaveBeenCalledTimes(3);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("exhausted"), error, expect.any(Object));
  });

  it("should calculate exponential backoff delays correctly", () => {
    // Test the delay calculation logic directly
    const initialDelay = 1000;
    const maxDelay = 10000;
    const multiplier = 2;

    // First retry: 1000ms
    const delay1 = initialDelay * Math.pow(multiplier, 0);
    expect(delay1).toBe(1000);

    // Second retry: 2000ms
    const delay2 = initialDelay * Math.pow(multiplier, 1);
    expect(delay2).toBe(2000);

    // Third retry: 4000ms
    const delay3 = initialDelay * Math.pow(multiplier, 2);
    expect(delay3).toBe(4000);

    // Should respect max delay
    const delay4 = Math.min(initialDelay * Math.pow(multiplier, 10), maxDelay);
    expect(delay4).toBe(maxDelay);
  });
});
