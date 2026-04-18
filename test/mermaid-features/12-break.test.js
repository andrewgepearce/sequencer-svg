const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const yaml = require("js-yaml");

const { MermaidSequenceTransformer } = require("../../MermaidSequenceTransformer.js");

//////////////////////////////////////////////////////////////////////////////
/**
 * Read a UTF-8 fixture file from the break feature slice.
 *
 * @param {string} fileName Fixture file name.
 * @returns {string} Fixture file contents.
 * @example
 * const source = readFixture("input.mmd");
 */
function readFixture(fileName) {
	return fs.readFileSync(path.join(__dirname, "12-break", fileName), "utf8");
}

//////////////////////////////////////////////////////////////////////////////
/**
 * Return the absolute path to a break fixture file.
 *
 * @param {string} fileName Fixture file name.
 * @returns {string} Absolute fixture path.
 * @example
 * const inputPath = getFixturePath("input.mmd");
 */
function getFixturePath(fileName) {
	return path.join(__dirname, "12-break", fileName);
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

describe("Mermaid feature slice 12: break fragments", () => {
	test("transforms Mermaid break syntax into a sequencer break fragment", () => {
		const source = readFixture("input.mmd");
		const expectedYaml = readFixture("expected.sequencer.yaml");

		const transformed = MermaidSequenceTransformer.transform(source, { sourceName: getFixturePath("input.mmd") });

		expect(yaml.safeDump(transformed)).toBe(expectedYaml);
		expect(transformed.lines[1].type).toBe("fragment");
		expect(transformed.lines[1].fragmentType).toBe("break");
		expect(transformed.lines[1].condition).toContain("break Validation failed");
		expect(transformed.lines[1].lines).toHaveLength(2);
	});

	test("renders SVG from Mermaid break input and writes the transformed sequencer YAML sidecar", () => {
		const tempDir = createTempDir();
		const inputFile = getFixturePath("input.mmd");
		const expectedYaml = readFixture("expected.sequencer.yaml");
		const expectedSvg = readFixture("expected.svg");

		execFileSync("node", ["sequencer.js", "--mermaid", "-i", inputFile, "-o", "-f", "-t", tempDir], {
			cwd: path.join(__dirname, "..", ".."),
			stdio: "pipe",
		});

		expect(fs.readFileSync(path.join(tempDir, "input.sequencer.yaml"), "utf8")).toBe(expectedYaml);
		expect(fs.readFileSync(path.join(tempDir, "input.svg"), "utf8")).toBe(expectedSvg);
	});
});
