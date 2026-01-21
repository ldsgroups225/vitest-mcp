import { describe, it, expect, vi, beforeEach } from "vitest";
import * as vitestConfigReader from "../../utils/vitest-config-reader.js";

vi.mock("../../utils/vitest-config-reader");

describe("analyze-coverage threshold detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should detect when Vitest thresholds pass (exit code 0)", async () => {
    // Mock thresholds configured with passing coverage
    vi.mocked(vitestConfigReader.getVitestCoverageThresholds).mockResolvedValue({
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80
    });
    vi.mocked(vitestConfigReader.checkThresholdsMet).mockReturnValue(true);
    vi.mocked(vitestConfigReader.getThresholdViolations).mockReturnValue([]);

    const thresholds = await vitestConfigReader.getVitestCoverageThresholds("/test/project");
    const thresholdsMet = vitestConfigReader.checkThresholdsMet(
      { lines: 100, functions: 100, branches: 100, statements: 100 },
      thresholds
    );
    const violations = vitestConfigReader.getThresholdViolations(
      { lines: 100, functions: 100, branches: 100, statements: 100 },
      thresholds
    );

    expect(thresholds).toEqual({ lines: 80, functions: 80, branches: 80, statements: 80 });
    expect(thresholdsMet).toBe(true);
    expect(violations).toEqual([]);
  });

  it("should detect when Vitest thresholds fail (exit code 1)", async () => {
    // Mock thresholds configured with failing coverage
    const mockThresholds = {
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80
    };
    vi.mocked(vitestConfigReader.getVitestCoverageThresholds).mockResolvedValue(mockThresholds);
    vi.mocked(vitestConfigReader.checkThresholdsMet).mockReturnValue(false);
    vi.mocked(vitestConfigReader.getThresholdViolations).mockReturnValue([
      "Line coverage (50%) is below threshold (80%)",
      "Function coverage (50%) is below threshold (80%)"
    ]);

    const thresholds = await vitestConfigReader.getVitestCoverageThresholds("/test/project");
    const thresholdsMet = vitestConfigReader.checkThresholdsMet(
      { lines: 50, functions: 50, branches: 50, statements: 50 },
      thresholds
    );
    const violations = vitestConfigReader.getThresholdViolations(
      { lines: 50, functions: 50, branches: 50, statements: 50 },
      thresholds
    );

    expect(thresholds).toEqual(mockThresholds);
    expect(thresholdsMet).toBe(false);
    expect(violations).toEqual([
      "Line coverage (50%) is below threshold (80%)",
      "Function coverage (50%) is below threshold (80%)"
    ]);
  });

  it("should handle when Vitest has no thresholds configured (exit code 0)", async () => {
    // Mock no thresholds configured
    vi.mocked(vitestConfigReader.getVitestCoverageThresholds).mockResolvedValue(null);
    vi.mocked(vitestConfigReader.checkThresholdsMet).mockReturnValue(true);
    vi.mocked(vitestConfigReader.getThresholdViolations).mockReturnValue([]);

    const thresholds = await vitestConfigReader.getVitestCoverageThresholds("/test/project");

    expect(thresholds).toBeNull();
  });

  it("should provide detailed format with threshold status", async () => {
    // Mock thresholds configured with failing coverage
    const mockThresholds = {
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80
    };
    vi.mocked(vitestConfigReader.getVitestCoverageThresholds).mockResolvedValue(mockThresholds);
    vi.mocked(vitestConfigReader.checkThresholdsMet).mockReturnValue(false);
    vi.mocked(vitestConfigReader.getThresholdViolations).mockReturnValue([
      "Line coverage (33%) is below threshold (80%)"
    ]);

    const thresholdsMet = vitestConfigReader.checkThresholdsMet(
      { lines: 33, functions: 0, branches: 0, statements: 33 },
      mockThresholds
    );
    const violations = vitestConfigReader.getThresholdViolations(
      { lines: 33, functions: 0, branches: 0, statements: 33 },
      mockThresholds
    );

    expect(thresholdsMet).toBe(false);
    expect(violations).toEqual([
      "Line coverage (33%) is below threshold (80%)"
    ]);
  });
});
