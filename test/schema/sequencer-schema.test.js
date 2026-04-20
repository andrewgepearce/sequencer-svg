const fs = require("fs");
const path = require("path");

const Ajv = require("ajv");
const yaml = require("js-yaml");

const sequencerSchema = require("../../schema/sequencer.schema.json");

//////////////////////////////////////////////////////////////////////////////
/**
 * Create the shared AJV validator for the published sequencer schema.
 *
 * @returns {Function} Compiled schema validation function.
 * @example
 * const validate = createValidator();
 */
function createValidator() {
	return new Ajv({ allErrors: true, strict: false }).compile(sequencerSchema);
}

//////////////////////////////////////////////////////////////////////////////
/**
 * List Mermaid feature-slice fixture directories that contain transformed YAML.
 *
 * @returns {string[]} Sorted fixture directory names.
 * @example
 * const fixtureDirectories = listMermaidFeatureDirectories();
 */
function listMermaidFeatureDirectories() {
	return fs
		.readdirSync(path.join(__dirname, "..", "mermaid-features"), { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.filter((entry) =>
			fs.existsSync(path.join(__dirname, "..", "mermaid-features", entry.name, "expected.sequencer.yaml"))
		)
		.map((entry) => entry.name)
		.sort();
}

//////////////////////////////////////////////////////////////////////////////
/**
 * Read and parse a transformed sequencer YAML fixture for schema validation.
 *
 * @param {string} directoryName Mermaid feature directory name.
 * @returns {object} Parsed sequencer document.
 * @example
 * const document = readSequencerFixture("01-participants-and-aliases");
 */
function readSequencerFixture(directoryName) {
	return yaml.safeLoad(
		fs.readFileSync(
			path.join(__dirname, "..", "mermaid-features", directoryName, "expected.sequencer.yaml"),
			"utf8"
		)
	);
}

//////////////////////////////////////////////////////////////////////////////
/**
 * Format AJV validation errors for a readable Jest assertion failure.
 *
 * @param {import("ajv").ErrorObject[] | null | undefined} errors AJV validation errors.
 * @returns {string} Human-readable error text.
 * @example
 * const errorText = formatValidationErrors(validate.errors);
 */
function formatValidationErrors(errors) {
	if (!errors || errors.length === 0) {
		return "Unknown schema validation failure";
	}

	return errors
		.map((error) => `${error.instancePath || "/"} ${error.message}`)
		.join("\n");
}

describe("Published sequencer JSON Schema", () => {
	const validate = createValidator();

	test("compiles the published schema", () => {
		expect(typeof validate).toBe("function");
	});

	test.each(listMermaidFeatureDirectories())(
		"accepts transformed Mermaid fixture %s/expected.sequencer.yaml",
		(directoryName) => {
			const document = readSequencerFixture(directoryName);
			const isValid = validate(document);

			if (!isValid) {
				throw new Error(formatValidationErrors(validate.errors));
			}

			expect(isValid).toBe(true);
		}
	);
});
