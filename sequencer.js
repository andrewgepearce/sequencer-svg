// Copyright (C) 2019 Mark The Page
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

const fs = require("fs");
const path = require("path");
const uuid = require("node-uuid");
const sanitize = require("sanitize-filename");
const yaml = require("js-yaml");
const commandLineArgs = require("command-line-args");
const commandLineUsage = require("command-line-usage");

const SvgStart = require("./SvgStart.js");
const { MermaidSequenceTransformer, MermaidTransformError } = require("./MermaidSequenceTransformer.js");

//////////////////////////////////////////////////////////////////////////////
/**
 * Hold the formatted JSON representation of the current input document.
 *
 * @type {string|undefined}
 */
let jsonstr = undefined;

//////////////////////////////////////////////////////////////////////////////
/**
 * Hold the formatted YAML representation of the current input document.
 *
 * @type {string|undefined}
 */
let yamlstr = undefined;

//////////////////////////////////////////////////////////////////////////////
/**
 * Describe the supported command-line options.
 *
 * @type {Array<object>}
 */
const optionDefinitions = [
	{ name: "id", type: String, alias: "I", multiple: false },
	{ name: "inputFile", type: String, alias: "i", multiple: false },
	{ name: "outputFile", type: String, alias: "o", multiple: false },
	{ name: "targetDir", type: String, alias: "t", multiple: false },
	{ name: "verbose", type: Boolean, alias: "v", multiple: false },
	{ name: "force", type: Boolean, alias: "f", multiple: false },
	{ name: "outjson", type: Boolean, alias: "J", multiple: false },
	{ name: "outyaml", type: Boolean, alias: "Y", multiple: false },
	{ name: "yaml", type: Boolean, alias: "y", multiple: false },
	{ name: "mermaid", type: Boolean, alias: "m", multiple: false },
	{ name: "transformOnly", type: Boolean, alias: "T", multiple: false },
	{ name: "nocovertext", type: Boolean, alias: "c", multiple: false },
	{ name: "help", alias: "?", type: Boolean, multiple: false },
];

//////////////////////////////////////////////////////////////////////////////
/**
 * Define the usage sections shown by the CLI help output.
 *
 * @type {Array<object>}
 */
const sections = [
	{
		header: "sequencer-svg",
		content:
			"Reads JSON, YAML, or Mermaid sequence-diagram input from <stdin> or a file and generates sequencer-svg YAML and optional SVG output.",
	},
	{
		header: "Options",
		optionList: [
			{ name: "id", type: String, alias: "I", description: "ID used in <stderr> log lines if -v is provided." },
			{ name: "verbose", type: Boolean, alias: "v", description: "Emit verbose (debug) log messages to <stderr>." },
			{ name: "yaml", type: Boolean, alias: "y", description: "Treat input as YAML instead of JSON." },
			{ name: "mermaid", type: Boolean, alias: "m", description: "Treat input as Mermaid sequence-diagram syntax." },
			{ name: "transformOnly", type: Boolean, alias: "T", description: "Stop after writing the transformed sequencer YAML." },
			{ name: "inputFile", type: String, alias: "i", description: "Read input from this file instead of <stdin>." },
			{
				name: "outputFile",
				type: String,
				alias: "o",
				description:
					"Write the primary output to this file. In Mermaid transform-only mode this is YAML. Otherwise it is SVG. If set without a value, a derived file name is used.",
			},
			{ name: "targetDir", type: String, alias: "t", description: "Directory to write output files to." },
			{ name: "force", type: Boolean, alias: "f", description: "Overwrite output files if they already exist." },
			{ name: "outjson", type: Boolean, alias: "J", description: "Also write a formatted JSON file." },
			{ name: "outyaml", type: Boolean, alias: "Y", description: "Also write a formatted YAML file." },
			{ name: "nocovertext", type: Boolean, alias: "c", description: "Skip rendering the title, version and description cover text." },
			{ name: "help", alias: "?", type: Boolean, description: "Print this help." },
		],
	},
];

//////////////////////////////////////////////////////////////////////////////
/**
 * Hold the normalised command-line options for the current run.
 *
 * @type {object|undefined}
 */
let options = undefined;

runCli();

////////////////////////////////////////////////////////////////////////////////
/**
 * Run the command-line entrypoint for sequencer-svg.
 *
 * @returns {void} Nothing.
 * @example
 * runCli();
 */
