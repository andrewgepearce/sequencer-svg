const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const yaml = require("js-yaml");

const { ReadableYamlFormatter } = require("../../ReadableYamlFormatter.js");
const { MermaidSequenceTransformer } = require("../../MermaidSequenceTransformer.js");

//////////////////////////////////////////////////////////////////////////////
/**
 * Read a UTF-8 fixture file from the notes feature slice.
 *
 * @param {string} fileName Fixture file name.
 * @returns {string} Fixture file contents.
 * @example
 * const source = readFixture("input.mmd");
 */
function readFixture(fileName) {
	return fs.readFileSync(path.join(__dirname, "03-notes", fileName), "utf8");
}

//////////////////////////////////////////////////////////////////////////////
/**
 * Return the absolute path to a notes fixture file.
 *
 * @param {string} fileName Fixture file name.
 * @returns {string} Absolute fixture path.
 * @example
 * const inputPath = getFixturePath("input.mmd");
 */
function getFixturePath(fileName) {
	return path.join(__dirname, "03-notes", fileName);
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

describe("Mermaid feature slice 3: notes", () => {
	test("transforms Mermaid notes into sequencer blank-line comments", () => {
		const source = readFixture("input.mmd");
		const expectedYaml = readFixture("expected.sequencer.yaml");

		const transformed = MermaidSequenceTransformer.transform(source, { sourceName: getFixturePath("input.mmd") });

		expect(ReadableYamlFormatter.format(transformed)).toBe(expectedYaml);
	});

	test("attaches an immediately preceding Note over source,target to the next message", () => {
		const transformed = MermaidSequenceTransformer.transform(
			[
				"sequenceDiagram",
				"participant A",
				"participant B",
				"Note over A,B: Request context",
				"A->>B: Request",
			].join("\n"),
			{ sourceName: "attached-note.mmd" }
		);

		expect(transformed.lines).toHaveLength(1);
		expect(transformed.lines[0]).toMatchObject({
			type: "call",
			from: "A",
			to: "B",
			text: "Request",
			comment: "Request context",
		});
	});

	test("leaves a Note over with reversed actors as a standalone blank comment", () => {
		const transformed = MermaidSequenceTransformer.transform(
			[
				"sequenceDiagram",
				"participant A",
				"participant B",
				"Note over B,A: Not attached",
				"A->>B: Request",
			].join("\n"),
			{ sourceName: "standalone-note.mmd" }
		);

		expect(transformed.lines).toHaveLength(2);
		expect(transformed.lines[0]).toMatchObject({
			type: "blank",
			height: 0,
			comment: "Not attached",
			actors: ["B", "A"],
		});
		expect(transformed.lines[1]).toMatchObject({
			type: "call",
			from: "A",
			to: "B",
			text: "Request",
		});
		expect(transformed.lines[1].comment).toBeUndefined();
	});

	test("renders SVG from Mermaid note input and writes the transformed sequencer YAML sidecar", () => {
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
