const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const yaml = require("js-yaml");

const { ReadableYamlFormatter } = require("../../ReadableYamlFormatter.js");
const { MermaidSequenceTransformer } = require("../../MermaidSequenceTransformer.js");

//////////////////////////////////////////////////////////////////////////////
/**
 * Read a UTF-8 fixture file from the advanced-arrows feature slice.
 *
 * @param {string} fileName Fixture file name.
 * @returns {string} Fixture file contents.
 * @example
 * const source = readFixture("input.mmd");
 */
function readFixture(fileName) {
	return fs.readFileSync(path.join(__dirname, "09-advanced-arrows", fileName), "utf8");
}

//////////////////////////////////////////////////////////////////////////////
/**
 * Return the absolute path to an advanced-arrows fixture file.
 *
 * @param {string} fileName Fixture file name.
 * @returns {string} Absolute fixture path.
 * @example
 * const inputPath = getFixturePath("input.mmd");
 */
function getFixturePath(fileName) {
	return path.join(__dirname, "09-advanced-arrows", fileName);
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

describe("Mermaid feature slice 9: advanced arrows", () => {
	test("transforms Mermaid advanced arrows into sequencer endpoint arrows", () => {
		const source = readFixture("input.mmd");
		const expectedYaml = readFixture("expected.sequencer.yaml");

		const transformed = MermaidSequenceTransformer.transform(source, { sourceName: getFixturePath("input.mmd") });

		expect(ReadableYamlFormatter.format(transformed)).toBe(expectedYaml);
		expect(transformed.lines[0].fromArrow).toBe("fill");
		expect(transformed.lines[0].toArrow).toBe("fill");
		expect(transformed.lines[1].type).toBe("return");
		expect(transformed.lines[1].fromArrow).toBe("fill");
		expect(transformed.lines[1].toArrow).toBe("fill");
		expect(transformed.lines[2].toArrow).toBe("halfTop");
		expect(transformed.lines[3].type).toBe("return");
		expect(transformed.lines[3].toArrow).toBe("halfBottom");
		expect(transformed.lines[4].fromArrow).toBe("halfTop");
		expect(transformed.lines[5].type).toBe("return");
		expect(transformed.lines[5].fromArrow).toBe("halfBottom");
		expect(transformed.lines[6].toArrow).toBe("stickTop");
		expect(transformed.lines[7].type).toBe("return");
		expect(transformed.lines[7].toArrow).toBe("stickBottom");
		expect(transformed.lines[8].fromArrow).toBe("stickTop");
		expect(transformed.lines[9].type).toBe("return");
		expect(transformed.lines[9].fromArrow).toBe("stickBottom");
	});

	test("renders SVG from Mermaid advanced-arrow input and writes the transformed sequencer YAML sidecar", () => {
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
