import { logger } from "../logger";

describe("Logger", () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe("debug", () => {
    it("should log debug messages in development", () => {
      logger.debug("Test debug message", { key: "value" });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("DEBUG"));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Test debug message"));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("key"));
    });
  });

  describe("info", () => {
    it("should log info messages", () => {
      logger.info("Test info message", { service: "TestService" });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("INFO"));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Test info message"));
    });
  });

  describe("warn", () => {
    it("should log warning messages", () => {
      logger.warn("Test warning", { code: "WARN001" });

      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("WARN"));
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("Test warning"));
    });
  });

  describe("error", () => {
    it("should log error messages with error object", () => {
      const error = new Error("Test error");
      logger.error("Operation failed", error, { operation: "fetchData" });

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("ERROR"));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Operation failed"));
      expect(consoleErrorSpy).toHaveBeenCalledWith(error);
    });

    it("should log error messages without error object", () => {
      logger.error("Operation failed", undefined, { operation: "fetchData" });

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("ERROR"));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Operation failed"));
    });
  });

  describe("formatting", () => {
    it("should include timestamp in log messages", () => {
      logger.info("Test message");

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/));
    });

    it("should format context as JSON", () => {
      logger.info("Test message", { key1: "value1", key2: "value2" });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('"key1":"value1"'));
    });
  });
});
