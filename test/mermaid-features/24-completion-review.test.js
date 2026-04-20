const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const yaml = require("js-yaml");

const { MermaidSequenceTransformer } = require("../../MermaidSequenceTransformer.js");

function readFixture(fileName) {
	return fs.readFileSync(path.join(__dirname, "24-completion-review", fileName), "utf8");
}

function getFixturePath(fileName) {
	return path.join(__dirname, "24-completion-review", fileName);
}

function createTempDir() {
	return fs.mkdtempSync(path.join(os.tmpdir(), "sequencer-svg-mermaid-"));
}

describe("Mermaid feature slice 24: completion review", () => {
	test("supports documented Mermaid text escapes and actor-name line breaks", () => {
		const source = readFixture("input.mmd");
		const expectedYaml = readFixture("expected.sequencer.yaml");

		const transformed = MermaidSequenceTransformer.transform(source, { sourceName: getFixturePath("input.mmd") });

		expect(yaml.safeDump(transformed)).toBe(expectedYaml);
		expect(transformed.actors[0].name).toEqual(["API", "Gateway"]);
		expect(transformed.actors[1].name).toBe("Primary # Store");
		expect(transformed.lines[0].comment).toBe("Escaped # and ; plus & name support");
		expect(transformed.lines[1].text).toBe("Query #42; status & health [Mermaid: API->>DB: Query #42; status & health]");
		expect(transformed.lines[2].text).toBe("OK <done> [Mermaid: DB-->>API: OK <done>]");
	});

	test("renders SVG from the completion-review Mermaid input and writes the transformed sequencer YAML sidecar", () => {
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
