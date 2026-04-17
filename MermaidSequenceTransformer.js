const path = require("path");

//////////////////////////////////////////////////////////////////////////////
/**
 * Represent a Mermaid source-line parsing failure during transformation.
 *
 * @extends Error
 * @example
 * throw new MermaidTransformError("Unsupported Mermaid syntax", 4, "autonumber");
 */
class MermaidTransformError extends Error {
	////////////////////////////////////////////////////////////////////////////
	/**
	 * Create a Mermaid transform error with optional source-line context.
	 *
	 * @param {string} message Error description.
	 * @param {number|undefined} lineNumber 1-based source line number.
	 * @param {string|undefined} sourceLine Original Mermaid source line.
	 * @returns {void} Nothing.
	 * @example
	 * const error = new MermaidTransformError("Bad participant", 3, "participant");
	 */
	constructor(message, lineNumber, sourceLine) {
		super(lineNumber ? `${message} at Mermaid source line ${lineNumber}` : message);
		this.name = "MermaidTransformError";
		this.lineNumber = lineNumber;
		this.sourceLine = sourceLine;
	}
}

//////////////////////////////////////////////////////////////////////////////
/**
 * Transform Mermaid sequence-diagram source into a sequencer-svg document.
 * Slice 1 supports explicit `participant` and `actor` declarations only.
 *
 * @example
 * const document = MermaidSequenceTransformer.transform(source, { sourceName: "sample.mmd" });
 */
class MermaidSequenceTransformer {
	////////////////////////////////////////////////////////////////////////////
	/**
	 * Transform Mermaid source into a sequencer-svg document.
	 *
	 * @param {string} source Mermaid source text.
	 * @param {{ sourceName?: string }} [options={}] Optional transform options.
	 * @returns {{ title: string, version: string, actors: object[], lines: object[] }} Transformed sequencer document.
	 * @throws {MermaidTransformError} If the Mermaid source uses unsupported syntax for this slice.
	 * @example
	 * const document = MermaidSequenceTransformer.transform("sequenceDiagram\nparticipant A", {});
	 */
	static transform(source, options = {}) {
		////////////////////////////////////////////////////////////////////////////
		// Prepare the destination document and iterate through the Mermaid source
		// line by line so future slices can extend the transform incrementally.
		if (typeof source !== "string" || source.trim().length === 0) {
			throw new MermaidTransformError("Mermaid input must be a non-empty string");
		}

		const stem = this._deriveStem(options.sourceName);
		const document = {
			title: this._humaniseStem(stem),
			version: "1.0",
			actors: [],
			lines: [],
		};

		const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/);
		let seenSequenceDiagram = false;
		let insideDirective = false;

		for (let index = 0; index < lines.length; index++) {
			const sourceLine = lines[index];
			const lineNumber = index + 1;
			const trimmed = sourceLine.trim();

			////////////////////////////////////////////////////////////////////////////
			// Ignore blank lines, Mermaid comments, and directive bodies so the slice
			// can focus on participant declarations only.
			if (trimmed.length === 0) {
				continue;
			}

			if (insideDirective) {
				if (trimmed.endsWith("}%%")) insideDirective = false;
				continue;
			}

			if (trimmed.startsWith("%%{")) {
				if (!trimmed.endsWith("}%%")) insideDirective = true;
				continue;
			}

			if (trimmed.startsWith("%%")) {
				continue;
			}

			////////////////////////////////////////////////////////////////////////////
			// Require the Mermaid sequence-diagram header before feature lines.
			if (!seenSequenceDiagram) {
				if (trimmed === "sequenceDiagram") {
					seenSequenceDiagram = true;
					continue;
				}

				throw new MermaidTransformError("Expected Mermaid 'sequenceDiagram' header", lineNumber, sourceLine);
			}

			////////////////////////////////////////////////////////////////////////////
			// Handle explicit participant and actor declarations in source order.
			if (this._isParticipantDeclaration(trimmed)) {
				const actor = this._parseParticipantDeclaration(trimmed, lineNumber, sourceLine);
				this._appendActor(document.actors, actor, lineNumber, sourceLine);
				continue;
			}

			////////////////////////////////////////////////////////////////////////////
			// Reject the remaining Mermaid syntax for now with explicit feature names
			// so each future slice can be added and tested incrementally.
			throw this._unsupportedSyntax(trimmed, lineNumber, sourceLine);
		}

		if (!seenSequenceDiagram) {
			throw new MermaidTransformError("Expected Mermaid 'sequenceDiagram' header");
		}

