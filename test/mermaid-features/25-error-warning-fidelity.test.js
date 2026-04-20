const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

function readFixture(fileName) {
	return fs.readFileSync(path.join(__dirname, "25-error-warning-fidelity", fileName), "utf8");
}

function getFixturePath(fileName) {
	return path.join(__dirname, "25-error-warning-fidelity", fileName);
}

function createTempDir() {
	return fs.mkdtempSync(path.join(os.tmpdir(), "sequencer-svg-mermaid-"));
}

describe("Mermaid feature slice 25: error and warning fidelity", () => {
	test("fails fast for Mermaid transform errors with a structured CLI diagnostic and no output artefacts", () => {
		const tempDir = createTempDir();
		const inputFile = getFixturePath("input.mmd");
		const expectedStderr = readFixture("expected.stderr.txt");

		const result = spawnSync("node", ["sequencer.js", "--mermaid", "-i", inputFile, "-o", "-f", "-t", tempDir], {
			cwd: path.join(__dirname, "..", ".."),
			encoding: "utf8",
		});

		expect(result.status).not.toBe(0);
		expect(result.stdout).toBe("");
		expect(result.stderr.trimEnd()).toBe(expectedStderr.trimEnd());
		expect(fs.readdirSync(tempDir)).toEqual([]);
	});

	test("adds a generic syntax hint for unsupported Mermaid lines", () => {
		const tempDir = createTempDir();
		const inputFile = path.join(tempDir, "unsupported.mmd");
		fs.writeFileSync(
			inputFile,
			["sequenceDiagram", "participant API", "unsupportedThing API"].join("\n"),
			"utf8"
		);

		const result = spawnSync("node", ["sequencer.js", "--mermaid", "-i", inputFile], {
			cwd: path.join(__dirname, "..", ".."),
			encoding: "utf8",
		});

		expect(result.status).not.toBe(0);
		expect(result.stderr).toContain("Error whilst transforming Mermaid:");
		expect(result.stderr).toContain("Hint: Check the Mermaid syntax on this line against the currently supported sequence-diagram features.");
	});
});