function runCli() {
	///////////////////////////////////////////////////////////////////////////////
	// Parse the command-line arguments and normalise omitted booleans before
	// reading any input.
	try {
		options = commandLineArgs(optionDefinitions);
	} catch (error) {
		console.error(error.message);
		process.exit(-1);
	}

	options = normaliseOptions(options);

	if (options.help === true) {
		console.error(commandLineUsage(sections));
		process.exit(0);
	}

	if (options.verbose === true) {
		console.error("CLA: " + JSON.stringify(options));
	}

	///////////////////////////////////////////////////////////////////////////////
	// Read the input, build the sequencer document, and dispatch the requested
	// transform and render outputs.
	const rawInput = readInputData(options.inputFile);
	const sourceName = typeof options.inputFile === "string" ? options.inputFile : undefined;
	const jsondescription = buildInputDocument(rawInput, sourceName);
	processJsonDescription(jsondescription, sourceName);
}

////////////////////////////////////////////////////////////////////////////////
/**
 * Normalise the parsed CLI options with stable defaults.
 *
 * @param {object} parsedOptions Parsed command-line options.
 * @returns {object} Normalised options.
 * @example
 * const options = normaliseOptions({});
 */
function normaliseOptions(parsedOptions) {
	///////////////////////////////////////////////////////////////////////////////
	// Apply the existing CLI defaults and ensure Mermaid mode does not collide
	// with the legacy JSON versus YAML flags.
	const normalisedOptions = typeof parsedOptions === "object" && parsedOptions != null ? parsedOptions : {};
	if (normalisedOptions.id == undefined) normalisedOptions.id = assignId();
	if (normalisedOptions.verbose == undefined) normalisedOptions.verbose = false;
	if (normalisedOptions.help == undefined) normalisedOptions.help = false;
	if (normalisedOptions.outjson == undefined) normalisedOptions.outjson = false;
	if (normalisedOptions.outyaml == undefined) normalisedOptions.outyaml = false;
	if (normalisedOptions.yaml == undefined) normalisedOptions.yaml = false;
	if (normalisedOptions.mermaid == undefined) normalisedOptions.mermaid = false;
	if (normalisedOptions.transformOnly == undefined) normalisedOptions.transformOnly = false;
	if (normalisedOptions.force == undefined) normalisedOptions.force = false;
	if (normalisedOptions.nocovertext == undefined) normalisedOptions.nocovertext = false;

	if (normalisedOptions.mermaid === true && normalisedOptions.yaml === true) {
		console.error("Cannot use --mermaid and --yaml together");
		process.exit(-1);
	}

	return normalisedOptions;
}

////////////////////////////////////////////////////////////////////////////////
/**
 * Read the raw input text from a file or from stdin.
 *
 * @param {string|undefined} inputFile Optional input file path.
 * @returns {string} Raw input data.
 * @example
 * const source = readInputData("./diagram.yaml");
 */
function readInputData(inputFile) {
	///////////////////////////////////////////////////////////////////////////////
	// Use synchronous reads so the CLI path remains linear and easy to test.
	try {
		if (typeof inputFile === "string" && inputFile.length > 0) {
			return fs.readFileSync(inputFile, "utf8");
		}

		return fs.readFileSync(0, "utf8");
	} catch (error) {
		console.error(error.message);
		process.exit(-1);
	}
}

////////////////////////////////////////////////////////////////////////////////
/**
 * Build the sequencer document from the raw input text.
 *
 * @param {string} data Raw input data.
 * @param {string|undefined} sourceName Optional source file name.
 * @returns {object} Sequencer document object.
 * @example
 * const document = buildInputDocument(source, "diagram.mmd");
 */
function buildInputDocument(data, sourceName) {
	///////////////////////////////////////////////////////////////////////////////
	// Route Mermaid input through the dedicated transformer and keep the derived
	// sequencer JSON and YAML strings available for later sidecar output.
	if (options.mermaid === true) {
		try {
			const jsono = MermaidSequenceTransformer.transform(data, { sourceName: sourceName });
			jsonstr = JSON.stringify(jsono, null, 3);
			yamlstr = yaml.safeDump(jsono);
			return jsono;
		} catch (error) {
			if (error instanceof MermaidTransformError) {
				console.error("Error whilst transforming Mermaid: " + error.message);
				process.exit(-1);
			}

			throw error;
		}
	}

	return getObjectFromData(data, options.yaml);
}

