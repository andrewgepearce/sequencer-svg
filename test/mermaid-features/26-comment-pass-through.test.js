const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const yaml = require("js-yaml");

const { MermaidSequenceTransformer } = require("../../MermaidSequenceTransformer.js");

function readFixture(fileName) {
	return fs.readFileSync(path.join(__dirname, "26-comment-pass-through", fileName), "utf8");
}

function getFixturePath(fileName) {
	return path.join(__dirname, "26-comment-pass-through", fileName);
}

function createTempDir() {
	return fs.mkdtempSync(path.join(os.tmpdir(), "sequencer-svg-mermaid-"));
}

describe("Mermaid feature slice 26: comment pass-through", () => {
	test("retains Mermaid source comments as hidden transform metadata without changing the sequencer document shape", () => {
		const source = readFixture("input.mmd");
		const transformed = MermaidSequenceTransformer.transform(source, { sourceName: getFixturePath("input.mmd") });
		const expectedParsedYaml = yaml.safeLoad(readFixture("expected.sequencer.yaml"));

		expect(yaml.safeDump(transformed)).toBe(yaml.safeDump(expectedParsedYaml));
		expect(transformed.__mermaidComments).toEqual([
			{ lineNumber: 8, text: "Diagram overview" },
			{ lineNumber: 11, text: "Request comment" },
			{ lineNumber: 13, text: "Response comment" },
		]);
	});

	test("renders SVG from Mermaid input and writes transformed YAML with source comments preserved as YAML comments", () => {
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
