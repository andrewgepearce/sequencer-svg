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
 * Slice 11 supports explicit `participant` and `actor` declarations, Mermaid
 * accessibility metadata, basic message lines, standard unidirectional arrow
 * variants, Mermaid notes mapped onto sequencer comments hosted by synthetic
 * blank lines, Mermaid activation/deactivation control, and Mermaid `loop`,
 * `alt`, `opt`, `par`, `critical`, `break`, `rect`, `and`, `else`,
 * `option`, and `end` fragments mapped onto sequencer fragments, plus
 * Mermaid `autonumber` mapped onto a sequencer document flag, real
 * sequencer return lines for dotted Mermaid messages, bidirectional arrows,
 * and Mermaid half-arrow variants mapped onto sequencer `fromArrow` and
 * `toArrow` endpoint styles.
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
			actorGroups: [],
			lines: [],
		};
		const activationState = Object.create(null);
		const lifecycleDirectiveState = {
			pendingCreate: Object.create(null),
			pendingDestroy: Object.create(null),
		};

		const statements = this._collectStatements(source, document);
		const parsedDocument = this._parseStructuredLines(
			statements,
			0,
			document.actors,
			document.actorGroups,
			activationState,
			lifecycleDirectiveState,
			null
		);
		document.lines = parsedDocument.lines;
		if (document.actorGroups.length === 0) {
			delete document.actorGroups;
		}
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
	 * @param {object[]} actorGroups Current actor-group array.
	 * @param {object} activationState Current Mermaid activation counters by alias.
	 * @param {string[]|null} stopKeywords Optional control keywords that stop this parse scope.
	 * @returns {{ lines: object[], nextIndex: number }} Parsed sequencer lines and next statement index.
	 * @example
	 * const result = MermaidSequenceTransformer._parseStructuredLines(statements, 0, actors, activationState, ["end"]);
	 */
	static _parseStructuredLines(statements, startIndex, actors, actorGroups, activationState, lifecycleDirectiveState, stopKeywords) {
		const lines = [];
		let index = startIndex;

		while (index < statements.length) {
			const statement = statements[index];
			const controlKeyword = this._getControlKeyword(statement.trimmed);

			if (controlKeyword != null) {
				if (Array.isArray(stopKeywords) && stopKeywords.includes(controlKeyword)) {
					break;
				}

				if (
					controlKeyword === "loop" ||
					controlKeyword === "alt" ||
					controlKeyword === "opt" ||
					controlKeyword === "par" ||
					controlKeyword === "critical" ||
					controlKeyword === "break" ||
					controlKeyword === "rect" ||
					controlKeyword === "box"
				) {
					if (controlKeyword === "box") {
						const parsedBox = this._parseActorGroupBox(statements, index, actors, actorGroups);
						index = parsedBox.nextIndex;
						continue;
					}
					const parsedFragment =
						controlKeyword === "alt"
							? this._parseAltFragment(statements, index, actors, actorGroups, activationState, lifecycleDirectiveState)
							: controlKeyword === "par"
							? this._parseParFragment(statements, index, actors, actorGroups, activationState, lifecycleDirectiveState)
							: controlKeyword === "critical"
							? this._parseCriticalFragment(statements, index, actors, actorGroups, activationState, lifecycleDirectiveState)
							: controlKeyword === "rect"
							? this._parseRectFragment(statements, index, actors, actorGroups, activationState, lifecycleDirectiveState)
							: controlKeyword === "break"
							? this._parseSimpleFragment(statements, index, actors, actorGroups, activationState, lifecycleDirectiveState, "break")
							: this._parseSimpleFragment(statements, index, actors, actorGroups, activationState, lifecycleDirectiveState, controlKeyword);
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

			if (this._isActorLinkStatement(statement.trimmed)) {
				this._parseActorLinkStatement(statement.trimmed, actors, statement.lineNumber, statement.sourceLine);
				index++;
				continue;
			}

			if (this._isLifecycleDirective(statement.trimmed)) {
				this._parseLifecycleDirective(statement.trimmed, actors, lifecycleDirectiveState, statement.lineNumber, statement.sourceLine);
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
				lines.push(
					this._parseMessageLine(statement.trimmed, actors, activationState, lifecycleDirectiveState, statement.lineNumber, statement.sourceLine)
				);
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
	static _parseSimpleFragment(statements, startIndex, actors, actorGroups, activationState, lifecycleDirectiveState, fragmentType) {
		const startStatement = statements[startIndex];
		const condition = this._parseFragmentLabel(startStatement.trimmed, fragmentType, startStatement.lineNumber, startStatement.sourceLine);
		const parsedBody = this._parseStructuredLines(
			statements,
			startIndex + 1,
			actors,
			actorGroups,
			activationState,
			lifecycleDirectiveState,
			["end"]
		);
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
	static _parseAltFragment(statements, startIndex, actors, actorGroups, activationState, lifecycleDirectiveState) {
		const startStatement = statements[startIndex];
		const initialCondition = this._parseFragmentLabel(startStatement.trimmed, "alt", startStatement.lineNumber, startStatement.sourceLine);
		const fragment = {
			type: "fragment",
			fragmentType: "alt",
			title: "",
			condition: initialCondition,
			lines: [],
		};
		const firstBranch = this._parseStructuredLines(
			statements,
			startIndex + 1,
			actors,
			actorGroups,
			activationState,
			lifecycleDirectiveState,
			["else", "end"]
		);
		fragment.lines.push(...firstBranch.lines);

		let index = firstBranch.nextIndex;
		while (index < statements.length && this._getControlKeyword(statements[index].trimmed) === "else") {
			const elseStatement = statements[index];
			fragment.lines.push({
				type: "condition",
				condition: this._parseElseLabel(elseStatement.trimmed),
			});

			const nextBranch = this._parseStructuredLines(
				statements,
				index + 1,
				actors,
				actorGroups,
				activationState,
				lifecycleDirectiveState,
				["else", "end"]
			);
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
	static _parseParFragment(statements, startIndex, actors, actorGroups, activationState, lifecycleDirectiveState) {
		const startStatement = statements[startIndex];
		const initialCondition = this._parseFragmentLabel(startStatement.trimmed, "par", startStatement.lineNumber, startStatement.sourceLine);
		const fragment = {
			type: "fragment",
			fragmentType: "par",
			title: "",
			condition: initialCondition,
			lines: [],
		};
		const firstBranch = this._parseStructuredLines(
			statements,
			startIndex + 1,
			actors,
			actorGroups,
			activationState,
			lifecycleDirectiveState,
			["and", "end"]
		);
		fragment.lines.push(...firstBranch.lines);

		let index = firstBranch.nextIndex;
		while (index < statements.length && this._getControlKeyword(statements[index].trimmed) === "and") {
			const andStatement = statements[index];
			fragment.lines.push({
				type: "condition",
				condition: this._parseAndLabel(andStatement.trimmed),
			});

			const nextBranch = this._parseStructuredLines(
				statements,
				index + 1,
				actors,
				actorGroups,
				activationState,
				lifecycleDirectiveState,
				["and", "end"]
			);
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
	 * Parse a Mermaid `critical` fragment, including sibling `option` branches.
	 *
	 * @param {{ trimmed: string, sourceLine: string, lineNumber: number }[]} statements Structured Mermaid statements.
	 * @param {number} startIndex Statement index of the `critical` line.
	 * @param {object[]} actors Current actor array.
	 * @param {object} activationState Current Mermaid activation counters by alias.
	 * @returns {{ line: object, nextIndex: number }} Parsed fragment line and next index.
	 * @throws {MermaidTransformError} If the fragment is malformed or unterminated.
	 * @example
	 * const parsed = MermaidSequenceTransformer._parseCriticalFragment(statements, 4, actors, activationState);
	 */
	static _parseCriticalFragment(statements, startIndex, actors, actorGroups, activationState, lifecycleDirectiveState) {
		const startStatement = statements[startIndex];
		const initialCondition = this._parseFragmentLabel(
			startStatement.trimmed,
			"critical",
			startStatement.lineNumber,
			startStatement.sourceLine
		);
		const fragment = {
			type: "fragment",
			fragmentType: "critical",
			title: "",
			condition: initialCondition,
			lines: [],
		};
		const firstBranch = this._parseStructuredLines(
			statements,
			startIndex + 1,
			actors,
			actorGroups,
			activationState,
			lifecycleDirectiveState,
			["option", "end"]
		);
		fragment.lines.push(...firstBranch.lines);

		let index = firstBranch.nextIndex;
		while (index < statements.length && this._getControlKeyword(statements[index].trimmed) === "option") {
			const optionStatement = statements[index];
			fragment.lines.push({
				type: "condition",
				condition: this._parseOptionLabel(optionStatement.trimmed),
			});

			const nextBranch = this._parseStructuredLines(
				statements,
				index + 1,
				actors,
				actorGroups,
				activationState,
				lifecycleDirectiveState,
				["option", "end"]
			);
			fragment.lines.push(...nextBranch.lines);
			index = nextBranch.nextIndex;
		}

		const endStatement = statements[index];
		if (!endStatement || this._getControlKeyword(endStatement.trimmed) !== "end") {
			throw new MermaidTransformError(
				"Mermaid feature 'critical' is missing a matching 'end'",
				startStatement.lineNumber,
				startStatement.sourceLine
			);
		}

		return {
			line: fragment,
			nextIndex: index + 1,
		};
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Parse a Mermaid `rect` highlight block into a sequencer region fragment.
	 *
	 * @param {{ trimmed: string, sourceLine: string, lineNumber: number }[]} statements Structured Mermaid statements.
	 * @param {number} startIndex Statement index of the `rect` line.
	 * @param {object[]} actors Current actor array.
	 * @param {object} activationState Current Mermaid activation counters by alias.
	 * @returns {{ line: object, nextIndex: number }} Parsed fragment line and next index.
	 * @throws {MermaidTransformError} If the fragment is malformed or unterminated.
	 * @example
	 * const parsed = MermaidSequenceTransformer._parseRectFragment(statements, 4, actors, activationState);
	 */
	static _parseRectFragment(statements, startIndex, actors, actorGroups, activationState, lifecycleDirectiveState) {
		const startStatement = statements[startIndex];
		const bgColour = this._parseRectColour(startStatement.trimmed, startStatement.lineNumber, startStatement.sourceLine);
		const parsedBody = this._parseStructuredLines(
			statements,
			startIndex + 1,
			actors,
			actorGroups,
			activationState,
			lifecycleDirectiveState,
			["end"]
		);
		const endStatement = statements[parsedBody.nextIndex];

		if (!endStatement || this._getControlKeyword(endStatement.trimmed) !== "end") {
			throw new MermaidTransformError("Mermaid feature 'rect' is missing a matching 'end'", startStatement.lineNumber, startStatement.sourceLine);
		}

		const fragment = {
			type: "fragment",
			fragmentType: "rect",
			title: "",
			condition: "",
			bgColour: bgColour,
			borderWidth: 0,
			lines: parsedBody.lines,
		};
		const actorSpan = this._inferActorSpan(parsedBody.lines, actors);
		if (actorSpan.startActor != null) {
			fragment.startActor = actorSpan.startActor;
		}
		if (actorSpan.endActor != null) {
			fragment.endActor = actorSpan.endActor;
		}

		return {
			line: fragment,
			nextIndex: parsedBody.nextIndex + 1,
		};
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Parse a Mermaid `box` participant-group block into a top-level actor group.
	 *
	 * @param {{ trimmed: string, sourceLine: string, lineNumber: number }[]} statements Structured Mermaid statements.
	 * @param {number} startIndex Statement index of the `box` line.
	 * @param {object[]} actors Current actor array.
	 * @param {object[]} actorGroups Current actor-group array.
	 * @returns {{ nextIndex: number }} Next statement index after the box.
	 * @throws {MermaidTransformError} If the box is malformed or contains unsupported content.
	 * @example
	 * MermaidSequenceTransformer._parseActorGroupBox(statements, 4, actors, actorGroups);
	 */
	static _parseActorGroupBox(statements, startIndex, actors, actorGroups) {
		const startStatement = statements[startIndex];
		const boxHeader = this._parseActorGroupBoxHeader(startStatement.trimmed, startStatement.lineNumber, startStatement.sourceLine);
		const groupedAliases = [];
		let index = startIndex + 1;

		while (index < statements.length) {
			const statement = statements[index];
			const controlKeyword = this._getControlKeyword(statement.trimmed);
			if (controlKeyword === "end") {
				if (groupedAliases.length === 0) {
					throw new MermaidTransformError(
						"Mermaid box must declare at least one participant or actor",
						startStatement.lineNumber,
						startStatement.sourceLine
					);
				}
				actorGroups.push({
					title: boxHeader.title,
					bgColour: boxHeader.bgColour,
					actors: groupedAliases,
				});
				return {
					nextIndex: index + 1,
				};
			}

			if (!this._isParticipantDeclaration(statement.trimmed)) {
				throw new MermaidTransformError(
					"Mermaid box may only contain participant or actor declarations",
					statement.lineNumber,
					statement.sourceLine
				);
			}

			const actor = this._parseParticipantDeclaration(statement.trimmed, statement.lineNumber, statement.sourceLine);
			this._registerActor(actors, actor);
			groupedAliases.push(actor.alias);
			index++;
		}

		throw new MermaidTransformError("Mermaid feature 'box' is missing a matching 'end'", startStatement.lineNumber, startStatement.sourceLine);
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Parse a Mermaid `box` header into colour/title metadata.
	 *
	 * @param {string} trimmed Trimmed Mermaid source line.
	 * @param {number} lineNumber 1-based source line number.
	 * @param {string} sourceLine Original Mermaid source line.
	 * @returns {{ title: string, bgColour: string }} Parsed box metadata.
	 * @throws {MermaidTransformError} If the syntax is malformed.
	 * @example
	 * const header = MermaidSequenceTransformer._parseActorGroupBoxHeader("box Aqua Backend", 4, "box Aqua Backend");
	 */
	static _parseActorGroupBoxHeader(trimmed, lineNumber, sourceLine) {
		const match = String(trimmed).match(/^box(?:\s+(.*))?$/i);
		if (!match) {
			throw new MermaidTransformError("Unsupported Mermaid box syntax", lineNumber, sourceLine);
		}

		const payload = this._cleanMetadataValue(match[1] != null ? match[1] : "");
		if (payload.length === 0) {
			return {
				title: "",
				bgColour: "rgba(220,220,220,0.35)",
			};
		}

		if (/^rgba?\(/i.test(payload)) {
			const closingBracketIndex = payload.indexOf(")");
			if (closingBracketIndex === -1) {
				throw new MermaidTransformError("Unsupported Mermaid box colour syntax", lineNumber, sourceLine);
			}
			return {
				bgColour: payload.slice(0, closingBracketIndex + 1).trim(),
				title: this._cleanMetadataValue(payload.slice(closingBracketIndex + 1)),
			};
		}

		const tokens = payload.split(/\s+/).filter((token) => token.length > 0);
		if (tokens.length === 0) {
			return {
				title: "",
				bgColour: "rgba(220,220,220,0.35)",
			};
		}

		if (this._isNamedColourToken(tokens[0])) {
			return {
				bgColour: tokens[0],
				title: this._cleanMetadataValue(tokens.slice(1).join(" ")),
			};
		}

		return {
			title: payload,
			bgColour: "rgba(220,220,220,0.35)",
		};
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Detect whether a Mermaid token should be treated as a named colour.
	 *
	 * @param {string} token Candidate colour token.
	 * @returns {boolean} True when the token is a supported named colour.
	 * @example
	 * const isNamedColour = MermaidSequenceTransformer._isNamedColourToken("Aqua");
	 */
	static _isNamedColourToken(token) {
		return [
			"aqua",
			"black",
			"blue",
			"fuchsia",
			"gray",
			"green",
			"lime",
			"maroon",
			"navy",
			"olive",
			"orange",
			"purple",
			"red",
			"silver",
			"teal",
			"transparent",
			"white",
			"yellow",
		].includes(String(token).trim().toLowerCase());
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
	 * @param {{ pendingCreate: object, pendingDestroy: object }} lifecycleDirectiveState Pending Mermaid lifecycle directives.
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
		if (match) {
			if (typeof match[3] === "string" && match[3].trim().startsWith("{")) {
				return this._parseConfiguredParticipantDeclaration(trimmed, lineNumber, sourceLine);
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

		return this._parseConfiguredParticipantDeclaration(trimmed, lineNumber, sourceLine);
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Parse a Mermaid participant declaration that uses JSON configuration
	 * syntax for specialised participant kinds or inline aliases.
	 *
	 * @param {string} trimmed Trimmed Mermaid source line.
	 * @param {number} lineNumber 1-based source line number.
	 * @param {string} sourceLine Original Mermaid source line.
	 * @returns {{ name: string, alias: string, actorType: string }} Sequencer actor object.
	 * @throws {MermaidTransformError} If the declaration is malformed.
	 * @example
	 * const actor = MermaidSequenceTransformer._parseConfiguredParticipantDeclaration(
	 *   'participant DB as {"type":"database","name":"Primary store"}',
	 *   4,
	 *   'participant DB as {"type":"database","name":"Primary store"}'
	 * );
	 */
	static _parseConfiguredParticipantDeclaration(trimmed, lineNumber, sourceLine) {
		const match = String(trimmed).match(/^(participant|actor)\s+(.+)$/i);
		if (!match) {
			throw new MermaidTransformError("Unsupported Mermaid participant declaration", lineNumber, sourceLine);
		}

		const declarationType = match[1].toLowerCase();
		const payload = match[2].trim();
		let externalAlias = null;
		let configPayload = payload;

		const aliasAndConfigMatch = payload.match(/^([A-Za-z0-9_][-A-Za-z0-9_]*)\s+as\s+(\{.*)$/);
		if (aliasAndConfigMatch) {
			externalAlias = aliasAndConfigMatch[1];
			configPayload = aliasAndConfigMatch[2].trim();
		}

		if (!configPayload.startsWith("{")) {
			throw new MermaidTransformError("Unsupported Mermaid participant declaration", lineNumber, sourceLine);
		}

		const splitPayload = this._splitJsonObjectPrefix(configPayload, lineNumber, sourceLine);
		const config = this._parseParticipantConfigurationObject(splitPayload.jsonText, lineNumber, sourceLine);
		const actorType = this._resolveConfiguredActorType(declarationType, config.type, lineNumber, sourceLine);
		const alias = externalAlias || config.alias;
		const name = this._cleanParticipantName(config.name != null ? config.name : config.label != null ? config.label : alias);

		if (!/^[A-Za-z0-9_][-A-Za-z0-9_]*$/.test(alias)) {
			throw new MermaidTransformError("Mermaid participant alias must be a valid identifier", lineNumber, sourceLine);
		}
		if (name.length === 0) {
			throw new MermaidTransformError("Mermaid participant display name cannot be empty", lineNumber, sourceLine);
		}
		if (splitPayload.suffix.length > 0) {
			throw new MermaidTransformError("Unsupported Mermaid participant declaration suffix", lineNumber, sourceLine);
		}

		return {
			name: name,
			alias: alias,
			actorType: actorType,
		};
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Split a leading JSON object from the remainder of a Mermaid declaration.
	 *
	 * @param {string} payload Mermaid declaration payload that begins with `{`.
	 * @param {number} lineNumber 1-based source line number.
	 * @param {string} sourceLine Original Mermaid source line.
	 * @returns {{ jsonText: string, suffix: string }} JSON object text plus any trailing suffix.
	 * @throws {MermaidTransformError} If the JSON object is unterminated.
	 * @example
	 * const parts = MermaidSequenceTransformer._splitJsonObjectPrefix('{"type":"database"}', 4, source);
	 */
	static _splitJsonObjectPrefix(payload, lineNumber, sourceLine) {
		let depth = 0;
		let inString = false;
		let escaped = false;

		for (let index = 0; index < payload.length; index++) {
			const char = payload.charAt(index);
			if (inString) {
				if (escaped) {
					escaped = false;
				} else if (char === "\\") {
					escaped = true;
				} else if (char === "\"") {
					inString = false;
				}
				continue;
			}

			if (char === "\"") {
				inString = true;
				continue;
			}
			if (char === "{") {
				depth++;
				continue;
			}
			if (char === "}") {
				depth--;
				if (depth === 0) {
					return {
						jsonText: payload.slice(0, index + 1),
						suffix: payload.slice(index + 1).trim(),
					};
				}
			}
		}

		throw new MermaidTransformError("Mermaid participant JSON configuration is unterminated", lineNumber, sourceLine);
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Parse a Mermaid participant JSON configuration object.
	 *
	 * @param {string} jsonText JSON object text.
	 * @param {number} lineNumber 1-based source line number.
	 * @param {string} sourceLine Original Mermaid source line.
	 * @returns {{ alias?: string, name?: string, label?: string, type?: string }} Parsed configuration object.
	 * @throws {MermaidTransformError} If the JSON is invalid or unsupported.
	 * @example
	 * const config = MermaidSequenceTransformer._parseParticipantConfigurationObject('{"type":"database","alias":"DB"}', 4, source);
	 */
	static _parseParticipantConfigurationObject(jsonText, lineNumber, sourceLine) {
		let config;
		try {
			config = JSON.parse(jsonText);
		} catch (error) {
			throw new MermaidTransformError("Invalid Mermaid participant JSON configuration", lineNumber, sourceLine);
		}

		if (!config || typeof config !== "object" || Array.isArray(config)) {
			throw new MermaidTransformError("Mermaid participant JSON configuration must be an object", lineNumber, sourceLine);
		}

		return config;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Resolve the Mermaid actor kind for a configured participant declaration.
	 *
	 * @param {"participant"|"actor"} declarationType Declared Mermaid keyword.
	 * @param {string|undefined} configuredType Optional configured participant kind.
	 * @param {number} lineNumber 1-based source line number.
	 * @param {string} sourceLine Original Mermaid source line.
	 * @returns {"participant"|"actor"|"boundary"|"control"|"entity"|"database"|"collections"|"queue"} Resolved actor type.
	 * @throws {MermaidTransformError} If the configured type is unsupported.
	 * @example
	 * const actorType = MermaidSequenceTransformer._resolveConfiguredActorType("participant", "database", 4, source);
	 */
	static _resolveConfiguredActorType(declarationType, configuredType, lineNumber, sourceLine) {
		const actorType = typeof configuredType === "string" && configuredType.trim().length > 0 ? configuredType.trim().toLowerCase() : declarationType;
		if (!["participant", "actor", "boundary", "control", "entity", "database", "collections", "queue"].includes(actorType)) {
			throw new MermaidTransformError(`Unsupported Mermaid participant type '${configuredType}'`, lineNumber, sourceLine);
		}
		return actorType;
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
	 * Detect whether a trimmed Mermaid line is an actor-link statement.
	 *
	 * @param {string} trimmed Trimmed Mermaid source line.
	 * @returns {boolean} True when the line is a `link` or `links` statement.
	 * @example
	 * const matched = MermaidSequenceTransformer._isActorLinkStatement("link API: Dashboard @ https://example.test");
	 */
	static _isActorLinkStatement(trimmed) {
		return /^(link|links)\s+/i.test(trimmed);
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Parse a Mermaid actor-link statement into sequencer actor metadata.
	 *
	 * @param {string} trimmed Trimmed Mermaid source line.
	 * @param {object[]} actors Current actor array.
	 * @param {number} lineNumber 1-based source line number.
	 * @param {string} sourceLine Original Mermaid source line.
	 * @returns {void} Nothing.
	 * @throws {MermaidTransformError} If the link syntax is malformed.
	 * @example
	 * MermaidSequenceTransformer._parseActorLinkStatement("link API: Docs @ https://example.test", actors, 4, source);
	 */
	static _parseActorLinkStatement(trimmed, actors, lineNumber, sourceLine) {
		if (/^links\s+/i.test(trimmed)) {
			const match = String(trimmed).match(/^links\s+([A-Za-z0-9_][-A-Za-z0-9_]*)\s*:\s*(\{.*\})$/i);
			if (!match) {
				throw new MermaidTransformError("Unsupported Mermaid links syntax", lineNumber, sourceLine);
			}

			const alias = match[1];
			this._ensureImplicitActor(actors, alias);
			let linkMap;
			try {
				linkMap = JSON.parse(match[2]);
			} catch (error) {
				throw new MermaidTransformError("Invalid Mermaid links JSON object", lineNumber, sourceLine);
			}
			if (!linkMap || typeof linkMap !== "object" || Array.isArray(linkMap)) {
				throw new MermaidTransformError("Mermaid links payload must be a JSON object", lineNumber, sourceLine);
			}

			Object.keys(linkMap).forEach((label) => {
				const url = linkMap[label];
				if (typeof url !== "string" || url.trim().length === 0) {
					throw new MermaidTransformError("Mermaid links entries must map labels to non-empty URLs", lineNumber, sourceLine);
				}
				this._appendActorLink(actors, alias, label, url);
			});
			return;
		}

		const match = String(trimmed).match(/^link\s+([A-Za-z0-9_][-A-Za-z0-9_]*)\s*:\s*(.+?)\s*@\s*(\S.+)$/i);
		if (!match) {
			throw new MermaidTransformError("Unsupported Mermaid link syntax", lineNumber, sourceLine);
		}

		const alias = match[1];
		const label = this._cleanMetadataValue(match[2]);
		const url = String(match[3]).trim();
		if (label.length === 0 || url.length === 0) {
			throw new MermaidTransformError("Mermaid link label and URL must be non-empty", lineNumber, sourceLine);
		}
		this._ensureImplicitActor(actors, alias);
		this._appendActorLink(actors, alias, label, url);
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Append one link entry to a sequencer actor.
	 *
	 * @param {object[]} actors Current actor array.
	 * @param {string} alias Actor alias.
	 * @param {string} label Link label.
	 * @param {string} url Link URL.
	 * @returns {void} Nothing.
	 * @example
	 * MermaidSequenceTransformer._appendActorLink(actors, "API", "Docs", "https://example.test");
	 */
	static _appendActorLink(actors, alias, label, url) {
		const actor = actors.find((candidate) => candidate && candidate.alias === alias);
		if (!actor) {
			return;
		}
		if (!Array.isArray(actor.links)) {
			actor.links = [];
		}
		actor.links.push({
			label: label,
			url: url,
		});
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
		return /^[A-Za-z0-9_][-A-Za-z0-9_]*\s*[()<\\/\-|x).]+/.test(trimmed);
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
	static _parseMessageLine(trimmed, actors, activationState, lifecycleDirectiveState, lineNumber, sourceLine) {
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
		const fromEndpoint = this._parseMessageSourceEndpoint(leftSide, lineNumber, sourceLine);
		const toEndpoint = this._parseMessageTargetEndpoint(toToken, lineNumber, sourceLine);
		const fromAlias = fromEndpoint.alias;
		const arrowToken = matchedArrowToken;
		const activationShortcut = this._parseActivationShortcut(toEndpoint.aliasToken);
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
		const isCreateMessage =
			lifecycleDirectiveState &&
			typeof lifecycleDirectiveState.pendingCreate === "object" &&
			lifecycleDirectiveState.pendingCreate != null &&
			lifecycleDirectiveState.pendingCreate[toAlias] === true;
		const line = isReturnMessage
			? {
					type: "return",
					from: fromAlias,
					to: toAlias,
					text: this._parseTextPayload(messageText),
			  }
			: {
					type: isCreateMessage ? "create" : "call",
					from: fromAlias,
					to: toAlias,
					text: this._parseTextPayload(messageText),
			  };
		if (fromEndpoint.anchor === "central") {
			line.fromAnchor = "central";
		}
		if (toEndpoint.anchor === "central") {
			line.toAnchor = "central";
		}
		const preSourceActivationCount = this._getActivationCount(activationState, fromAlias);
		const activationOutcome = isReturnMessage
			? this._applyReturnActivationPolicy(activationState, fromAlias, toAlias, activationShortcut.operation)
			: this._applyCallActivationPolicy(
					activationState,
					fromAlias,
					toAlias,
					activationShortcut.operation,
					arrowDefinition.async !== true
			  );
		const postSourceActivationCount = activationOutcome.sourceCount;
		const postTargetActivationCount = activationOutcome.targetCount;

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
		if (
			lifecycleDirectiveState &&
			typeof lifecycleDirectiveState.pendingDestroy === "object" &&
			lifecycleDirectiveState.pendingDestroy != null &&
			lifecycleDirectiveState.pendingDestroy[fromAlias] === true
		) {
			line.destroyFrom = true;
			if (isReturnMessage) {
				delete line.continueFromFlow;
			} else {
				line.breakFromFlow = true;
			}
			delete lifecycleDirectiveState.pendingDestroy[fromAlias];
		}
		if (
			lifecycleDirectiveState &&
			typeof lifecycleDirectiveState.pendingDestroy === "object" &&
			lifecycleDirectiveState.pendingDestroy != null &&
			lifecycleDirectiveState.pendingDestroy[toAlias] === true
		) {
			line.destroyTo = true;
			line.breakToFlow = true;
			delete lifecycleDirectiveState.pendingDestroy[toAlias];
		}
		if (isCreateMessage) {
			delete lifecycleDirectiveState.pendingCreate[toAlias];
		}

		return line;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Detect whether a trimmed Mermaid line is a create/destroy lifecycle
	 * directive for the next message.
	 *
	 * @param {string} trimmed Trimmed Mermaid source line.
	 * @returns {boolean} True when the line is a lifecycle directive.
	 * @example
	 * const matched = MermaidSequenceTransformer._isLifecycleDirective("create participant Worker");
	 */
	static _isLifecycleDirective(trimmed) {
		return /^(create\s+(participant|actor)\b|destroy\s+)/i.test(trimmed);
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Parse a Mermaid lifecycle directive and record it for the next message.
	 *
	 * @param {string} trimmed Trimmed Mermaid source line.
	 * @param {object[]} actors Current actor array.
	 * @param {{ pendingCreate: object, pendingDestroy: object }} lifecycleDirectiveState Pending lifecycle directives.
	 * @param {number} lineNumber 1-based source line number.
	 * @param {string} sourceLine Original Mermaid source line.
	 * @returns {void} Nothing.
	 * @throws {MermaidTransformError} If the directive is malformed.
	 * @example
	 * MermaidSequenceTransformer._parseLifecycleDirective("destroy Worker", actors, state, 4, "destroy Worker");
	 */
	static _parseLifecycleDirective(trimmed, actors, lifecycleDirectiveState, lineNumber, sourceLine) {
		if (/^create\s+/i.test(trimmed)) {
			const actor = this._parseParticipantDeclaration(trimmed.replace(/^create\s+/i, ""), lineNumber, sourceLine);
			this._registerActor(actors, actor);
			lifecycleDirectiveState.pendingCreate[actor.alias] = true;
			return;
		}

		const destroyMatch = String(trimmed).match(/^destroy\s+([A-Za-z0-9_][-A-Za-z0-9_]*)$/i);
		if (!destroyMatch) {
			throw new MermaidTransformError("Unsupported Mermaid destroy syntax", lineNumber, sourceLine);
		}

		this._ensureImplicitActor(actors, destroyMatch[1]);
		lifecycleDirectiveState.pendingDestroy[destroyMatch[1]] = true;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Parse the source actor token for a Mermaid message, including an optional
	 * trailing central-connection marker.
	 *
	 * @param {string} token Trimmed source-side token before the arrow.
	 * @param {number} lineNumber 1-based source line number.
	 * @param {string} sourceLine Original Mermaid source line.
	 * @returns {{ alias: string, anchor: "edge"|"central" }} Parsed source endpoint.
	 * @throws {MermaidTransformError} If the token is malformed.
	 * @example
	 * const endpoint = MermaidSequenceTransformer._parseMessageSourceEndpoint("API()", 4, "API()->>DB: Save");
	 */
	static _parseMessageSourceEndpoint(token, lineNumber, sourceLine) {
		let alias = String(token).trim();
		let anchor = "edge";
		if (/\(\)\s*$/.test(alias)) {
			anchor = "central";
			alias = alias.replace(/\(\)\s*$/, "").trim();
		}
		if (!/^[A-Za-z0-9_][-A-Za-z0-9_]*$/.test(alias)) {
			throw new MermaidTransformError("Unsupported Mermaid message actor syntax", lineNumber, sourceLine);
		}
		return {
			alias: alias,
			anchor: anchor,
		};
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Parse the target actor token for a Mermaid message, including an optional
	 * leading central-connection marker before the actor alias.
	 *
	 * @param {string} token Trimmed target-side token after the arrow.
	 * @param {number} lineNumber 1-based source line number.
	 * @param {string} sourceLine Original Mermaid source line.
	 * @returns {{ aliasToken: string, anchor: "edge"|"central" }} Parsed target endpoint token.
	 * @throws {MermaidTransformError} If the token is malformed.
	 * @example
	 * const endpoint = MermaidSequenceTransformer._parseMessageTargetEndpoint("()DB", 4, "API->>()DB: Ack");
	 */
	static _parseMessageTargetEndpoint(token, lineNumber, sourceLine) {
		let aliasToken = String(token).trim();
		let anchor = "edge";

		if (/^\(\)/.test(aliasToken)) {
			anchor = "central";
			aliasToken = aliasToken.replace(/^\(\)/, "").trim();
		} else if (/^[+-]\(\)/.test(aliasToken)) {
			anchor = "central";
			aliasToken = aliasToken.charAt(0) + aliasToken.slice(3).trim();
		}

		if (!/^[+-]?[A-Za-z0-9_][-A-Za-z0-9_]*$/.test(aliasToken)) {
			throw new MermaidTransformError("Unsupported Mermaid message actor syntax", lineNumber, sourceLine);
		}

		return {
			aliasToken: aliasToken,
			anchor: anchor,
		};
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
	 * @returns {"loop"|"alt"|"opt"|"par"|"critical"|"break"|"rect"|"box"|"and"|"else"|"option"|"end"|null} Control keyword or null.
	 * @example
	 * const keyword = MermaidSequenceTransformer._getControlKeyword("alt Success");
	 */
	static _getControlKeyword(trimmed) {
		const match = String(trimmed).match(/^(loop|alt|opt|par|critical|break|rect|box|and|else|option|end)\b/i);
		return match ? match[1].toLowerCase() : null;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Parse a Mermaid fragment start line label.
	 *
	 * @param {string} trimmed Trimmed Mermaid source line.
	 * @param {"loop"|"alt"|"opt"|"par"|"critical"|"break"} fragmentType Mermaid fragment type.
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
	 * Parse a Mermaid `option` label, defaulting to `OPTION` when omitted.
	 *
	 * @param {string} trimmed Trimmed Mermaid source line.
	 * @returns {string} Normalised critical-option label.
	 * @example
	 * const label = MermaidSequenceTransformer._parseOptionLabel("option Circumstance A");
	 */
	static _parseOptionLabel(trimmed) {
		const match = String(trimmed).match(/^option(?:\s+(.*))?$/i);
		const label = this._cleanMetadataValue(match && match[1] != null ? match[1] : "");
		return label.length > 0 ? label : "OPTION";
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Parse a Mermaid `rect` colour declaration.
	 *
	 * @param {string} trimmed Trimmed Mermaid source line.
	 * @param {number} lineNumber 1-based source line number.
	 * @param {string} sourceLine Original Mermaid source line.
	 * @returns {string} Colour string preserved for sequencer output.
	 * @throws {MermaidTransformError} If the rect syntax is malformed.
	 * @example
	 * const colour = MermaidSequenceTransformer._parseRectColour("rect rgba(0,0,255,0.1)", 8, "rect rgba(0,0,255,0.1)");
	 */
	static _parseRectColour(trimmed, lineNumber, sourceLine) {
		const match = String(trimmed).match(/^rect\s+(.+)$/i);
		if (!match) {
			throw new MermaidTransformError("Unsupported Mermaid rect syntax", lineNumber, sourceLine);
		}

		const colour = this._cleanMetadataValue(match[1]);
		if (colour.length === 0) {
			throw new MermaidTransformError("Mermaid rect colour cannot be empty", lineNumber, sourceLine);
		}

		return colour;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Infer the actor span touched by a collection of transformed sequencer lines.
	 *
	 * @param {object[]} lines Sequencer lines inside one Mermaid region.
	 * @param {object[]} actors Document actors in display order.
	 * @returns {{ startActor: string|null, endActor: string|null }} Actor span bounds.
	 * @example
	 * const span = MermaidSequenceTransformer._inferActorSpan(lines, actors);
	 */
	static _inferActorSpan(lines, actors) {
		if (!Array.isArray(lines) || !Array.isArray(actors)) {
			return {
				startActor: null,
				endActor: null,
			};
		}

		const aliases = [];
		lines.forEach((line) => {
			this._collectLineActorAliases(line, aliases);
		});

		const uniqueAliases = aliases.filter((alias, index) => aliases.indexOf(alias) === index);
		const indexedAliases = actors
			.map((actor, index) => ({ alias: actor.alias, index: index }))
			.filter((entry) => uniqueAliases.includes(entry.alias));

		if (indexedAliases.length === 0) {
			return {
				startActor: null,
				endActor: null,
			};
		}

		indexedAliases.sort((left, right) => left.index - right.index);
		return {
			startActor: indexedAliases[0].alias,
			endActor: indexedAliases[indexedAliases.length - 1].alias,
		};
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Collect actor aliases referenced by one transformed sequencer line.
	 *
	 * @param {object} line Sequencer line.
	 * @param {string[]} aliases Mutable alias accumulator.
	 * @returns {void} Nothing.
	 * @example
	 * MermaidSequenceTransformer._collectLineActorAliases({ type: "call", from: "A", to: "B" }, []);
	 */
	static _collectLineActorAliases(line, aliases) {
		if (!line || typeof line !== "object" || !Array.isArray(aliases)) {
			return;
		}

		if (typeof line.from === "string") {
			aliases.push(line.from);
		}
		if (typeof line.to === "string") {
			aliases.push(line.to);
		}
		if (typeof line.actor === "string") {
			aliases.push(line.actor);
		}
		if (Array.isArray(line.actors)) {
			line.actors.forEach((alias) => {
				if (typeof alias === "string") {
					aliases.push(alias);
				}
			});
		}
		if (Array.isArray(line.activate)) {
			line.activate.forEach((alias) => {
				if (typeof alias === "string") {
					aliases.push(alias);
				}
			});
		}
		if (Array.isArray(line.deactivate)) {
			line.deactivate.forEach((alias) => {
				if (typeof alias === "string") {
					aliases.push(alias);
				}
			});
		}
		if (Array.isArray(line.lines)) {
			line.lines.forEach((childLine) => {
				this._collectLineActorAliases(childLine, aliases);
			});
		}
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
	 * Apply a Mermaid activation shortcut to an activation count.
	 *
	 * @param {number} currentCount Current activation depth.
	 * @param {string|null} operation Mermaid shortcut operation.
	 * @returns {number} Post-operation activation depth.
	 * @example
	 * const count = MermaidSequenceTransformer._applyActivationOperation(1, "+");
	 */
	static _applyActivationOperation(currentCount, operation) {
		let nextCount = currentCount;

		if (operation === "+") {
			nextCount = currentCount + 1;
		} else if (operation === "-") {
			nextCount = Math.max(currentCount - 1, 0);
		}

		return nextCount;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Apply the default Mermaid call-activation policy to the transform state.
	 *
	 * @param {object} activationState Current Mermaid activation counters by alias.
	 * @param {string} fromAlias Source actor alias.
	 * @param {string} toAlias Target actor alias.
	 * @param {string|null} operation Optional Mermaid shortcut on the target actor.
	 * @param {boolean} keepSourceActive Whether the source actor should remain active by default.
	 * @returns {{ sourceCount: number, targetCount: number }} Post-line activation depths.
	 * @example
	 * const outcome = MermaidSequenceTransformer._applyCallActivationPolicy({}, "Caller", "Service", null, true);
	 */
	static _applyCallActivationPolicy(activationState, fromAlias, toAlias, operation, keepSourceActive) {
		const implicitSourceCount = keepSourceActive ? Math.max(this._getActivationCount(activationState, fromAlias), 1) : this._getActivationCount(activationState, fromAlias);
		const sourceCount = implicitSourceCount;
		const implicitTargetCount = this._getActivationCount(activationState, toAlias) + 1;
		const targetCount = this._applyActivationOperation(implicitTargetCount, operation);
		this._setActivationCount(activationState, fromAlias, sourceCount);
		this._setActivationCount(activationState, toAlias, targetCount);

		return {
			sourceCount: sourceCount,
			targetCount: targetCount,
		};
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Apply the default Mermaid return-activation policy to the transform state.
	 *
	 * @param {object} activationState Current Mermaid activation counters by alias.
	 * @param {string} fromAlias Source actor alias.
	 * @param {string} toAlias Target actor alias.
	 * @param {string|null} operation Optional Mermaid shortcut on the target actor.
	 * @returns {{ sourceCount: number, targetCount: number }} Post-line activation depths.
	 * @example
	 * const outcome = MermaidSequenceTransformer._applyReturnActivationPolicy({}, "Service", "Caller", null);
	 */
	static _applyReturnActivationPolicy(activationState, fromAlias, toAlias, operation) {
		const sourceCount = Math.max(this._getActivationCount(activationState, fromAlias) - 1, 0);
		const targetCount = this._applyActivationOperation(this._getActivationCount(activationState, toAlias), operation);
		this._setActivationCount(activationState, fromAlias, sourceCount);
		this._setActivationCount(activationState, toAlias, targetCount);

		return {
			sourceCount: sourceCount,
			targetCount: targetCount,
		};
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
		if (/^(par|critical|break|rect)\b/i.test(trimmed)) {
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