////////////////////////////////////////////////////////////////////////////////
/**
 * Generate a correlation identifier for verbose log messages.
 *
 * @returns {string} Correlation identifier.
 * @example
 * const id = assignId();
 */
function assignId() {
	return uuid.v4();
}

////////////////////////////////////////////////////////////////////////////////
/**
 * Process the sequencer document and write the requested output artefacts.
 *
 * @param {object} jsondescription Sequencer document object.
 * @param {string|undefined} sourceName Optional source file name.
 * @returns {void} Nothing.
 * @example
 * processJsonDescription(document, "diagram.mmd");
 */
function processJsonDescription(jsondescription, sourceName) {
	///////////////////////////////////////////////////////////////////////////////
	// Derive the output file paths once so Mermaid sidecars and rendered SVG stay
	// aligned to the same output stem.
	const outputStem = deriveOutputStem(jsondescription, sourceName);
	const svgFile = buildDerivedOutputPath(outputStem + ".svg");
	const jsonFile = buildDerivedOutputPath(outputStem + ".json");
	const yamlFile = buildDerivedOutputPath(outputStem + (options.mermaid === true ? ".sequencer.yaml" : ".yaml"));

	if (options.mermaid === true) {
		writeTransformedYamlArtifact(yamlFile);
	}

	if (options.transformOnly === true) {
		handleTransformOnlyOutput(yamlFile);
		if (options.outjson === true) {
			writeFileWithOverwrite(jsonFile, jsonstr);
		}
		return;
	}

	///////////////////////////////////////////////////////////////////////////////
	// Render the SVG from the sequencer document and preserve the transformed
	// YAML sidecar in Mermaid mode.
	const ss = new SvgStart();
	try {
		const svg = ss.draw(jsondescription, null, options.verbose, options.id, options.nocovertext);
		writePrimaryRenderOutput(svg, svgFile);

		if (options.outjson === true) {
			writeFileWithOverwrite(jsonFile, jsonstr);
		}

		if (options.outyaml === true && options.mermaid !== true) {
			writeFileWithOverwrite(yamlFile, yamlstr);
		}
	} catch (error) {
		console.error("Error processing: " + error.message);
		if (options.verbose === true) console.error(error.stack);
		process.exit(-1);
	}
}

////////////////////////////////////////////////////////////////////////////////
/**
 * Handle output in Mermaid transform-only mode.
 *
 * @param {string} yamlFile Default transformed YAML file path.
 * @returns {void} Nothing.
 * @example
 * handleTransformOnlyOutput("./diagram.sequencer.yaml");
 */
function handleTransformOnlyOutput(yamlFile) {
	///////////////////////////////////////////////////////////////////////////////
	// Print the transformed YAML to stdout when no explicit output path was
	// requested, while still keeping the sidecar file available on disk.
	if (options.outputFile === undefined) {
		process.stdout.write(yamlstr);
		return;
	}

	if (options.outputFile === null) {
		writeFileWithOverwrite(yamlFile, yamlstr);
		return;
	}

	writeFileWithOverwrite(options.outputFile, yamlstr);
}

////////////////////////////////////////////////////////////////////////////////
/**
 * Write the primary SVG render output according to the CLI options.
 *
 * @param {string|Buffer} svg SVG output payload.
 * @param {string} svgFile Derived SVG output path.
 * @returns {void} Nothing.
 * @example
 * writePrimaryRenderOutput(svg, "./diagram.svg");
 */
function writePrimaryRenderOutput(svg, svgFile) {
	///////////////////////////////////////////////////////////////////////////////
	// Preserve the historical stdout behaviour when the caller did not ask for a
	// file-based primary output path.
	if (options.outputFile === undefined) {
		process.stdout.write(svg);
		return;
	}

	if (options.outputFile === null) {
		writeFileWithOverwrite(svgFile, svg);
		return;
	}

	writeFileWithOverwrite(options.outputFile, svg);
}

////////////////////////////////////////////////////////////////////////////////
/**
 * Persist the transformed YAML sidecar when Mermaid input mode is active.
 *
 * @param {string} yamlFile Default transformed YAML file path.
 * @returns {void} Nothing.
 * @example
 * writeTransformedYamlArtifact("./diagram.sequencer.yaml");
 */
