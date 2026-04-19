const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const yaml = require("js-yaml");

const { MermaidSequenceTransformer } = require("../../MermaidSequenceTransformer.js");

//////////////////////////////////////////////////////////////////////////////
/**
 * Read a UTF-8 fixture file from the actor-link-visuals slice.
 *
 * @param {string} fileName Fixture file name.
 * @returns {string} Fixture file contents.
 * @example
 * const source = readFixture("input.mmd");
 */
function readFixture(fileName) {
	return fs.readFileSync(path.join(__dirname, "23-actor-link-visuals", fileName), "utf8");
}

//////////////////////////////////////////////////////////////////////////////
/**
 * Return the absolute path to an actor-link-visuals fixture file.
 *
 * @param {string} fileName Fixture file name.
 * @returns {string} Absolute fixture path.
 * @example
 * const inputPath = getFixturePath("input.mmd");
 */
function getFixturePath(fileName) {
	return path.join(__dirname, "23-actor-link-visuals", fileName);
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

describe("Mermaid feature slice 23: actor link visuals", () => {
	test("retains Mermaid actor-link metadata for visual rendering", () => {
		const source = readFixture("input.mmd");
		const expectedYaml = readFixture("expected.sequencer.yaml");

		const transformed = MermaidSequenceTransformer.transform(source, { sourceName: getFixturePath("input.mmd") });

		expect(yaml.safeDump(transformed)).toBe(expectedYaml);
		expect(transformed.actors[0].links).toEqual([
			{ label: "Dashboard", url: "https://status.example.test/api" },
			{ label: "Docs", url: "https://docs.example.test/api" },
		]);
		expect(transformed.actors[1].links).toEqual([{ label: "Schema", url: "https://docs.example.test/db" }]);
		expect(transformed.actors[2].links).toEqual([
			{ label: "Queue metrics", url: "https://ops.example.test/queue" },
			{ label: "Runbook", url: "https://ops.example.test/queue-runbook" },
		]);
		expect(transformed.actors[3].links).toBeUndefined();
	});

	test("renders SVG with actor header link icons and clickable bottom references", () => {
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
		expect(actualSvg).toContain('<a href="https://status.example.test/api"');
		expect(actualSvg).toContain('<a href="https://ops.example.test/queue-runbook"');
		expect(actualSvg).toContain(">Links<");
	});
});
