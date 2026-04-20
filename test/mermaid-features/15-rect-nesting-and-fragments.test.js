const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const yaml = require("js-yaml");

const { ReadableYamlFormatter } = require("../../ReadableYamlFormatter.js");
const { MermaidSequenceTransformer } = require("../../MermaidSequenceTransformer.js");

//////////////////////////////////////////////////////////////////////////////
/**
 * Read a UTF-8 fixture file from the rect-nesting feature slice.
 *
 * @param {string} fileName Fixture file name.
 * @returns {string} Fixture file contents.
 * @example
 * const source = readFixture("input.mmd");
 */
function readFixture(fileName) {
	return fs.readFileSync(path.join(__dirname, "15-rect-nesting-and-fragments", fileName), "utf8");
}

//////////////////////////////////////////////////////////////////////////////
/**
 * Return the absolute path to a rect-nesting fixture file.
 *
 * @param {string} fileName Fixture file name.
 * @returns {string} Absolute fixture path.
 * @example
 * const inputPath = getFixturePath("input.mmd");
 */
function getFixturePath(fileName) {
	return path.join(__dirname, "15-rect-nesting-and-fragments", fileName);
}

//////////////////////////////////////////////////////////////////////////////
/**
 * Create a temporary directory for a CLI integration run.
 *
 * @returns {string} Temporary directory path.
 * @example
 * const tempDir = createTempDir();
 */
function createTempDir() {
	return fs.mkdtempSync(path.join(os.tmpdir(), "sequencer-svg-mermaid-"));
}

//////////////////////////////////////////////////////////////////////////////
/**
 * Return the first SVG source index of a fill colour string.
 *
 * @param {string} svg SVG markup.
 * @param {string} fillColour Exact fill colour string.
 * @returns {number} First string index, or -1 when absent.
 * @example
 * const index = indexOfFillColour(svg, "rgba(180, 220, 255, 0.6)");
 */
function indexOfFillColour(svg, fillColour) {
	return svg.indexOf(`fill="${fillColour}"`);
}

//////////////////////////////////////////////////////////////////////////////
/**
 * Extract the left and right x coordinates from the first SVG path using a fill colour.
 *
 * @param {string} svg SVG markup.
 * @param {string} fillColour Exact fill colour string.
 * @returns {{ startX: number, endX: number } | null} Parsed x-axis bounds.
 * @example
 * const span = getFirstFilledPathSpan(svg, "rgba(255, 230, 200, 0.5)");
 */
function getFirstFilledPathSpan(svg, fillColour) {
	const escapedColour = fillColour.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = svg.match(new RegExp(`<path d="M ([0-9.]+) [0-9.]+ L [0-9.]+ [0-9.]+ L ([0-9.]+) [0-9.]+ L [0-9.]+ [0-9.]+ L [0-9.]+ [0-9.]+" fill="${escapedColour}"`));

	if (!match) {
		return null;
	}

	return {
		startX: parseFloat(match[1]),
		endX: parseFloat(match[2]),
	};
}

describe("Mermaid feature slice 15: rect nesting and fragments", () => {
	test("transforms nested Mermaid rect blocks and structural fragments into sequencer output", () => {
		const source = readFixture("input.mmd");
		const expectedYaml = readFixture("expected.sequencer.yaml");

		const transformed = MermaidSequenceTransformer.transform(source, { sourceName: getFixturePath("input.mmd") });

		expect(ReadableYamlFormatter.format(transformed)).toBe(expectedYaml);
		expect(transformed.lines[0].fragmentType).toBe("rect");
		expect(transformed.lines[0].startActor).toBe("Service");
		expect(transformed.lines[0].endActor).toBe("Audit");
		expect(transformed.lines[0].lines[1].fragmentType).toBe("rect");
		expect(transformed.lines[0].lines[1].startActor).toBe("Service");
		expect(transformed.lines[0].lines[1].endActor).toBe("Cache");
		expect(transformed.lines[0].lines[2].fragmentType).toBe("opt");
		expect(transformed.lines[1].fragmentType).toBe("opt");
		expect(transformed.lines[1].lines[0].fragmentType).toBe("rect");
		expect(transformed.lines[2].fragmentType).toBe("rect");
		expect(transformed.lines[2].startActor).toBe("Service");
		expect(transformed.lines[2].lines[1].fragmentType).toBe("rect");
		expect(transformed.lines[2].lines[1].startActor).toBe("DB");
	});

	test("renders contained nested rect highlights without treating them as structural depth", () => {
		const tempDir = createTempDir();
		const inputFile = getFixturePath("input.mmd");
		const expectedYaml = readFixture("expected.sequencer.yaml");
		const expectedSvg = readFixture("expected.svg");

		execFileSync("node", ["sequencer.js", "--mermaid", "-i", inputFile, "-o", "-f", "-t", tempDir], {
			cwd: path.join(__dirname, "..", ".."),
			stdio: "pipe",
		});

		const actualSvg = fs.readFileSync(path.join(tempDir, "input.svg"), "utf8");
		const outerSameStartSpan = getFirstFilledPathSpan(actualSvg, "rgba(255, 230, 200, 0.5)");
		const innerSameStartSpan = getFirstFilledPathSpan(actualSvg, "rgba(255, 190, 190, 0.5)");

		expect(fs.readFileSync(path.join(tempDir, "input.sequencer.yaml"), "utf8")).toBe(expectedYaml);
		expect(actualSvg).toBe(expectedSvg);
		expect(outerSameStartSpan).not.toBeNull();
		expect(innerSameStartSpan).not.toBeNull();
		expect(innerSameStartSpan.startX).toBeGreaterThan(outerSameStartSpan.startX);
		expect(innerSameStartSpan.endX).toBeLessThan(outerSameStartSpan.endX);
	});

	test("renders a structural fragment bgColour path even when a parent rect highlight overpaints it", () => {
		const tempDir = createTempDir();
		const inputFile = getFixturePath("opt-bg-z-order.sequencer.yaml");
		const outputFile = path.join(tempDir, "opt-bg-z-order.svg");

		execFileSync("node", ["sequencer.js", "-y", "-i", inputFile, "-o", outputFile, "-f"], {
			cwd: path.join(__dirname, "..", ".."),
			stdio: "pipe",
		});

		const actualSvg = fs.readFileSync(outputFile, "utf8");
		const optBgIndex = indexOfFillColour(actualSvg, "rgba(180, 220, 255, 0.6)");
		const parentRectIndex = indexOfFillColour(actualSvg, "rgba(255, 230, 200, 0.5)");

		expect(optBgIndex).toBeGreaterThanOrEqual(0);
		expect(parentRectIndex).toBeGreaterThanOrEqual(0);
		expect(actualSvg).toContain("Optional audit branch");
		expect(actualSvg).toContain("Audit within rect");
	});
});
