const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const yaml = require("js-yaml");

const { ReadableYamlFormatter } = require("../../ReadableYamlFormatter.js");
const { MermaidSequenceTransformer } = require("../../MermaidSequenceTransformer.js");

//////////////////////////////////////////////////////////////////////////////
/**
 * Read a UTF-8 fixture file from the actor-groups feature slice.
 *
 * @param {string} fileName Fixture file name.
 * @returns {string} Fixture file contents.
 * @example
 * const source = readFixture("input.mmd");
 */
function readFixture(fileName) {
	return fs.readFileSync(path.join(__dirname, "19-box-actor-groups", fileName), "utf8");
}

//////////////////////////////////////////////////////////////////////////////
/**
 * Return the absolute path to an actor-groups fixture file.
 *
 * @param {string} fileName Fixture file name.
 * @returns {string} Absolute fixture path.
 * @example
 * const inputPath = getFixturePath("input.mmd");
 */
function getFixturePath(fileName) {
	return path.join(__dirname, "19-box-actor-groups", fileName);
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
 * const count = countText(svg, "Shared services");
 */
function countText(svg, text) {
	const escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const matches = svg.match(new RegExp(`>${escapedText}</text>`, "g"));
	return Array.isArray(matches) ? matches.length : 0;
}

//////////////////////////////////////////////////////////////////////////////
/**
 * Count exact fill-colour occurrences inside an SVG string.
 *
 * @param {string} svg SVG markup.
 * @param {string} colour Exact fill-colour string.
 * @returns {number} Number of matching fill attributes.
 * @example
 * const count = countFill(svg, "rgba(210,230,255,0.6)");
 */
function countFill(svg, colour) {
	const escapedColour = colour.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const matches = svg.match(new RegExp(`fill="${escapedColour}"`, "g"));
	return Array.isArray(matches) ? matches.length : 0;
}

describe("Mermaid feature slice 19: box actor groups", () => {
	test("transforms Mermaid boxes into top-level sequencer actor groups", () => {
		const source = readFixture("input.mmd");
		const expectedYaml = readFixture("expected.sequencer.yaml");

		const transformed = MermaidSequenceTransformer.transform(source, { sourceName: getFixturePath("input.mmd") });

		expect(ReadableYamlFormatter.format(transformed)).toBe(expectedYaml);
		expect(transformed.actorGroups).toHaveLength(3);
		expect(transformed.actorGroups[0].title).toBe("Client tier");
		expect(transformed.actorGroups[0].bgColour).toBe("Aqua");
		expect(transformed.actorGroups[0].actors).toEqual(["Caller", "Browser"]);
		expect(transformed.actorGroups[1].actors).toEqual(["DB", "Cache"]);
		expect(transformed.actorGroups[2].title).toBe("Data tier");
		expect(transformed.actorGroups[2].actors).toEqual(["Audit"]);
		expect(transformed.actors.map((actor) => actor.alias)).toEqual(["Caller", "Browser", "DB", "Cache", "Service", "Audit"]);
	});

	test("renders SVG from Mermaid box input and writes the transformed sequencer YAML sidecar", () => {
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

	test("renders discontinuous actor groups as multiple titled boxes", () => {
		const tempDir = createTempDir();
		const inputFile = getFixturePath("discontinuous-actor-groups.sequencer.yaml");

		execFileSync("node", ["sequencer.js", "-y", "-i", inputFile, "-o", path.join(tempDir, "discontinuous.svg"), "-f"], {
			cwd: path.join(__dirname, "..", ".."),
			stdio: "pipe",
		});

		const svg = fs.readFileSync(path.join(tempDir, "discontinuous.svg"), "utf8");

		expect(countText(svg, "Shared services")).toBe(3);
		expect(countFill(svg, "rgba(210,230,255,0.6)")).toBe(3);
	});
});
