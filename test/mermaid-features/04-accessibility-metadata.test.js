const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const yaml = require("js-yaml");

const { ReadableYamlFormatter } = require("../../ReadableYamlFormatter.js");
const { MermaidSequenceTransformer } = require("../../MermaidSequenceTransformer.js");

//////////////////////////////////////////////////////////////////////////////
/**
 * Read a UTF-8 fixture file from the accessibility-metadata feature slice.
 *
 * @param {string} fileName Fixture file name.
 * @returns {string} Fixture file contents.
 * @example
 * const source = readFixture("input.mmd");
 */
function readFixture(fileName) {
	return fs.readFileSync(path.join(__dirname, "04-accessibility-metadata", fileName), "utf8");
}

//////////////////////////////////////////////////////////////////////////////
/**
 * Return the absolute path to an accessibility-metadata fixture file.
 *
 * @param {string} fileName Fixture file name.
 * @returns {string} Absolute fixture path.
 * @example
 * const inputPath = getFixturePath("input.mmd");
 */
function getFixturePath(fileName) {
	return path.join(__dirname, "04-accessibility-metadata", fileName);
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

describe("Mermaid feature slice 4: accessibility metadata", () => {
	test("transforms Mermaid accessibility metadata into sequencer title and description", () => {
		const source = readFixture("input.mmd");
		const expectedYaml = readFixture("expected.sequencer.yaml");

		const transformed = MermaidSequenceTransformer.transform(source, { sourceName: getFixturePath("input.mmd") });

		expect(ReadableYamlFormatter.format(transformed)).toBe(expectedYaml);
	});

	test("renders SVG root title and description metadata from Mermaid accessibility metadata", () => {
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

		expect(actualYaml).toBe(expectedYaml);
		expect(actualSvg).toBe(expectedSvg);
		expect(actualSvg).toContain("<title>Mermaid accessibility metadata</title>");
		expect(actualSvg).toContain("<desc>First description line from Mermaid accessibility metadata.");
		expect(actualSvg).toContain("Second description line remains multiline in sequencer.</desc>");
	});
});
