const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const yaml = require("js-yaml");

const { ReadableYamlFormatter } = require("../../ReadableYamlFormatter.js");
const { MermaidSequenceTransformer } = require("../../MermaidSequenceTransformer.js");

//////////////////////////////////////////////////////////////////////////////
/**
 * Read a UTF-8 fixture file from the specialised-participants feature slice.
 *
 * @param {string} fileName Fixture file name.
 * @returns {string} Fixture file contents.
 * @example
 * const source = readFixture("input.mmd");
 */
function readFixture(fileName) {
	return fs.readFileSync(path.join(__dirname, "20-specialised-participants", fileName), "utf8");
}

//////////////////////////////////////////////////////////////////////////////
/**
 * Return the absolute path to a specialised-participants fixture file.
 *
 * @param {string} fileName Fixture file name.
 * @returns {string} Absolute fixture path.
 * @example
 * const inputPath = getFixturePath("input.mmd");
 */
function getFixturePath(fileName) {
	return path.join(__dirname, "20-specialised-participants", fileName);
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

describe("Mermaid feature slice 20: specialised participants", () => {
	test("transforms Mermaid @{} specialised participant declarations into sequencer actor metadata", () => {
		const source = readFixture("input.mmd");
		const expectedYaml = readFixture("expected.sequencer.yaml");

		const transformed = MermaidSequenceTransformer.transform(source, { sourceName: getFixturePath("input.mmd") });

		expect(ReadableYamlFormatter.format(transformed)).toBe(expectedYaml);
		expect(transformed.actors.map((actor) => actor.alias)).toEqual([
			"User",
			"Edge",
			"FlowController",
			"OrderEntity",
			"DB",
			"CollectionsNode",
			"JobQueue",
		]);
		expect(transformed.actors.map((actor) => actor.actorType)).toEqual([
			"actor",
			"boundary",
			"control",
			"entity",
			"database",
			"collections",
			"queue",
		]);
		expect(transformed.actors.map((actor) => actor.name)).toEqual([
			"Human operator",
			"External boundary",
			"Flow controller",
			"Order entity",
			"Primary store",
			"Collections store",
			"Job queue",
		]);
		expect(transformed.actors[4].name).toBe("Primary store");
		expect(transformed.actors[4].alias).toBe("DB");
	});

	test("renders SVG from Mermaid specialised-participant input and writes the transformed sequencer YAML sidecar", () => {
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
