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
 * Slice 10 supports explicit `participant` and `actor` declarations, Mermaid
 * accessibility metadata, basic message lines, standard unidirectional arrow
 * variants, Mermaid notes mapped onto sequencer comments hosted by synthetic
 * blank lines, Mermaid activation/deactivation control, and Mermaid `loop`,
 * `alt`, `opt`, `par`, `and`, `else`, and `end` fragments mapped onto
 * sequencer fragments, plus Mermaid `autonumber` mapped onto a sequencer
 * document flag, real sequencer return lines for dotted Mermaid messages,
 * bidirectional arrows, and Mermaid half-arrow variants mapped onto
 * sequencer `fromArrow` and `toArrow` endpoint styles.
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
	 * @returns {{ title: string, description?: string|string[], autonumber?: boolean, version: string, actors: object[], lines: object[] }} Transformed sequencer document.
	 * @throws {MermaidTransformError} If the Mermaid source uses unsupported syntax for this slice.
	 * @example
	 * const document = MermaidSequenceTransformer.transform("sequenceDiagram\nparticipant A", {});
	 */
	static transform(source, options = {}) {
		////////////////////////////////////////////////////////////////////////////
		// Prepare the destination document and parse the Mermaid source into a
		// structured statement list so nested block features can be transformed
		// incrementally without inventing a second intermediate model.
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
		const activationState = Object.create(null);

		const statements = this._collectStatements(source, document);
		const parsedDocument = this._parseStructuredLines(statements, 0, document.actors, activationState, null);
		document.lines = parsedDocument.lines;
		if (parsedDocument.nextIndex !== statements.length) {
			const unexpectedStatement = statements[parsedDocument.nextIndex];
			throw new MermaidTransformError(
				`Unexpected Mermaid '${this._getControlKeyword(unexpectedStatement.trimmed)}' outside a fragment`,
				unexpectedStatement.lineNumber,
				unexpectedStatement.sourceLine
			);
		}

		return document;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Collect meaningful Mermaid statements after handling document-level metadata.
	 *
	 * @param {string} source Mermaid source text.
	 * @param {{ title: string, description?: string|string[] }} document Destination document metadata container.
	 * @returns {{ trimmed: string, sourceLine: string, lineNumber: number }[]} Structured Mermaid statements.
	 * @throws {MermaidTransformError} If the document header or metadata syntax is invalid.
	 * @example
	 * const statements = MermaidSequenceTransformer._collectStatements("sequenceDiagram\nparticipant A", document);
	 */
	static _collectStatements(source, document) {
		const statements = [];
		const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/);
		let seenSequenceDiagram = false;
		let insideDirective = false;
		let insideAccDescr = false;
		let accDescrLines = [];

		for (let index = 0; index < lines.length; index++) {
			const sourceLine = lines[index];
			const lineNumber = index + 1;
			const trimmed = sourceLine.trim();

			if (trimmed.length === 0) {
				continue;
			}

			if (insideDirective) {
				if (trimmed.endsWith("}%%")) {
					insideDirective = false;
				}
				continue;
			}

			if (trimmed.startsWith("%%{")) {
				if (!trimmed.endsWith("}%%")) {
					insideDirective = true;
				}
				continue;
			}

			if (trimmed.startsWith("%%")) {
				continue;
			}

			if (insideAccDescr) {
				if (trimmed === "}") {
					document.description = this._normaliseAccDescription(accDescrLines);
					if (
						(typeof document.description === "string" && document.description.length === 0) ||
						(Array.isArray(document.description) && document.description.length === 0)
					) {
						throw new MermaidTransformError("Mermaid accDescr cannot be empty", lineNumber, sourceLine);
					}
					insideAccDescr = false;
					accDescrLines = [];
					continue;
				}

				accDescrLines.push(sourceLine.trim());
				continue;
			}

			if (!seenSequenceDiagram) {
				if (trimmed === "sequenceDiagram") {
					seenSequenceDiagram = true;
					continue;
				}

				throw new MermaidTransformError("Expected Mermaid 'sequenceDiagram' header", lineNumber, sourceLine);
			}

			if (this._isAccessibilityTitleLine(trimmed)) {
				document.title = this._parseAccessibilityTitle(trimmed, lineNumber, sourceLine);
				continue;
			}

			if (this._isAccessibilityDescriptionLine(trimmed)) {
				document.description = this._parseAccessibilityDescription(trimmed, lineNumber, sourceLine);
				continue;
			}

			if (this._startsAccessibilityDescriptionBlock(trimmed)) {
				insideAccDescr = true;
				accDescrLines = [];
				continue;
			}

			if (this._isAutonumberLine(trimmed)) {
				document.autonumber = true;
				continue;
			}

			statements.push({
				trimmed: trimmed,
				sourceLine: sourceLine,
				lineNumber: lineNumber,
			});
		}

		if (!seenSequenceDiagram) {
			throw new MermaidTransformError("Expected Mermaid 'sequenceDiagram' header");
		}

		if (insideAccDescr) {
			throw new MermaidTransformError("Unterminated Mermaid accDescr block");
		}

		return statements;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Parse a sequence of Mermaid statements, optionally stopping at fragment delimiters.
	 *
	 * @param {{ trimmed: string, sourceLine: string, lineNumber: number }[]} statements Structured Mermaid statements.
	 * @param {number} startIndex Statement index to start from.
	 * @param {object[]} actors Current actor array.
	 * @param {object} activationState Current Mermaid activation counters by alias.
	 * @param {string[]|null} stopKeywords Optional control keywords that stop this parse scope.
	 * @returns {{ lines: object[], nextIndex: number }} Parsed sequencer lines and next statement index.
	 * @example
	 * const result = MermaidSequenceTransformer._parseStructuredLines(statements, 0, actors, activationState, ["end"]);
	 */
	static _parseStructuredLines(statements, startIndex, actors, activationState, stopKeywords) {
		const lines = [];
		let index = startIndex;

		while (index < statements.length) {
			const statement = statements[index];
			const controlKeyword = this._getControlKeyword(statement.trimmed);

			if (controlKeyword != null) {
				if (Array.isArray(stopKeywords) && stopKeywords.includes(controlKeyword)) {
					break;
				}

				if (controlKeyword === "loop" || controlKeyword === "alt" || controlKeyword === "opt" || controlKeyword === "par") {
					const parsedFragment =
						controlKeyword === "alt"
							? this._parseAltFragment(statements, index, actors, activationState)
							: controlKeyword === "par"
							? this._parseParFragment(statements, index, actors, activationState)
							: this._parseSimpleFragment(statements, index, actors, activationState, controlKeyword);
					lines.push(parsedFragment.line);
					index = parsedFragment.nextIndex;
					continue;
				}

				throw new MermaidTransformError(
					`Unexpected Mermaid '${controlKeyword}' outside a fragment`,
					statement.lineNumber,
					statement.sourceLine
				);
			}

			if (this._isParticipantDeclaration(statement.trimmed)) {
				this._registerActor(actors, this._parseParticipantDeclaration(statement.trimmed, statement.lineNumber, statement.sourceLine));
				index++;
				continue;
			}

			if (this._isActivationDirective(statement.trimmed)) {
				lines.push(
					this._parseActivationDirective(statement.trimmed, actors, activationState, statement.lineNumber, statement.sourceLine)
				);
				index++;
				continue;
			}

			if (this._looksLikeMessageLine(statement.trimmed)) {
				lines.push(this._parseMessageLine(statement.trimmed, actors, activationState, statement.lineNumber, statement.sourceLine));
				index++;
				continue;
			}

			if (this._isNoteLine(statement.trimmed)) {
				lines.push(this._parseNoteLine(statement.trimmed, actors, statement.lineNumber, statement.sourceLine));
				index++;
				continue;
			}

			throw this._unsupportedSyntax(statement.trimmed, statement.lineNumber, statement.sourceLine);
		}

		return {
			lines: lines,
			nextIndex: index,
		};
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Parse a Mermaid `loop` or `opt` fragment into a sequencer fragment line.
	 *
	 * @param {{ trimmed: string, sourceLine: string, lineNumber: number }[]} statements Structured Mermaid statements.
	 * @param {number} startIndex Statement index of the fragment start line.
	 * @param {object[]} actors Current actor array.
	 * @param {object} activationState Current Mermaid activation counters by alias.
	 * @param {"loop"|"opt"} fragmentType Mermaid fragment type.
	 * @returns {{ line: object, nextIndex: number }} Parsed fragment line and next index.
	 * @throws {MermaidTransformError} If the fragment is malformed or unterminated.
	 * @example
	 * const parsed = MermaidSequenceTransformer._parseSimpleFragment(statements, 2, actors, activationState, "loop");
	 */
	static _parseSimpleFragment(statements, startIndex, actors, activationState, fragmentType) {
		const startStatement = statements[startIndex];
		const condition = this._parseFragmentLabel(startStatement.trimmed, fragmentType, startStatement.lineNumber, startStatement.sourceLine);
		const parsedBody = this._parseStructuredLines(statements, startIndex + 1, actors, activationState, ["end"]);
		const endStatement = statements[parsedBody.nextIndex];

		if (!endStatement || this._getControlKeyword(endStatement.trimmed) !== "end") {
			throw new MermaidTransformError(
				`Mermaid feature '${fragmentType}' is missing a matching 'end'`,
				startStatement.lineNumber,
				startStatement.sourceLine
			);
		}

		return {
			line: {
				type: "fragment",
				fragmentType: fragmentType,
				title: "",
				condition: condition,
				lines: parsedBody.lines,
			},
			nextIndex: parsedBody.nextIndex + 1,
		};
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Parse a Mermaid `alt` fragment, including nested `else` branches.
	 *
	 * @param {{ trimmed: string, sourceLine: string, lineNumber: number }[]} statements Structured Mermaid statements.
	 * @param {number} startIndex Statement index of the `alt` line.
	 * @param {object[]} actors Current actor array.
	 * @param {object} activationState Current Mermaid activation counters by alias.
	 * @returns {{ line: object, nextIndex: number }} Parsed fragment line and next index.
	 * @throws {MermaidTransformError} If the fragment is malformed or unterminated.
	 * @example
	 * const parsed = MermaidSequenceTransformer._parseAltFragment(statements, 4, actors, activationState);
	 */
	static _parseAltFragment(statements, startIndex, actors, activationState) {
		const startStatement = statements[startIndex];
		const initialCondition = this._parseFragmentLabel(startStatement.trimmed, "alt", startStatement.lineNumber, startStatement.sourceLine);
		const fragment = {
			type: "fragment",
			fragmentType: "alt",
			title: "",
			condition: initialCondition,
			lines: [],
		};
		const firstBranch = this._parseStructuredLines(statements, startIndex + 1, actors, activationState, ["else", "end"]);
		fragment.lines.push(...firstBranch.lines);

		let index = firstBranch.nextIndex;
		while (index < statements.length && this._getControlKeyword(statements[index].trimmed) === "else") {
			const elseStatement = statements[index];
			fragment.lines.push({
				type: "condition",
				condition: this._parseElseLabel(elseStatement.trimmed),
			});

			const nextBranch = this._parseStructuredLines(statements, index + 1, actors, activationState, ["else", "end"]);
			fragment.lines.push(...nextBranch.lines);
			index = nextBranch.nextIndex;
		}

		const endStatement = statements[index];
		if (!endStatement || this._getControlKeyword(endStatement.trimmed) !== "end") {
			throw new MermaidTransformError("Mermaid feature 'alt' is missing a matching 'end'", startStatement.lineNumber, startStatement.sourceLine);
		}

		return {
			line: fragment,
			nextIndex: index + 1,
		};
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Parse a Mermaid `par` fragment, including sibling `and` branches.
	 *
	 * @param {{ trimmed: string, sourceLine: string, lineNumber: number }[]} statements Structured Mermaid statements.
	 * @param {number} startIndex Statement index of the `par` line.
	 * @param {object[]} actors Current actor array.
	 * @param {object} activationState Current Mermaid activation counters by alias.
	 * @returns {{ line: object, nextIndex: number }} Parsed fragment line and next index.
	 * @throws {MermaidTransformError} If the fragment is malformed or unterminated.
	 * @example
	 * const parsed = MermaidSequenceTransformer._parseParFragment(statements, 4, actors, activationState);
	 */
	static _parseParFragment(statements, startIndex, actors, activationState) {
		const startStatement = statements[startIndex];
		const initialCondition = this._parseFragmentLabel(startStatement.trimmed, "par", startStatement.lineNumber, startStatement.sourceLine);
		const fragment = {
			type: "fragment",
			fragmentType: "par",
			title: "",
			condition: initialCondition,
			lines: [],
		};
		const firstBranch = this._parseStructuredLines(statements, startIndex + 1, actors, activationState, ["and", "end"]);
		fragment.lines.push(...firstBranch.lines);

		let index = firstBranch.nextIndex;
		while (index < statements.length && this._getControlKeyword(statements[index].trimmed) === "and") {
			const andStatement = statements[index];
			fragment.lines.push({
				type: "condition",
				condition: this._parseAndLabel(andStatement.trimmed),
			});

			const nextBranch = this._parseStructuredLines(statements, index + 1, actors, activationState, ["and", "end"]);
			fragment.lines.push(...nextBranch.lines);
			index = nextBranch.nextIndex;
		}

		const endStatement = statements[index];
		if (!endStatement || this._getControlKeyword(endStatement.trimmed) !== "end") {
			throw new MermaidTransformError("Mermaid feature 'par' is missing a matching 'end'", startStatement.lineNumber, startStatement.sourceLine);
		}

		return {
			line: fragment,
			nextIndex: index + 1,
		};
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Detect whether a trimmed Mermaid line sets the diagram accessibility title.
	 *
	 * @param {string} trimmed Trimmed Mermaid source line.
	 * @returns {boolean} True when the line is an `accTitle:` declaration.
	 * @example
	 * const matched = MermaidSequenceTransformer._isAccessibilityTitleLine("accTitle: API flow");
	 */
	static _isAccessibilityTitleLine(trimmed) {
		return /^accTitle\s*:/i.test(trimmed);
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Detect whether a trimmed Mermaid line sets a single-line accessibility description.
	 *
	 * @param {string} trimmed Trimmed Mermaid source line.
	 * @returns {boolean} True when the line is an `accDescr:` declaration.
	 * @example
	 * const matched = MermaidSequenceTransformer._isAccessibilityDescriptionLine("accDescr: Request flow");
	 */
	static _isAccessibilityDescriptionLine(trimmed) {
		return /^accDescr\s*:/i.test(trimmed);
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Detect whether a trimmed Mermaid line starts a multiline accessibility description block.
	 *
	 * @param {string} trimmed Trimmed Mermaid source line.
	 * @returns {boolean} True when the line starts `accDescr {`.
	 * @example
	 * const matched = MermaidSequenceTransformer._startsAccessibilityDescriptionBlock("accDescr {");
	 */
	static _startsAccessibilityDescriptionBlock(trimmed) {
		return /^accDescr\s*\{$/i.test(trimmed);
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Detect whether a trimmed Mermaid line enables sequence numbering.
	 *
	 * @param {string} trimmed Trimmed Mermaid source line.
	 * @returns {boolean} True when the line is Mermaid `autonumber`.
	 * @example
	 * const matched = MermaidSequenceTransformer._isAutonumberLine("autonumber");
	 */
	static _isAutonumberLine(trimmed) {
		return /^autonumber$/i.test(trimmed);
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Parse a Mermaid accessibility title line into a visible sequencer title.
	 *
	 * @param {string} trimmed Trimmed Mermaid source line.
	 * @param {number} lineNumber 1-based source line number.
	 * @param {string} sourceLine Original Mermaid source line.
	 * @returns {string} Normalised title text.
	 * @throws {MermaidTransformError} If the title is empty.
	 * @example
	 * const title = MermaidSequenceTransformer._parseAccessibilityTitle("accTitle: API flow", 2, "accTitle: API flow");
	 */
	static _parseAccessibilityTitle(trimmed, lineNumber, sourceLine) {
		const title = this._cleanMetadataValue(trimmed.replace(/^accTitle\s*:/i, ""));
		if (title.length === 0) {
			throw new MermaidTransformError("Mermaid accTitle cannot be empty", lineNumber, sourceLine);
		}

		return title;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Parse a single-line Mermaid accessibility description.
	 *
	 * @param {string} trimmed Trimmed Mermaid source line.
	 * @param {number} lineNumber 1-based source line number.
	 * @param {string} sourceLine Original Mermaid source line.
	 * @returns {string|string[]} Normalised description payload.
	 * @throws {MermaidTransformError} If the description is empty.
	 * @example
	 * const description = MermaidSequenceTransformer._parseAccessibilityDescription("accDescr: First<br/>Second", 3, "accDescr: First<br/>Second");
	 */
	static _parseAccessibilityDescription(trimmed, lineNumber, sourceLine) {
		const description = this._parseMetadataPayload(trimmed.replace(/^accDescr\s*:/i, ""));
		if ((typeof description === "string" && description.length === 0) || (Array.isArray(description) && description.length === 0)) {
			throw new MermaidTransformError("Mermaid accDescr cannot be empty", lineNumber, sourceLine);
		}

		return description;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Normalise a collected multiline Mermaid accessibility description block.
	 *
	 * @param {string[]} lines Raw block lines.
	 * @returns {string|string[]} Description text payload.
	 * @example
	 * const description = MermaidSequenceTransformer._normaliseAccDescription(["Line 1", "Line 2"]);
	 */
	static _normaliseAccDescription(lines) {
		const normalisedLines = lines.map((line) => line.trim());
		if (normalisedLines.length === 0) {
			return "";
		}

		if (normalisedLines.length === 1) {
			return normalisedLines[0];
		}

		return normalisedLines;
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
	 * @param {object} activationState Current Mermaid activation counters by alias.
	 * @param {number} lineNumber 1-based source line number.
	 * @param {string} sourceLine Original Mermaid source line.
	 * @returns {{ type: string, from: string, to: string, text: string, lineDash?: number[], arrow?: string, fromArrow?: string, toArrow?: string, async?: boolean, breakFromFlow?: boolean, breakToFlow?: boolean, continueFromFlow?: boolean }} Sequencer line.
	 * @throws {MermaidTransformError} If the message line is malformed or unsupported.
	 * @example
	 * const line = MermaidSequenceTransformer._parseMessageLine("A->>B: Ping", [], {}, 4, "A->>B: Ping");
	 */
	static _parseMessageLine(trimmed, actors, activationState, lineNumber, sourceLine) {
		const arrowDefinitions = this._getSupportedArrowDefinitions();
		const arrowTokens = arrowDefinitions.map((definition) => definition.token).sort((left, right) => right.length - left.length);
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

		const arrowDefinition = arrowDefinitions.find((definition) => definition.token === matchedArrowToken);

		const leftSide = trimmed.slice(0, matchedArrowIndex).trim();
		const rightSide = trimmed.slice(matchedArrowIndex + matchedArrowToken.length).trim();
		const colonIndex = rightSide.indexOf(":");
		const toToken = (colonIndex === -1 ? rightSide : rightSide.slice(0, colonIndex)).trim();
		const messageText = colonIndex === -1 ? "" : rightSide.slice(colonIndex + 1).trim();
		const fromAlias = leftSide;
		const arrowToken = matchedArrowToken;
		const activationShortcut = this._parseActivationShortcut(toToken);
		const toAlias = activationShortcut.alias;

		if (!/^[A-Za-z0-9_][-A-Za-z0-9_]*$/.test(fromAlias) || !/^[A-Za-z0-9_][-A-Za-z0-9_]*$/.test(toAlias)) {
			throw new MermaidTransformError("Unsupported Mermaid message actor syntax", lineNumber, sourceLine);
		}

		if (!arrowDefinition) {
			throw new MermaidTransformError(`Mermaid arrow '${arrowToken}' is not supported in slice 9`, lineNumber, sourceLine);
		}

		this._ensureImplicitActor(actors, fromAlias);
		this._ensureImplicitActor(actors, toAlias);

		const isReturnMessage = arrowDefinition.lineType === "return";
		const line = isReturnMessage
			? {
					type: "return",
					from: fromAlias,
					to: toAlias,
					text: this._parseTextPayload(messageText),
			  }
			: {
					type: "call",
					from: fromAlias,
					to: toAlias,
					text: this._parseTextPayload(messageText),
			  };
		const postSourceActivationCount = this._getActivationCount(activationState, fromAlias);
		const postTargetActivationCount = this._applyActivationShortcut(activationState, toAlias, activationShortcut.operation);

		if (isReturnMessage) {
			if (postSourceActivationCount > 0) {
				line.continueFromFlow = true;
			}
			if (postTargetActivationCount === 0) {
				line.breakToFlow = true;
			}
		} else {
			if (postSourceActivationCount === 0) {
				line.breakFromFlow = true;
			}
			if (postTargetActivationCount === 0) {
				line.breakToFlow = true;
			}
		}

		if (isReturnMessage) {
			line.lineDash = [4, 2];
		}

		if (arrowDefinition.fromArrow !== "none") {
			line.fromArrow = arrowDefinition.fromArrow;
		}
		if (arrowDefinition.toArrow !== "none") {
			line.toArrow = arrowDefinition.toArrow;
			line.arrow = arrowDefinition.toArrow;
		} else if (arrowDefinition.lineType === "return" || arrowToken === "->" || arrowToken === "-->") {
			line.arrow = "none";
		}
		if (arrowDefinition.async === true && !isReturnMessage) {
			line.async = true;
		}

		return line;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Return the Mermaid message-arrow definitions supported in this slice.
	 *
	 * @returns {{ token: string, lineType: "call"|"return", fromArrow: string, toArrow: string, async?: boolean }[]} Supported Mermaid arrow definitions.
	 * @example
	 * const arrows = MermaidSequenceTransformer._getSupportedArrowDefinitions();
	 */
	static _getSupportedArrowDefinitions() {
		return [
			{ token: "<<-->>", lineType: "return", fromArrow: "fill", toArrow: "fill" },
			{ token: "<<->>", lineType: "call", fromArrow: "fill", toArrow: "fill" },
			{ token: "-->>", lineType: "return", fromArrow: "none", toArrow: "fill" },
			{ token: "->>", lineType: "call", fromArrow: "none", toArrow: "fill" },
			{ token: "--)", lineType: "return", fromArrow: "none", toArrow: "open" },
			{ token: "-)", lineType: "call", fromArrow: "none", toArrow: "open", async: true },
			{ token: "--x", lineType: "return", fromArrow: "none", toArrow: "cross" },
			{ token: "-x", lineType: "call", fromArrow: "none", toArrow: "cross" },
			{ token: "--|\\", lineType: "return", fromArrow: "none", toArrow: "halfTop" },
			{ token: "-|\\", lineType: "call", fromArrow: "none", toArrow: "halfTop" },
			{ token: "--|/", lineType: "return", fromArrow: "none", toArrow: "halfBottom" },
			{ token: "-|/", lineType: "call", fromArrow: "none", toArrow: "halfBottom" },
			{ token: "/|--", lineType: "return", fromArrow: "halfTop", toArrow: "none" },
			{ token: "/|-", lineType: "call", fromArrow: "halfTop", toArrow: "none" },
			{ token: "\\|--", lineType: "return", fromArrow: "halfBottom", toArrow: "none" },
			{ token: "\\|-", lineType: "call", fromArrow: "halfBottom", toArrow: "none" },
			{ token: "--\\", lineType: "return", fromArrow: "none", toArrow: "stickTop" },
			{ token: "-\\", lineType: "call", fromArrow: "none", toArrow: "stickTop" },
			{ token: "--\\\\", lineType: "return", fromArrow: "none", toArrow: "stickTop" },
			{ token: "-\\\\", lineType: "call", fromArrow: "none", toArrow: "stickTop" },
			{ token: "--//", lineType: "return", fromArrow: "none", toArrow: "stickBottom" },
			{ token: "-//", lineType: "call", fromArrow: "none", toArrow: "stickBottom" },
			{ token: "//--", lineType: "return", fromArrow: "stickTop", toArrow: "none" },
			{ token: "//-", lineType: "call", fromArrow: "stickTop", toArrow: "none" },
			{ token: "\\--", lineType: "return", fromArrow: "stickBottom", toArrow: "none" },
			{ token: "\\-", lineType: "call", fromArrow: "stickBottom", toArrow: "none" },
			{ token: "\\\\--", lineType: "return", fromArrow: "stickBottom", toArrow: "none" },
			{ token: "\\\\-", lineType: "call", fromArrow: "stickBottom", toArrow: "none" },
			{ token: "-->", lineType: "return", fromArrow: "none", toArrow: "none" },
			{ token: "->", lineType: "call", fromArrow: "none", toArrow: "none" },
		];
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Detect whether a trimmed Mermaid line is an explicit activation directive.
	 *
	 * @param {string} trimmed Trimmed Mermaid source line.
	 * @returns {boolean} True when the line is an activate/deactivate directive.
	 * @example
	 * const matched = MermaidSequenceTransformer._isActivationDirective("activate API");
	 */
	static _isActivationDirective(trimmed) {
		return /^(activate|deactivate)\s+/i.test(trimmed);
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Parse a Mermaid activation directive into a synthetic blank line.
	 *
	 * @param {string} trimmed Trimmed Mermaid source line.
	 * @param {object[]} actors Current actor array.
	 * @param {object} activationState Current Mermaid activation counters by alias.
	 * @param {number} lineNumber 1-based source line number.
	 * @param {string} sourceLine Original Mermaid source line.
	 * @returns {{ type: string, height: number, activate?: string[], deactivate?: string[] }} Sequencer line.
	 * @throws {MermaidTransformError} If the directive is malformed.
	 * @example
	 * const line = MermaidSequenceTransformer._parseActivationDirective("activate DB", [], {}, 7, "activate DB");
	 */
	static _parseActivationDirective(trimmed, actors, activationState, lineNumber, sourceLine) {
		const match = trimmed.match(/^(activate|deactivate)\s+([A-Za-z0-9_][-A-Za-z0-9_]*)$/i);
		if (!match) {
			throw new MermaidTransformError("Unsupported Mermaid activation syntax", lineNumber, sourceLine);
		}

		const operation = match[1].toLowerCase();
		const alias = match[2];
		this._ensureImplicitActor(actors, alias);

		if (operation === "activate") {
			this._setActivationCount(activationState, alias, this._getActivationCount(activationState, alias) + 1);
			return {
				type: "blank",
				height: 0,
				activate: [alias],
			};
		}

		this._setActivationCount(activationState, alias, Math.max(this._getActivationCount(activationState, alias) - 1, 0));
		return {
			type: "blank",
			height: 0,
			deactivate: [alias],
		};
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Return the Mermaid control keyword at the start of a line when present.
	 *
	 * @param {string} trimmed Trimmed Mermaid source line.
	 * @returns {"loop"|"alt"|"opt"|"par"|"and"|"else"|"end"|null} Control keyword or null.
	 * @example
	 * const keyword = MermaidSequenceTransformer._getControlKeyword("alt Success");
	 */
	static _getControlKeyword(trimmed) {
		const match = String(trimmed).match(/^(loop|alt|opt|par|and|else|end)\b/i);
		return match ? match[1].toLowerCase() : null;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Parse a Mermaid fragment start line label.
	 *
	 * @param {string} trimmed Trimmed Mermaid source line.
	 * @param {"loop"|"alt"|"opt"|"par"} fragmentType Mermaid fragment type.
	 * @param {number} lineNumber 1-based source line number.
	 * @param {string} sourceLine Original Mermaid source line.
	 * @returns {string} Normalised fragment condition label.
	 * @throws {MermaidTransformError} If the fragment syntax is malformed.
	 * @example
	 * const label = MermaidSequenceTransformer._parseFragmentLabel("loop Retry", "loop", 8, "loop Retry");
	 */
	static _parseFragmentLabel(trimmed, fragmentType, lineNumber, sourceLine) {
		const match = String(trimmed).match(new RegExp(`^${fragmentType}(?:\\s+(.*))?$`, "i"));
		if (!match) {
			throw new MermaidTransformError(`Unsupported Mermaid ${fragmentType} syntax`, lineNumber, sourceLine);
		}

		return this._cleanMetadataValue(match[1] != null ? match[1] : "");
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Parse a Mermaid `else` label, defaulting to `ELSE` when omitted.
	 *
	 * @param {string} trimmed Trimmed Mermaid source line.
	 * @returns {string} Normalised else-branch label.
	 * @example
	 * const label = MermaidSequenceTransformer._parseElseLabel("else Failure path");
	 */
	static _parseElseLabel(trimmed) {
		const match = String(trimmed).match(/^else(?:\s+(.*))?$/i);
		const label = this._cleanMetadataValue(match && match[1] != null ? match[1] : "");
		return label.length > 0 ? label : "ELSE";
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Parse a Mermaid `and` label, defaulting to `AND` when omitted.
	 *
	 * @param {string} trimmed Trimmed Mermaid source line.
	 * @returns {string} Normalised parallel-branch label.
	 * @example
	 * const label = MermaidSequenceTransformer._parseAndLabel("and Publish result");
	 */
	static _parseAndLabel(trimmed) {
		const match = String(trimmed).match(/^and(?:\s+(.*))?$/i);
		const label = this._cleanMetadataValue(match && match[1] != null ? match[1] : "");
		return label.length > 0 ? label : "AND";
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
	 * Parse an optional Mermaid activation shortcut attached to a message target.
	 *
	 * @param {string} token Raw target token extracted from a Mermaid message.
	 * @returns {{ alias: string, operation: string|null }} Target alias and shortcut operation.
	 * @throws {MermaidTransformError} If the target token is malformed.
	 * @example
	 * const parsed = MermaidSequenceTransformer._parseActivationShortcut("+Service");
	 */
	static _parseActivationShortcut(token) {
		const trimmed = String(token).trim();
		const match = trimmed.match(/^([+-]?)([A-Za-z0-9_][-A-Za-z0-9_]*)$/);
		if (!match) {
			throw new MermaidTransformError("Unsupported Mermaid message actor syntax");
		}

		return {
			alias: match[2],
			operation: match[1] === "" ? null : match[1],
		};
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Return the current activation count for an actor alias.
	 *
	 * @param {object} activationState Current Mermaid activation counters by alias.
	 * @param {string} alias Actor alias.
	 * @returns {number} Activation depth.
	 * @example
	 * const count = MermaidSequenceTransformer._getActivationCount({}, "API");
	 */
	static _getActivationCount(activationState, alias) {
		return Number.isInteger(activationState[alias]) && activationState[alias] > 0 ? activationState[alias] : 0;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Update the stored activation count for an actor alias.
	 *
	 * @param {object} activationState Current Mermaid activation counters by alias.
	 * @param {string} alias Actor alias.
	 * @param {number} count Next activation depth.
	 * @returns {void} Nothing.
	 * @example
	 * MermaidSequenceTransformer._setActivationCount({}, "API", 1);
	 */
	static _setActivationCount(activationState, alias, count) {
		if (!Number.isInteger(count) || count <= 0) {
			delete activationState[alias];
			return;
		}

		activationState[alias] = count;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Apply a Mermaid activation shortcut to the target actor state.
	 *
	 * @param {object} activationState Current Mermaid activation counters by alias.
	 * @param {string} alias Target actor alias.
	 * @param {string|null} operation Mermaid shortcut operation.
	 * @returns {number} Post-line activation depth for the target actor.
	 * @example
	 * const count = MermaidSequenceTransformer._applyActivationShortcut({}, "API", "+");
	 */
	static _applyActivationShortcut(activationState, alias, operation) {
		const currentCount = this._getActivationCount(activationState, alias);
		let nextCount = currentCount;

		if (operation === "+") {
			nextCount = currentCount + 1;
		} else if (operation === "-") {
			nextCount = Math.max(currentCount - 1, 0);
		}

		this._setActivationCount(activationState, alias, nextCount);
		return nextCount;
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
	 * Convert Mermaid metadata text into sequencer text arrays when needed.
	 *
	 * @param {string} value Raw Mermaid metadata payload.
	 * @returns {string|string[]} Sequencer text payload.
	 * @example
	 * const payload = MermaidSequenceTransformer._parseMetadataPayload("'Line 1<br/>Line 2'");
	 */
	static _parseMetadataPayload(value) {
		const parts = this._cleanMetadataValue(value)
			.split(/<br\s*\/?>/i)
			.map((part) => part.trim());

		return parts.length === 1 ? parts[0] : parts;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Trim metadata text and remove matching outer quotes when present.
	 *
	 * @param {string} value Raw metadata text.
	 * @returns {string} Cleaned text.
	 * @example
	 * const text = MermaidSequenceTransformer._cleanMetadataValue("'Example text'");
	 */
	static _cleanMetadataValue(value) {
		return this._cleanParticipantName(String(value).trim());
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
		if (/^(links?|link)\b/i.test(trimmed)) {
			return new MermaidTransformError("Mermaid links are not supported yet", lineNumber, sourceLine);
		}

		if (/^(par|critical|break|rect|box|create|destroy)\b/i.test(trimmed)) {
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
