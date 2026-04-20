const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const { ReadableYamlFormatter } = require("../../ReadableYamlFormatter.js");
const { MermaidSequenceTransformer } = require("../../MermaidSequenceTransformer.js");

//////////////////////////////////////////////////////////////////////////////
/**
 * Read a UTF-8 fixture file from the colour-support feature slice.
 *
 * @param {string} fileName Fixture file name.
 * @returns {string} Fixture file contents.
 * @example
 * const source = readFixture("input.mmd");
 */
function readFixture(fileName) {
	return fs.readFileSync(path.join(__dirname, "27-colour-support", fileName), "utf8");
}

//////////////////////////////////////////////////////////////////////////////
/**
 * Return the absolute path to a colour-support fixture file.
 *
 * @param {string} fileName Fixture file name.
 * @returns {string} Absolute fixture path.
 * @example
 * const inputPath = getFixturePath("input.mmd");
 */
function getFixturePath(fileName) {
	return path.join(__dirname, "27-colour-support", fileName);
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

describe("Mermaid feature slice 27: colour support", () => {
	test("transforms Mermaid colour hints into sequencer colour properties", () => {
		const source = readFixture("input.mmd");
		const expectedYaml = readFixture("expected.sequencer.yaml");

		const transformed = MermaidSequenceTransformer.transform(source, { sourceName: getFixturePath("input.mmd") });

		expect(ReadableYamlFormatter.format(transformed)).toBe(expectedYaml);
		expect(transformed.actors[0].bgColour).toBe("#D0EBFF");
		expect(transformed.actors[0].fgColour).toBe("#0B7285");
		expect(transformed.actors[0].borderColour).toBe("#1971C2");
		expect(transformed.actors[1].bgColour).toBe("rgba(255, 244, 179, 0.8)");
		expect(transformed.actors[1].fgColour).toBe("rgb(102, 60, 0)");
		expect(transformed.actors[1].borderColour).toBe("#B08900");
		expect(transformed.actors[2].bgColour).toBe("#FFF3BF");
		expect(transformed.actors[2].fgColour).toBe("#7A4F01");
		expect(transformed.actors[2].borderColour).toBe("#F08C00");
		expect(transformed.actorGroups[0].bgColour).toBe("#FFE8CC");
		expect(transformed.lines[0].bgColour).toBe("#E7F5FF");
	});

	test("renders SVG from Mermaid colour-support input and writes the transformed sequencer YAML sidecar", () => {
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
		expect(actualSvg).toContain('fill="#D0EBFF"');
		expect(actualSvg).toContain('stroke="#1971C2"');
		expect(actualSvg).toContain('fill="#FFE8CC"');
		expect(actualSvg).toContain('fill="#E7F5FF"');
	});
});
