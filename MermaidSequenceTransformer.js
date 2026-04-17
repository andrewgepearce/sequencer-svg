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
 * Slice 3 supports explicit `participant` and `actor` declarations, basic
 * message lines, standard unidirectional arrow variants, and Mermaid notes
 * mapped onto sequencer comments hosted by synthetic blank lines.
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
			// Ignore blank lines, Mermaid comments, and directive bodies so the
			// transform can focus on sequencer-relevant source lines only.
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
				this._registerActor(document.actors, actor);
				continue;
			}

			////////////////////////////////////////////////////////////////////////////
			// Handle Mermaid message lines by mapping them onto sequencer call lines
			// with per-line arrow and dash configuration.
			if (this._looksLikeMessageLine(trimmed)) {
				const transformedLine = this._parseMessageLine(trimmed, document.actors, lineNumber, sourceLine);
				document.lines.push(transformedLine);
				continue;
			}

			////////////////////////////////////////////////////////////////////////////
			// Handle Mermaid notes by preserving their visible content as sequencer
			// comments hosted by blank lines. Single-target notes stay anchored to
			// one actor; span notes can anchor between two actors.
			if (this._isNoteLine(trimmed)) {
				const transformedLine = this._parseNoteLine(trimmed, document.actors, lineNumber, sourceLine);
				document.lines.push(transformedLine);
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
	 * Register or update an actor in the transformed document.
	 *
	 * @param {object[]} actors Existing actor array.
	 * @param {{ name: string, alias: string, actorType: string }} actor New actor definition.
	 * @returns {void} Nothing.
	 * @example
	 * MermaidSequenceTransformer._registerActor([], { name: "API", alias: "API", actorType: "participant" });
	 */
	static _registerActor(actors, actor) {
		////////////////////////////////////////////////////////////////////////////
		// Preserve the first observed order for a participant while still allowing
		// later explicit declarations to enrich an implicitly created actor.
		const existingActor = actors.find((candidate) => candidate.alias === actor.alias);
		if (existingActor) {
			existingActor.name = actor.name;
			existingActor.actorType = actor.actorType;
			return;
		}

		actors.push(actor);
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Detect whether a trimmed Mermaid line looks like a message statement.
	 *
	 * @param {string} trimmed Trimmed Mermaid source line.
	 * @returns {boolean} True when the line resembles a Mermaid message.
	 * @example
	 * const matched = MermaidSequenceTransformer._looksLikeMessageLine("A->>B: Ping");
	 */
	static _looksLikeMessageLine(trimmed) {
		return /^[A-Za-z0-9_][-A-Za-z0-9_]*\s*[<\\/\-|x).]+/.test(trimmed);
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Parse a Mermaid message line into a sequencer call line.
	 *
	 * @param {string} trimmed Trimmed Mermaid source line.
	 * @param {object[]} actors Current actor array.
	 * @param {number} lineNumber 1-based source line number.
	 * @param {string} sourceLine Original Mermaid source line.
	 * @returns {{ type: string, from: string, to: string, text: string, lineDash?: number[], arrow?: string, async?: boolean }} Sequencer line.
	 * @throws {MermaidTransformError} If the message line is malformed or unsupported.
	 * @example
	 * const line = MermaidSequenceTransformer._parseMessageLine("A->>B: Ping", [], 4, "A->>B: Ping");
	 */
	static _parseMessageLine(trimmed, actors, lineNumber, sourceLine) {
		const supportedArrowTokens = ["-->>", "->>", "--)", "-)", "--x", "-x", "-->", "->"];
		const unsupportedArrowTokens = ["<<-->>", "<<->>", "--|\\", "-|\\", "--|/", "-|/", "/|--", "/|-", "\\\\--", "\\\\-", "--\\\\", "-\\\\", "--//", "-//", "//--", "//-", "()"];
		const arrowTokens = unsupportedArrowTokens.concat(supportedArrowTokens).sort((left, right) => right.length - left.length);
		let matchedArrowToken = null;
		let matchedArrowIndex = -1;

		for (const arrowToken of arrowTokens) {
			const arrowIndex = trimmed.indexOf(arrowToken);
			if (arrowIndex !== -1) {
				matchedArrowToken = arrowToken;
				matchedArrowIndex = arrowIndex;
				break;
			}
		}

		if (matchedArrowToken == null) {
			throw new MermaidTransformError("Unsupported Mermaid message syntax", lineNumber, sourceLine);
		}

		const leftSide = trimmed.slice(0, matchedArrowIndex).trim();
		const rightSide = trimmed.slice(matchedArrowIndex + matchedArrowToken.length).trim();
		const colonIndex = rightSide.indexOf(":");
		const toAlias = (colonIndex === -1 ? rightSide : rightSide.slice(0, colonIndex)).trim();
		const messageText = colonIndex === -1 ? "" : rightSide.slice(colonIndex + 1).trim();
		const fromAlias = leftSide;
		const arrowToken = matchedArrowToken;

		if (!/^[A-Za-z0-9_][-A-Za-z0-9_]*$/.test(fromAlias) || !/^[A-Za-z0-9_][-A-Za-z0-9_]*$/.test(toAlias)) {
			throw new MermaidTransformError("Unsupported Mermaid message actor syntax", lineNumber, sourceLine);
		}

		if (unsupportedArrowTokens.some((token) => arrowToken.includes(token))) {
			throw new MermaidTransformError(`Mermaid arrow '${arrowToken}' is not supported yet`, lineNumber, sourceLine);
		}

		if (!supportedArrowTokens.includes(arrowToken)) {
			throw new MermaidTransformError(`Mermaid arrow '${arrowToken}' is not supported in slice 2`, lineNumber, sourceLine);
		}

		this._ensureImplicitActor(actors, fromAlias);
		this._ensureImplicitActor(actors, toAlias);

		const line = {
			type: "call",
			from: fromAlias,
			to: toAlias,
			text: this._parseTextPayload(messageText),
		};

		if (arrowToken.startsWith("--")) {
			line.lineDash = [4, 2];
		}

		if (arrowToken.endsWith(")")) {
			line.arrow = "open";
			line.async = true;
		} else if (arrowToken.endsWith("x")) {
			line.arrow = "cross";
		} else if (arrowToken.endsWith(">>")) {
			line.arrow = "fill";
		} else if (arrowToken === "->" || arrowToken === "-->") {
			line.arrow = "none";
		}

		return line;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Detect whether a trimmed Mermaid line is a note statement.
	 *
	 * @param {string} trimmed Trimmed Mermaid source line.
	 * @returns {boolean} True when the line is a Mermaid note.
	 * @example
	 * const matched = MermaidSequenceTransformer._isNoteLine("Note right of API: Cache miss");
	 */
	static _isNoteLine(trimmed) {
		return /^note\s+(?:right of|left of|over)\s+/i.test(trimmed);
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Parse a Mermaid note statement into a sequencer blank line with a comment.
	 *
	 * @param {string} trimmed Trimmed Mermaid source line.
	 * @param {object[]} actors Current actor array.
	 * @param {number} lineNumber 1-based source line number.
	 * @param {string} sourceLine Original Mermaid source line.
	 * @returns {{ type: string, height: number, actor?: string, actors?: string[], comment: string|string[] }} Sequencer line.
	 * @throws {MermaidTransformError} If the note syntax is malformed.
	 * @example
	 * const line = MermaidSequenceTransformer._parseNoteLine("Note over A,B: Shared context", [], 6, "Note over A,B: Shared context");
	 */
	static _parseNoteLine(trimmed, actors, lineNumber, sourceLine) {
		const match = trimmed.match(/^note\s+(right of|left of|over)\s+([^:]+)\s*:\s*(.+)$/i);
		if (!match) {
			throw new MermaidTransformError("Unsupported Mermaid note syntax", lineNumber, sourceLine);
		}

		const position = match[1].toLowerCase();
		const targetAliases = match[2]
			.split(",")
			.map((alias) => alias.trim())
			.filter((alias) => alias.length > 0);
		const comment = this._parseTextPayload(match[3]);

		if (targetAliases.length === 0 || targetAliases.length > 2) {
			throw new MermaidTransformError("Mermaid note target syntax is not supported", lineNumber, sourceLine);
		}

		for (const alias of targetAliases) {
			if (!/^[A-Za-z0-9_][-A-Za-z0-9_]*$/.test(alias)) {
				throw new MermaidTransformError("Unsupported Mermaid note actor syntax", lineNumber, sourceLine);
			}

			this._ensureImplicitActor(actors, alias);
		}

		if (position !== "over" && targetAliases.length !== 1) {
			throw new MermaidTransformError("Mermaid left/right notes support exactly one actor", lineNumber, sourceLine);
		}

		const line = {
			type: "blank",
			height: 0,
			comment: comment,
		};

		if (targetAliases.length === 1) {
			line.actor = targetAliases[0];
		} else {
			line.actors = targetAliases;
		}

		return line;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Ensure that an actor exists for a Mermaid alias, creating an implicit
	 * participant when the alias has not been declared explicitly yet.
	 *
	 * @param {object[]} actors Current actor array.
	 * @param {string} alias Mermaid participant alias.
	 * @returns {void} Nothing.
	 * @example
	 * MermaidSequenceTransformer._ensureImplicitActor([], "API");
	 */
	static _ensureImplicitActor(actors, alias) {
		if (actors.some((candidate) => candidate.alias === alias)) {
			return;
		}

		actors.push({
			name: alias,
			alias: alias,
			actorType: "participant",
		});
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Convert Mermaid inline line breaks into sequencer text arrays when needed.
	 *
	 * @param {string} value Raw Mermaid text payload.
	 * @returns {string|string[]} Sequencer text or comment payload.
	 * @example
	 * const payload = MermaidSequenceTransformer._parseTextPayload("Line 1<br/>Line 2");
	 */
	static _parseTextPayload(value) {
		const parts = String(value)
			.trim()
			.split(/<br\s*\/?>/i)
			.map((part) => part.trim());

		return parts.length === 1 ? parts[0] : parts;
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

		if (/^(links?|link)\b/i.test(trimmed)) {
			return new MermaidTransformError("Mermaid links are not supported yet", lineNumber, sourceLine);
		}

		if (/^(alt|opt|loop|par|critical|break|rect|box|activate|deactivate|create|destroy|end)\b/i.test(trimmed)) {
			return new MermaidTransformError(`Mermaid feature '${trimmed.split(/\s+/)[0]}' is not supported yet`, lineNumber, sourceLine);
		}

		if (/[<>-][<>x)|/\\-]+/.test(trimmed)) {
			return new MermaidTransformError("Unsupported Mermaid message syntax", lineNumber, sourceLine);
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