function writeTransformedYamlArtifact(yamlFile) {
	writeFileWithOverwrite(yamlFile, yamlstr);
}

////////////////////////////////////////////////////////////////////////////////
/**
 * Write a file while respecting the `--force` overwrite flag.
 *
 * @param {string} filePath Output file path.
 * @param {string|Buffer} contents File contents.
 * @returns {void} Nothing.
 * @example
 * writeFileWithOverwrite("./diagram.svg", "<svg />");
 */
function writeFileWithOverwrite(filePath, contents) {
	///////////////////////////////////////////////////////////////////////////////
	// Guard existing files unless the caller explicitly opted into overwriting.
	if (typeof filePath !== "string" || filePath.length === 0) {
		console.error("Cannot write output because the file path is empty");
		process.exit(-1);
	}

	if (options.force !== true && fs.existsSync(filePath)) {
		console.error(`Cannot write to file "${filePath}" as it already exists`);
		process.exit(-1);
	}

	fs.writeFileSync(filePath, contents);
}

////////////////////////////////////////////////////////////////////////////////
/**
 * Derive the output stem used for SVG, JSON, and YAML artefacts.
 *
 * @param {object} obj Sequencer document object.
 * @param {string|undefined} sourceName Optional source file name.
 * @returns {string} Sanitised output stem.
 * @example
 * const stem = deriveOutputStem(document, "diagram.mmd");
 */
function deriveOutputStem(obj, sourceName) {
	///////////////////////////////////////////////////////////////////////////////
	// Prefer the source file stem when available so Mermaid fixtures and sidecar
	// outputs stay predictably grouped.
	if (typeof sourceName === "string" && sourceName.length > 0) {
		return sanitize(path.basename(sourceName, path.extname(sourceName)));
	}

	return sanitize(getTitle(obj).split(" ").join("_"));
}

////////////////////////////////////////////////////////////////////////////////
/**
 * Build a derived output path inside the optional target directory.
 *
 * @param {string} fileName Derived file name.
 * @returns {string} Output path.
 * @example
 * const filePath = buildDerivedOutputPath("diagram.svg");
 */
function buildDerivedOutputPath(fileName) {
	if (typeof options.targetDir === "string" && options.targetDir.length > 0) {
		return path.join(options.targetDir, fileName);
	}

	return fileName;
}

////////////////////////////////////////////////////////////////////////////////
/**
 * Build a human-readable title from a sequencer document.
 *
 * @param {object} obj Sequencer document object.
 * @returns {string} Combined title and version string.
 * @example
 * const title = getTitle(document);
 */
function getTitle(obj) {
	let title = "";
	if (typeof obj != "object") obj = {};
	if (typeof obj.title == "string" && obj.title.length > 0) {
		title += obj.title;
	} else if (isAllStrings(obj.title)) {
		obj.title.forEach((str) => {
			title += str;
		});
	} else if (typeof obj.title == "object" && typeof obj.title.text == "string" && obj.title.text.length > 0) {
		title += obj.title.text;
	} else if (typeof obj.title == "object" && isAllStrings(obj.title.text)) {
		obj.title.text.forEach((str) => {
			title += str;
		});
	} else {
		title += "NoTitleSet";
	}
	title += ".";
	if (typeof obj.version == "string" && obj.version.length > 0) {
		title += obj.version;
	} else if (isAllStrings(obj.version)) {
		obj.version.forEach((str) => {
			title += str;
		});
	} else if (typeof obj.version == "object" && typeof obj.version.text == "string" && obj.version.text.length > 0) {
		title += obj.version.text;
	} else if (typeof obj.version == "object" && isAllStrings(obj.version.text)) {
		obj.version.text.forEach((str) => {
			title += str;
		});
	} else {
		title += "NoVersionSet";
	}
	return title;
}

////////////////////////////////////////////////////////////////////////////////
/**
 * Check whether every item in an array is a string.
 *
 * @param {*} arr Candidate array value.
 * @returns {boolean} True when the value is an array of strings.
 * @example
 * const ok = isAllStrings(["a", "b"]);
 */
