const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const yaml = require("js-yaml");

const { ReadableYamlFormatter } = require("../../ReadableYamlFormatter.js");
const { MermaidSequenceTransformer } = require("../../MermaidSequenceTransformer.js");

//////////////////////////////////////////////////////////////////////////////
/**
 * Read a UTF-8 fixture file from the parallel feature slice.
 *
 * @param {string} fileName Fixture file name.
 * @returns {string} Fixture file contents.
 * @example
 * const source = readFixture("input.mmd");
 */
function readFixture(fileName) {
	return fs.readFileSync(path.join(__dirname, "10-parallel", fileName), "utf8");
}

//////////////////////////////////////////////////////////////////////////////
/**
 * Return the absolute path to a parallel fixture file.
 *
 * @param {string} fileName Fixture file name.
 * @returns {string} Absolute fixture path.
 * @example
 * const inputPath = getFixturePath("input.mmd");
 */
function getFixturePath(fileName) {
	return path.join(__dirname, "10-parallel", fileName);
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

describe("Mermaid feature slice 10: parallel fragments", () => {
	test("transforms Mermaid par and and syntax into sequencer parallel fragments", () => {
		const source = readFixture("input.mmd");
		const expectedYaml = readFixture("expected.sequencer.yaml");

		const transformed = MermaidSequenceTransformer.transform(source, { sourceName: getFixturePath("input.mmd") });

		expect(ReadableYamlFormatter.format(transformed)).toBe(expectedYaml);
		expect(transformed.lines[0].type).toBe("fragment");
		expect(transformed.lines[0].fragmentType).toBe("par");
		expect(transformed.lines[0].condition).toContain("par Primary branch");
		expect(transformed.lines[0].lines[1].type).toBe("condition");
		expect(transformed.lines[0].lines[1].condition).toContain("and Database branch");
		expect(transformed.lines[0].lines[3].type).toBe("condition");
		expect(transformed.lines[0].lines[3].condition).toContain("and Audit branch");
	});

	test("renders SVG from Mermaid parallel input and writes the transformed sequencer YAML sidecar", () => {
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
		expect(actualSvg).toContain('d="M 33 246 L 33 274 L 72 274 L 82 264 L 82 246 L 33 246"');
	});
});
