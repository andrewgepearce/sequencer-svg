const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const yaml = require("js-yaml");

const { ReadableYamlFormatter } = require("../../ReadableYamlFormatter.js");
const { MermaidSequenceTransformer } = require("../../MermaidSequenceTransformer.js");

//////////////////////////////////////////////////////////////////////////////
/**
 * Read a UTF-8 fixture file from the create-destroy feature slice.
 *
 * @param {string} fileName Fixture file name.
 * @returns {string} Fixture file contents.
 * @example
 * const source = readFixture("input.mmd");
 */
function readFixture(fileName) {
	return fs.readFileSync(path.join(__dirname, "17-create-destroy", fileName), "utf8");
}

//////////////////////////////////////////////////////////////////////////////
/**
 * Return the absolute path to a create-destroy fixture file.
 *
 * @param {string} fileName Fixture file name.
 * @returns {string} Absolute fixture path.
 * @example
 * const inputPath = getFixturePath("input.mmd");
 */
function getFixturePath(fileName) {
	return path.join(__dirname, "17-create-destroy", fileName);
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
 * Count exact text-element matches inside an SVG string.
 *
 * @param {string} svg SVG markup.
 * @param {string} text Exact text content to count.
 * @returns {number} Number of matching text elements.
 * @example
 * const count = countText(svg, "Worker");
 */
function countText(svg, text) {
	const escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const matches = svg.match(new RegExp(`>${escapedText}</text>`, "g"));
	return Array.isArray(matches) ? matches.length : 0;
}

describe("Mermaid feature slice 17: create and destroy", () => {
	test("transforms Mermaid create and destroy directives into sequencer lifecycle lines", () => {
		const source = readFixture("input.mmd");
		const expectedYaml = readFixture("expected.sequencer.yaml");

		const transformed = MermaidSequenceTransformer.transform(source, { sourceName: getFixturePath("input.mmd") });

		expect(ReadableYamlFormatter.format(transformed)).toBe(expectedYaml);
		expect(transformed.lines[0].destroyTo).toBe(true);
		expect(transformed.lines[1].type).toBe("create");
		expect(transformed.lines[3].destroyTo).toBe(true);
		expect(transformed.lines[4].type).toBe("create");
		expect(transformed.lines[5].destroyTo).toBe(true);
	});

	test("renders SVG from Mermaid create-destroy input and writes the transformed sequencer YAML sidecar", () => {
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
		expect(countText(actualSvg, "Worker")).toBe(3);
	});
});