function isAllStrings(arr) {
	if (!Array.isArray(arr)) return false;
	let allStr = true;
	arr.forEach((str) => {
		if (typeof str != "string") allStr = false;
	});
	return allStr;
}

////////////////////////////////////////////////////////////////////////////////
/**
 * Parse JSON or YAML input data into a sequencer document object.
 *
 * @param {string} data Raw input data.
 * @param {boolean} isYaml True when the input should be parsed as YAML.
 * @returns {object} Parsed sequencer document object.
 * @example
 * const document = getObjectFromData("title: Example", true);
 */
function getObjectFromData(data, isYaml) {
	if (isYaml) {
		try {
			const jsono = loadWithSourceLines(data, (msg) => console.error("Warning whilst parsing YAML: " + msg));
			jsonstr = JSON.stringify(jsono, null, 3);
			yamlstr = yaml.safeDump(jsono);
			return jsono;
		} catch (error) {
			console.error("Error whilst parsing YAML: " + error.message);
			process.exit(-1);
		}
	}

	try {
		const jsono = JSON.parse(data);
		jsonstr = JSON.stringify(jsono, null, 3);
		yamlstr = yaml.safeDump(jsono);
		annotateJsonWithSourceLines(jsono, data);
		return jsono;
	} catch (error) {
		console.error("Error whilst parsing JSON: " + error);
		process.exit(-1);
	}
}

////////////////////////////////////////////////////////////////////////////////
/**
 * Parse YAML while attaching source-line metadata to object nodes.
 *
 * @param {string} data Raw YAML input.
 * @param {Function} onWarning Warning callback.
 * @returns {object} Parsed YAML object.
 * @example
 * const document = loadWithSourceLines("title: Example", console.error);
 */
function loadWithSourceLines(data, onWarning) {
	const opens = [];
	const jsono = yaml.safeLoad(data, {
		onWarning: (error) => onWarning(error.message),
		json: true,
		listener: function (eventType, state) {
			if (eventType === "open") {
				opens.push(state.line);
			} else if (eventType === "close") {
				const startLine = opens.pop();
				if (state.result && typeof state.result === "object") {
					try {
						Object.defineProperty(state.result, "__sourceLine", {
							value: (startLine != null ? startLine : state.line) + 1,
							enumerable: false,
							configurable: true,
							writable: true,
						});
					} catch (e) {
						////////////////////////////////////////////////////////////////////////////
						// Ignore; source-line annotation is best-effort.
					}
				}
			}
		},
	});
	return jsono;
}

////////////////////////////////////////////////////////////////////////////////
/**
 * Copy source-line annotations onto a JSON-parsed object tree.
 *
 * @param {object} parsed JSON-parsed object.
 * @param {string} rawData Raw JSON input.
 * @returns {void} Nothing.
 * @example
 * annotateJsonWithSourceLines(parsed, rawData);
 */
function annotateJsonWithSourceLines(parsed, rawData) {
	///////////////////////////////////////////////////////////////////////////////
	// Use js-yaml with the source-line listener because JSON is valid YAML and
	// then copy the line metadata across the structurally equivalent trees.
	let annotated;
	try {
		annotated = loadWithSourceLines(rawData, () => {});
	} catch (e) {
		return;
	}
	copySourceLines(parsed, annotated);
}

////////////////////////////////////////////////////////////////////////////////
/**
 * Copy `__sourceLine` properties recursively between object trees.
 *
 * @param {*} target Destination object tree.
 * @param {*} source Source object tree.
 * @returns {void} Nothing.
 * @example
 * copySourceLines(target, source);
 */
function copySourceLines(target, source) {
	if (target == null || source == null) return;
	if (typeof target !== "object" || typeof source !== "object") return;
	if (source.__sourceLine != null) {
		try {
			Object.defineProperty(target, "__sourceLine", {
				value: source.__sourceLine,
				enumerable: false,
				configurable: true,
				writable: true,
			});
		} catch (e) {}
	}
	if (Array.isArray(target) && Array.isArray(source)) {
		const len = Math.min(target.length, source.length);
		for (let i = 0; i < len; i++) copySourceLines(target[i], source[i]);
	} else if (!Array.isArray(target) && !Array.isArray(source)) {
		Object.keys(target).forEach((k) => {
			if (Object.prototype.hasOwnProperty.call(source, k)) copySourceLines(target[k], source[k]);
		});
	}
}
