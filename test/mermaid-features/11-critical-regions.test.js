const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const yaml = require("js-yaml");

const { ReadableYamlFormatter } = require("../../ReadableYamlFormatter.js");
const { MermaidSequenceTransformer } = require("../../MermaidSequenceTransformer.js");

//////////////////////////////////////////////////////////////////////////////
/**
 * Read a UTF-8 fixture file from the critical-regions feature slice.
 *
 * @param {string} fileName Fixture file name.
 * @returns {string} Fixture file contents.
 * @example
 * const source = readFixture("input.mmd");
 */
function readFixture(fileName) {
	return fs.readFileSync(path.join(__dirname, "11-critical-regions", fileName), "utf8");
}

//////////////////////////////////////////////////////////////////////////////
/**
 * Return the absolute path to a critical-regions fixture file.
 *
 * @param {string} fileName Fixture file name.
 * @returns {string} Absolute fixture path.
 * @example
 * const inputPath = getFixturePath("input.mmd");
 */
function getFixturePath(fileName) {
	return path.join(__dirname, "11-critical-regions", fileName);
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

describe("Mermaid feature slice 11: critical regions", () => {
	test("transforms Mermaid critical and option syntax into sequencer critical fragments", () => {
		const source = readFixture("input.mmd");
		const expectedYaml = readFixture("expected.sequencer.yaml");

		const transformed = MermaidSequenceTransformer.transform(source, { sourceName: getFixturePath("input.mmd") });

		expect(ReadableYamlFormatter.format(transformed)).toBe(expectedYaml);
		expect(transformed.lines[0].type).toBe("fragment");
		expect(transformed.lines[0].fragmentType).toBe("critical");
		expect(transformed.lines[0].condition).toContain("critical Required update");
		expect(transformed.lines[0].lines[2].type).toBe("condition");
		expect(transformed.lines[0].lines[2].condition).toContain("option Cache unavailable");
		expect(transformed.lines[0].lines[4].type).toBe("condition");
		expect(transformed.lines[0].lines[4].condition).toContain("option Cache warmed");
	});

	test("renders SVG from Mermaid critical-region input and writes the transformed sequencer YAML sidecar", () => {
		const tempDir = createTempDir();
		const inputFile = getFixturePath("input.mmd");
		const expectedYaml = readFixture("expected.sequencer.yaml");
		const expectedSvg = readFixture("expected.svg");

		execFileSync("node", ["sequencer.js", "--mermaid", "-i", inputFile, "-o", "-f", "-t", tempDir], {
			cwd: path.join(__dirname, "..", ".."),
			stdio: "pipe",
		});

		expect(fs.readFileSync(path.join(tempDir, "input.sequencer.yaml"), "utf8")).toBe(expectedYaml);
		const actualSvg = fs.readFileSync(path.join(tempDir, "input.svg"), "utf8");

		expect(actualSvg).toBe(expectedSvg);
		expect(actualSvg).toContain('d="M 30 243 L 30 268 L 85 268 L 95 258 L 95 243 L 30 243" fill="none" stroke="rgb(0, 0, 0)" stroke-width="2"');
	});
});
