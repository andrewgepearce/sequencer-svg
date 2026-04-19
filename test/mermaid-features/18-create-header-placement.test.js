const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const yaml = require("js-yaml");

const { MermaidSequenceTransformer } = require("../../MermaidSequenceTransformer.js");

//////////////////////////////////////////////////////////////////////////////
/**
 * Read a UTF-8 fixture file from the create-header-placement feature slice.
 *
 * @param {string} fileName Fixture file name.
 * @returns {string} Fixture file contents.
 * @example
 * const source = readFixture("input.mmd");
 */
function readFixture(fileName) {
	return fs.readFileSync(path.join(__dirname, "18-create-header-placement", fileName), "utf8");
}

//////////////////////////////////////////////////////////////////////////////
/**
 * Return the absolute path to a create-header-placement fixture file.
 *
 * @param {string} fileName Fixture file name.
 * @returns {string} Absolute fixture path.
 * @example
 * const inputPath = getFixturePath("input.mmd");
 */
function getFixturePath(fileName) {
	return path.join(__dirname, "18-create-header-placement", fileName);
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
 * Extract the y coordinate for the first SVG text element with exact content.
 *
 * @param {string} svg SVG markup.
 * @param {string} text Exact text content to match.
 * @returns {number|null} Parsed y coordinate, or null if absent.
 * @example
 * const y = getTextY(svg, "Caller");
 */
function getTextY(svg, text) {
	const escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = svg.match(new RegExp(`<text x="[^"]+" y="([0-9.]+)"[^>]*>${escapedText}</text>`));
	return match ? parseFloat(match[1]) : null;
}

describe("Mermaid feature slice 18: create header placement", () => {
	test("transforms a first-create Mermaid actor into a delayed sequencer create line", () => {
		const source = readFixture("input.mmd");
		const expectedYaml = readFixture("expected.sequencer.yaml");

		const transformed = MermaidSequenceTransformer.transform(source, { sourceName: getFixturePath("input.mmd") });

		expect(yaml.safeDump(transformed)).toBe(expectedYaml);
		expect(transformed.lines[0].type).toBe("create");
		expect(transformed.lines[1].type).toBe("return");
	});

	test("renders the created actor header below top-of-diagram actors when the first lifecycle event is create", () => {
		const tempDir = createTempDir();
		const inputFile = getFixturePath("input.mmd");
		const expectedYaml = readFixture("expected.sequencer.yaml");
		const expectedSvg = readFixture("expected.svg");

		execFileSync("node", ["sequencer.js", "--mermaid", "-i", inputFile, "-o", "-f", "-t", tempDir], {
			cwd: path.join(__dirname, "..", ".."),
			stdio: "pipe",
		});

		const actualYaml = fs.readFileSync(path.join(tempDir, "input.sequencer.yaml"), "utf8");
		const actualSvg = fs.readFileSync(path.join(tempDir, "input.svg"), "utf8");
		const callerY = getTextY(actualSvg, "Caller");
		const workerY = getTextY(actualSvg, "Worker");

		expect(actualYaml).toBe(expectedYaml);
		expect(actualSvg).toBe(expectedSvg);
		expect(callerY).not.toBeNull();
		expect(workerY).not.toBeNull();
		expect(workerY).toBeGreaterThan(callerY);
	});
});