		return document;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Detect whether a source line is an explicit participant or actor declaration.
	 *
	 * @param {string} trimmed Trimmed Mermaid source line.
	 * @returns {boolean} True when the line declares an actor.
	 * @example
	 * const matched = MermaidSequenceTransformer._isParticipantDeclaration("participant API");
	 */
	static _isParticipantDeclaration(trimmed) {
		return /^(participant|actor)\s+/i.test(trimmed);
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Parse a Mermaid participant or actor declaration into a sequencer actor.
	 *
	 * @param {string} trimmed Trimmed Mermaid source line.
	 * @param {number} lineNumber 1-based source line number.
	 * @param {string} sourceLine Original Mermaid source line.
	 * @returns {{ name: string, alias: string, actorType: string }} Sequencer actor object.
	 * @throws {MermaidTransformError} If the declaration is malformed.
	 * @example
	 * const actor = MermaidSequenceTransformer._parseParticipantDeclaration("actor DB as Database", 2, "actor DB as Database");
	 */
	static _parseParticipantDeclaration(trimmed, lineNumber, sourceLine) {
		////////////////////////////////////////////////////////////////////////////
		// Mermaid declarations use the first token after the keyword as the stable
		// participant identifier, with an optional trailing display name after `as`.
		const match = trimmed.match(/^(participant|actor)\s+([A-Za-z0-9_][-A-Za-z0-9_]*)\s*(?:as\s+(.+))?$/i);
		if (!match) {
			throw new MermaidTransformError("Unsupported Mermaid participant declaration", lineNumber, sourceLine);
		}

		const actorType = match[1].toLowerCase();
		const alias = match[2];
		const name = this._cleanParticipantName(match[3] != null ? match[3] : alias);

		if (name.length === 0) {
			throw new MermaidTransformError("Mermaid participant display name cannot be empty", lineNumber, sourceLine);
		}

		return {
			name: name,
			alias: alias,
			actorType: actorType,
		};
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Normalise a Mermaid participant display name by trimming whitespace and
	 * removing matching outer quotes.
	 *
	 * @param {string} value Raw display-name value.
	 * @returns {string} Cleaned display name.
	 * @example
	 * const name = MermaidSequenceTransformer._cleanParticipantName("\"Caller Service\"");
	 */
	static _cleanParticipantName(value) {
		const trimmed = String(value).trim();
		if (
			(trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
			(trimmed.startsWith("'") && trimmed.endsWith("'")) ||
			(trimmed.startsWith("`") && trimmed.endsWith("`"))
		) {
			return trimmed.slice(1, -1).trim();
		}

		return trimmed;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Append a new actor to the transformed document, rejecting duplicate aliases.
	 *
	 * @param {object[]} actors Existing actor array.
	 * @param {{ name: string, alias: string, actorType: string }} actor New actor definition.
	 * @param {number} lineNumber 1-based source line number.
	 * @param {string} sourceLine Original Mermaid source line.
	 * @returns {void} Nothing.
	 * @throws {MermaidTransformError} If the alias was already declared.
	 * @example
	 * MermaidSequenceTransformer._appendActor([], { name: "API", alias: "API", actorType: "participant" }, 2, "participant API");
	 */
	static _appendActor(actors, actor, lineNumber, sourceLine) {
		////////////////////////////////////////////////////////////////////////////
		// Preserve declaration order exactly because Mermaid participant order is a
		// visible semantic in the resulting diagram.
		if (actors.some((existingActor) => existingActor.alias === actor.alias)) {
			throw new MermaidTransformError(`Mermaid participant alias '${actor.alias}' is declared more than once`, lineNumber, sourceLine);
		}

		actors.push(actor);
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Classify unsupported Mermaid syntax into feature-oriented errors.
	 *
	 * @param {string} trimmed Trimmed Mermaid source line.
	 * @param {number} lineNumber 1-based source line number.
	 * @param {string} sourceLine Original Mermaid source line.
	 * @returns {MermaidTransformError} Unsupported-feature error.
	 * @example
	 * throw MermaidSequenceTransformer._unsupportedSyntax("autonumber", 5, "autonumber");
	 */
	static _unsupportedSyntax(trimmed, lineNumber, sourceLine) {
		if (/^autonumber\b/i.test(trimmed)) {
			return new MermaidTransformError("Mermaid feature 'autonumber' is not supported yet", lineNumber, sourceLine);
		}

		if (/^(note|links?|link)\b/i.test(trimmed)) {
			return new MermaidTransformError("Mermaid notes and links are not supported yet", lineNumber, sourceLine);
		}

		if (/^(alt|opt|loop|par|critical|break|rect|box|activate|deactivate|create|destroy|end)\b/i.test(trimmed)) {
			return new MermaidTransformError(`Mermaid feature '${trimmed.split(/\s+/)[0]}' is not supported yet`, lineNumber, sourceLine);
		}

		if (/[<-]+[->x+o)]/.test(trimmed) || /\b-->>?\b/.test(trimmed)) {
			return new MermaidTransformError("Mermaid message lines are not supported yet", lineNumber, sourceLine);
		}

		return new MermaidTransformError("Unsupported Mermaid sequence syntax", lineNumber, sourceLine);
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Derive the preferred output stem from an optional source name.
	 *
	 * @param {string|undefined} sourceName Optional source file path or name.
	 * @returns {string} Output stem.
	 * @example
	 * const stem = MermaidSequenceTransformer._deriveStem("/tmp/input.mmd");
	 */
	static _deriveStem(sourceName) {
		if (typeof sourceName !== "string" || sourceName.trim().length === 0) {
			return "mermaid-sequence-diagram";
		}

		return path.basename(sourceName, path.extname(sourceName));
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Convert a file stem into a readable title string.
	 *
	 * @param {string} stem File stem.
	 * @returns {string} Human-readable title.
	 * @example
	 * const title = MermaidSequenceTransformer._humaniseStem("participants-and-aliases");
	 */
	static _humaniseStem(stem) {
		return stem
			.split(/[-_\s]+/)
			.filter((part) => part.length > 0)
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(" ");
	}
}

module.exports = {
	MermaidSequenceTransformer: MermaidSequenceTransformer,
	MermaidTransformError: MermaidTransformError,
};
