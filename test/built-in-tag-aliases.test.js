const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

//////////////////////////////////////////////////////////////////////////////
/**
 * Return the absolute path to the built-in-tag-alias fixture input.
 *
 * @returns {string} Absolute fixture path.
 * @example
 * const inputPath = getFixturePath();
 */
function getFixturePath() {
	return path.join(__dirname, "fixtures", "built-in-tag-aliases.yaml");
}

//////////////////////////////////////////////////////////////////////////////
/**
 * Create a temporary directory for CLI rendering tests.
 *
 * @returns {string} Temporary directory path.
 * @example
 * const tempDir = createTempDir();
 */
function createTempDir() {
	return fs.mkdtempSync(path.join(os.tmpdir(), "sequencer-svg-tags-"));
}

describe("Built-in tag aliases", () => {
	test("renders legacy common aliases without requiring params.tags", () => {
		const tempDir = createTempDir();
		const outputFile = path.join(tempDir, "built-in-tag-aliases.svg");

		execFileSync("node", ["sequencer.js", "-y", "-i", getFixturePath(), "-o", outputFile, "-f"], {
			cwd: path.join(__dirname, ".."),
			stdio: "pipe",
		});

		const svg = fs.readFileSync(outputFile, "utf8");

		expect(svg).toMatch(
			/<text (?=[^>]*fill="rgb\(0,0,180\)")(?=[^>]*font-family="Liberation Mono, Courier New, Courier, monospace")[^>]*>const x = 1<\/text>/
		);
		expect(svg).toMatch(/<text (?=[^>]*fill="rgb\(30,30,30\)")(?=[^>]*font-style="italic")[^>]*>note text<\/text>/);
		expect(svg).toMatch(/<text (?=[^>]*font-style="italic")(?=[^>]*font-weight="bold")[^>]*>strong emphasis<\/text>/);
		expect(svg).toMatch(/<text (?=[^>]*fill="rgb\(30,30,30\)")(?=[^>]*font-style="italic")[^>]*>\/\/ shorthand comment<\/text>/);
	});

	test("lets params.tags override a built-in alias by name", () => {
		const tempDir = createTempDir();
		const inputFile = path.join(tempDir, "override.yaml");
		const outputFile = path.join(tempDir, "override.svg");

		fs.writeFileSync(
			inputFile,
			[
				"title: Override built-in tag alias",
				"version: '1.0'",
				"actors:",
				"  - {name: Client, alias: client}",
				"params:",
				"  tags:",
				"    - '<code>=<rgb(255,0,0)><b>'",
				"    - '</code>=</b></rgb>'",
				"lines:",
				"  - type: blank",
				"    height: 0",
				"    comment:",
				"      - '<code>override me</code>'",
				"",
			].join("\n"),
			"utf8"
		);

		execFileSync("node", ["sequencer.js", "-y", "-i", inputFile, "-o", outputFile, "-f"], {
			cwd: path.join(__dirname, ".."),
			stdio: "pipe",
		});

		const svg = fs.readFileSync(outputFile, "utf8");

		expect(svg).toMatch(/<text (?=[^>]*fill="rgb\(255,0,0\)")(?=[^>]*font-weight="bold")[^>]*>override me<\/text>/);
		expect(svg).not.toMatch(
			/<text (?=[^>]*fill="rgb\(0,0,180\)")(?=[^>]*font-family="Liberation Mono, Courier New, Courier, monospace")[^>]*>override me<\/text>/
		);
	});
});
