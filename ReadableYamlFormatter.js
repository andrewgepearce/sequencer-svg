const yaml = require('js-yaml');

//////////////////////////////////////////////////////////////////////////////
/**
 * Format sequencer-style YAML using readable compaction rules.
 *
 * This helper is currently standalone and is not called by the CLI. It is
 * intended for future integration where compact-but-readable YAML output is
 * preferred over the default `js-yaml` block-style dump. Likely call sites are
 * the Mermaid transform output path in `sequencer.js` and any future fixture
 * regeneration utility.
 *
 * @example
 * const output = ReadableYamlFormatter.format(document, { maxLineLength: 100 });
 */
class ReadableYamlFormatter {
	////////////////////////////////////////////////////////////////////////////
	/**
	 * Format a document using the readable-compaction policy.
	 *
	 * @param {object} document YAML-compatible document object.
	 * @param {{ indent?: number, maxLineLength?: number, maxInlineMappingKeys?: number, maxInlineSequenceItems?: number, inlineOnlyFlatMappings?: boolean, inlineOnlyFlatSequences?: boolean, keepTopLevelBlockStyle?: boolean, keepStructuralListsBlockStyle?: boolean, structuralKeys?: string[], preferBlockScalarsForLongText?: boolean, longTextThreshold?: number, neverInlineNestedCollections?: boolean }} [options={}] Formatting policy overrides.
	 * @returns {string} Formatted YAML document ending with a trailing newline.
	 * @throws {Error} If the document is not a plain object.
	 * @example
	 * const output = ReadableYamlFormatter.format({ title: "Example", version: "1.0" });
	 */
	static format(document, options = {}) {
		////////////////////////////////////////////////////////////////////////////
		// Normalise the caller policy and reject unsupported document roots before
		// the formatter starts building YAML fragments.
		const policy = this._buildPolicy(options);

		if (!this._isPlainObject(document)) {
			throw new Error('ReadableYamlFormatter.format requires a plain object document');
		}

		////////////////////////////////////////////////////////////////////////////
		// Render the top-level document in block style so the outer structure stays
		// easy to scan even when nested nodes are compacted.
		const lines = this._renderMapping(document, 0, [], policy, true);

		return lines.join('\n') + '\n';
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Return the default readable-compaction policy.
	 *
	 * @returns {{ indent: number, maxLineLength: number, maxInlineMappingKeys: number, maxInlineSequenceItems: number, inlineOnlyFlatMappings: boolean, inlineOnlyFlatSequences: boolean, keepTopLevelBlockStyle: boolean, keepStructuralListsBlockStyle: boolean, structuralKeys: string[], preferBlockScalarsForLongText: boolean, longTextThreshold: number, neverInlineNestedCollections: boolean }} Default policy object.
	 * @example
	 * const defaults = ReadableYamlFormatter.getDefaultPolicy();
	 */
	static getDefaultPolicy() {
		////////////////////////////////////////////////////////////////////////////
		// Keep the defaults explicit so future integration can override them
		// selectively without reverse-engineering hidden serializer behaviour.
		return {
			indent: 2,
			maxLineLength: 160,
			maxInlineMappingKeys: 8,
			maxInlineSequenceItems: 8,
			inlineOnlyFlatMappings: false,
			inlineOnlyFlatSequences: true,
			keepTopLevelBlockStyle: true,
			keepStructuralListsBlockStyle: true,
			structuralKeys: [],
			preferBlockScalarsForLongText: true,
			longTextThreshold: 60,
			neverInlineNestedCollections: false,
		};
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Merge caller overrides into the default policy.
	 *
	 * @param {object} options Caller-supplied policy overrides.
	 * @returns {object} Complete policy object.
	 * @throws {Error} If the structural key list is invalid.
	 * @example
	 * const policy = ReadableYamlFormatter._buildPolicy({ maxLineLength: 88 });
	 */
	static _buildPolicy(options) {
		////////////////////////////////////////////////////////////////////////////
		// Start from the formatter defaults and then layer caller overrides while
		// keeping a defensible structural-key list.
		const policy = Object.assign({}, this.getDefaultPolicy(), options);

		if (!Array.isArray(policy.structuralKeys) || !policy.structuralKeys.every((value) => typeof value === 'string' && value.length > 0)) {
			throw new Error('ReadableYamlFormatter._buildPolicy requires structuralKeys to be a non-empty string array');
		}

		policy.indent = Number.isInteger(policy.indent) && policy.indent > 0 ? policy.indent : 2;
		policy.maxLineLength = Number.isInteger(policy.maxLineLength) && policy.maxLineLength > 0 ? policy.maxLineLength : 100;
		policy.maxInlineMappingKeys = Number.isInteger(policy.maxInlineMappingKeys) && policy.maxInlineMappingKeys > 0 ? policy.maxInlineMappingKeys : 5;
		policy.maxInlineSequenceItems = Number.isInteger(policy.maxInlineSequenceItems) && policy.maxInlineSequenceItems > 0 ? policy.maxInlineSequenceItems : 6;

		return policy;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Render an object as block-style YAML mapping lines.
	 *
	 * @param {object} value Mapping value to render.
	 * @param {number} depth Zero-based indentation depth.
	 * @param {string[]} keyPath Path leading to the current node.
	 * @param {object} policy Active formatting policy.
	 * @param {boolean} forceBlock True when this mapping must remain block style.
	 * @returns {string[]} YAML lines without a trailing newline.
	 * @example
	 * const lines = ReadableYamlFormatter._renderMapping({ title: "Example" }, 0, [], policy, true);
	 */
	static _renderMapping(value, depth, keyPath, policy, forceBlock) {
		////////////////////////////////////////////////////////////////////////////
		// Inline only when the mapping is structurally simple and the policy allows
		// it; otherwise emit block entries one by one.
		if (!forceBlock) {
			const inlineValue = this._renderInlineValue(value, depth, keyPath, 0, policy);
			if (inlineValue !== null) {
				return [inlineValue];
			}
		}

		const lines = [];
		const keys = Object.keys(value);

		for (const key of keys) {
			lines.push(...this._renderCommentLines(this._getMappingEntryComments(value, key), depth, policy));
			lines.push(...this._renderMappingEntry(key, value[key], depth, keyPath.concat(key), policy));
		}

		lines.push(...this._renderCommentLines(this._getTrailingComments(value), depth, policy));

		return lines;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Render one mapping entry at the current indentation depth.
	 *
	 * @param {string} key Mapping key.
	 * @param {*} value Mapping value.
	 * @param {number} depth Zero-based indentation depth.
	 * @param {string[]} keyPath Full key path including the current key.
	 * @param {object} policy Active formatting policy.
	 * @returns {string[]} YAML lines for the entry.
	 * @throws {Error} If the value type is unsupported.
	 * @example
	 * const lines = ReadableYamlFormatter._renderMappingEntry("title", "Example", 0, ["title"], policy);
	 */
	static _renderMappingEntry(key, value, depth, keyPath, policy) {
		////////////////////////////////////////////////////////////////////////////
		// Scalars can stay on the same line unless `js-yaml` decides they need a
		// folded or literal block style.
		const indent = this._repeatSpace(depth * policy.indent);

		if (this._isScalar(value)) {
			const scalarLines = this._renderScalarLines(value, policy);

			if (scalarLines.length === 1) {
				return [`${indent}${key}: ${scalarLines[0]}`];
			}

			return [`${indent}${key}: ${scalarLines[0]}`, ...scalarLines.slice(1).map((line) => `${indent}${line}`)];
		}

		////////////////////////////////////////////////////////////////////////////
		// Collections are first tested for inline suitability with the current key
		// prefix included in the line-length calculation.
		if (Array.isArray(value) || this._isPlainObject(value)) {
			const inlineValue = this._renderInlineValue(value, depth, keyPath, key.length + 2, policy);

			if (inlineValue !== null) {
				return [`${indent}${key}: ${inlineValue}`];
			}

			const childLines = Array.isArray(value) ? this._renderSequence(value, depth + 1, keyPath, policy, true) : this._renderMapping(value, depth + 1, keyPath, policy, true);
			if (childLines.length === 0) {
				return [`${indent}${key}: ${Array.isArray(value) ? '[]' : '{}'}`];
			}

			return [`${indent}${key}:`, ...childLines];
		}

		throw new Error(`ReadableYamlFormatter._renderMappingEntry cannot render key '${key}' with unsupported value type`);
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Render an array as block-style YAML sequence lines.
	 *
	 * @param {Array} value Sequence value to render.
	 * @param {number} depth Zero-based indentation depth.
	 * @param {string[]} keyPath Path leading to the current sequence.
	 * @param {object} policy Active formatting policy.
	 * @param {boolean} forceBlock True when the sequence must remain block style.
	 * @returns {string[]} YAML lines without a trailing newline.
	 * @example
	 * const lines = ReadableYamlFormatter._renderSequence([1, 2], 1, ["lineDash"], policy, true);
	 */
	static _renderSequence(value, depth, keyPath, policy, forceBlock) {
		////////////////////////////////////////////////////////////////////////////
		// Inline only when the sequence is small, flat, and comfortably fits on one
		// line; otherwise emit one sequence item per visual row.
		if (!forceBlock) {
			const inlineValue = this._renderInlineValue(value, depth, keyPath, 0, policy);
			if (inlineValue !== null) {
				return [inlineValue];
			}
		}

		const indent = this._repeatSpace(depth * policy.indent);
		const lines = [];

		for (let index = 0; index < value.length; index++) {
			const item = value[index];
			lines.push(...this._renderCommentLines(this._getSequenceItemComments(value, item, index), depth, policy));

			if (this._isScalar(item)) {
				const scalarLines = this._renderScalarLines(item, policy);

				if (scalarLines.length === 1) {
					lines.push(`${indent}- ${scalarLines[0]}`);
				} else {
					lines.push(`${indent}- ${scalarLines[0]}`);
					lines.push(...scalarLines.slice(1).map((line) => `${indent}${line}`));
				}

				continue;
			}

			const inlineValue = this._renderInlineValue(item, depth, keyPath, 2, policy);
			if (inlineValue !== null) {
				lines.push(`${indent}- ${inlineValue}`);
				continue;
			}

			if (this._isPlainObject(item)) {
				lines.push(...this._renderBlockMappingSequenceItem(item, depth, keyPath, policy));
				continue;
			}

			if (Array.isArray(item)) {
				lines.push(`${indent}-`);
				lines.push(...this._renderSequence(item, depth + 1, keyPath, policy, true));
				continue;
			}

			throw new Error('ReadableYamlFormatter._renderSequence cannot render an unsupported sequence item');
		}

		return lines;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Render YAML comment lines at the current indentation depth.
	 *
	 * @param {string[]|undefined} comments Comment text lines.
	 * @param {number} depth Zero-based indentation depth.
	 * @param {object} policy Active formatting policy.
	 * @returns {string[]} YAML comment lines.
	 * @example
	 * const lines = ReadableYamlFormatter._renderCommentLines(["Comment"], 1, policy);
	 */
	static _renderCommentLines(comments, depth, policy) {
		if (!Array.isArray(comments) || comments.length === 0) {
			return [];
		}

		const indent = this._repeatSpace(depth * policy.indent);
		const renderedLines = [];

		comments.forEach((comment) => {
			const commentText = typeof comment === 'string' ? comment : '';
			const segments = commentText.split('\n');
			if (segments.length === 0) {
				renderedLines.push(`${indent}#`);
				return;
			}
			segments.forEach((segment) => {
				renderedLines.push(segment.length > 0 ? `${indent}# ${segment}` : `${indent}#`);
			});
		});

		return renderedLines;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Return leading comments attached to a mapping entry.
	 *
	 * @param {object} mapping Mapping object.
	 * @param {string} key Mapping key.
	 * @returns {string[]} Attached comments, if any.
	 * @example
	 * const comments = ReadableYamlFormatter._getMappingEntryComments(document, "lines");
	 */
	static _getMappingEntryComments(mapping, key) {
		if (!this._isPlainObject(mapping) || typeof key !== 'string') {
			return [];
		}

		const entryComments = mapping.__yamlEntryComments;
		if (!entryComments || typeof entryComments !== 'object') {
			return [];
		}

		return Array.isArray(entryComments[key]) ? entryComments[key] : [];
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Return leading comments attached to one sequence item.
	 *
	 * @param {Array} sequence Parent sequence.
	 * @param {*} item Sequence item.
	 * @param {number} index Sequence index.
	 * @returns {string[]} Attached comments, if any.
	 * @example
	 * const comments = ReadableYamlFormatter._getSequenceItemComments(lines, lines[0], 0);
	 */
	static _getSequenceItemComments(sequence, item, index) {
		if (item && typeof item === 'object' && Array.isArray(item.__yamlLeadingComments)) {
			return item.__yamlLeadingComments;
		}

		if (!Array.isArray(sequence) || !sequence.__yamlItemComments || typeof sequence.__yamlItemComments !== 'object') {
			return [];
		}

		return Array.isArray(sequence.__yamlItemComments[index]) ? sequence.__yamlItemComments[index] : [];
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Return trailing comments attached to a collection.
	 *
	 * @param {*} value Mapping or sequence value.
	 * @returns {string[]} Attached trailing comments, if any.
	 * @example
	 * const comments = ReadableYamlFormatter._getTrailingComments(document);
	 */
	static _getTrailingComments(value) {
		if (!value || typeof value !== 'object' || !Array.isArray(value.__yamlTrailingComments)) {
			return [];
		}

		return value.__yamlTrailingComments;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Render a block mapping as a sequence item while keeping the first property on the dash line.
	 *
	 * @param {object} value Mapping sequence item.
	 * @param {number} depth Zero-based indentation depth of the sequence item.
	 * @param {string[]} keyPath Path leading to the sequence item.
	 * @param {object} policy Active formatting policy.
	 * @returns {string[]} YAML lines for the sequence item.
	 * @example
	 * const lines = ReadableYamlFormatter._renderBlockMappingSequenceItem({ type: "call" }, 1, ["lines"], policy);
	 */
	static _renderBlockMappingSequenceItem(value, depth, keyPath, policy) {
		////////////////////////////////////////////////////////////////////////////
		// Render the mapping at the sequence depth, then re-home the first property
		// onto the dash line and indent the remaining properties one level deeper.
		const indent = this._repeatSpace(depth * policy.indent);
		const mappingLines = this._renderMapping(value, depth, keyPath, policy, true);

		if (mappingLines.length === 0) {
			return [`${indent}- {}`];
		}

		const firstContent = mappingLines[0].slice(indent.length);
		const renderedLines = [`${indent}- ${firstContent}`];

		for (const line of mappingLines.slice(1)) {
			renderedLines.push(`${indent}${this._repeatSpace(policy.indent)}${line.slice(indent.length)}`);
		}

		return renderedLines;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Return an inline representation for a scalar or compact collection, or null when block style is required.
	 *
	 * @param {*} value Value to consider for inline output.
	 * @param {number} depth Zero-based indentation depth.
	 * @param {string[]} keyPath Path leading to the current node.
	 * @param {number} prefixLength Additional characters already present on the line.
	 * @param {object} policy Active formatting policy.
	 * @returns {string|null} Inline YAML snippet, or null when block style is preferred.
	 * @example
	 * const inline = ReadableYamlFormatter._renderInlineValue([4, 2], 1, ["lineDash"], 10, policy);
	 */
	static _renderInlineValue(value, depth, keyPath, prefixLength, policy) {
		////////////////////////////////////////////////////////////////////////////
		// Scalars can use inline output only when `js-yaml` keeps them on one line;
		// collections also need to satisfy the policy heuristics.
		if (this._isScalar(value)) {
			const scalarLines = this._renderScalarLines(value, policy);

			if (scalarLines.length !== 1) {
				return null;
			}

			return this._fitsWithinLineLimit(scalarLines[0], depth, prefixLength, policy) ? scalarLines[0] : null;
		}

		if (Array.isArray(value) && this._shouldInlineSequence(value, depth, keyPath, prefixLength, policy)) {
			const rendered = this._renderInlineCollection(value, policy);
			return this._fitsWithinLineLimit(rendered, depth, prefixLength, policy) ? rendered : null;
		}

		if (this._isPlainObject(value) && this._shouldInlineMapping(value, depth, keyPath, prefixLength, policy)) {
			const rendered = this._renderInlineCollection(value, policy);
			return this._fitsWithinLineLimit(rendered, depth, prefixLength, policy) ? rendered : null;
		}

		return null;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Decide whether a mapping is eligible for inline flow style.
	 *
	 * @param {object} value Mapping value.
	 * @param {number} depth Zero-based indentation depth.
	 * @param {string[]} keyPath Path leading to the current node.
	 * @param {number} prefixLength Additional characters already present on the line.
	 * @param {object} policy Active formatting policy.
	 * @returns {boolean} True when the mapping should be rendered inline.
	 * @example
	 * const yes = ReadableYamlFormatter._shouldInlineMapping({ name: "Caller" }, 1, ["actors"], 2, policy);
	 */
	static _shouldInlineMapping(value, depth, keyPath, prefixLength, policy) {
		////////////////////////////////////////////////////////////////////////////
		// Respect structural block-style boundaries first, then limit inlining to
		// small flat mappings that fit within the configured line length.
		const keys = Object.keys(value);
		const lastKey = keyPath.length > 0 ? keyPath[keyPath.length - 1] : undefined;

		if ((depth === 0 && policy.keepTopLevelBlockStyle) || (policy.keepStructuralListsBlockStyle && policy.structuralKeys.includes(lastKey))) {
			return false;
		}

		if (keys.length === 0 || keys.length > policy.maxInlineMappingKeys) {
			return false;
		}

		if (policy.inlineOnlyFlatMappings && keys.some((key) => this._isCollection(value[key]))) {
			return false;
		}

		if (policy.neverInlineNestedCollections && keys.some((key) => this._isCollection(value[key]))) {
			return false;
		}

		const rendered = this._renderInlineCollection(value, policy);

		return this._fitsWithinLineLimit(rendered, depth, prefixLength, policy);
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Decide whether a sequence is eligible for inline flow style.
	 *
	 * @param {Array} value Sequence value.
	 * @param {number} depth Zero-based indentation depth.
	 * @param {string[]} keyPath Path leading to the current node.
	 * @param {number} prefixLength Additional characters already present on the line.
	 * @param {object} policy Active formatting policy.
	 * @returns {boolean} True when the sequence should be rendered inline.
	 * @example
	 * const yes = ReadableYamlFormatter._shouldInlineSequence([4, 2], 1, ["lineDash"], 10, policy);
	 */
	static _shouldInlineSequence(value, depth, keyPath, prefixLength, policy) {
		////////////////////////////////////////////////////////////////////////////
		// Whole-sequence flow style is reserved for small scalar sequences so
		// structural lists like `lines` remain vertically readable.
		const lastKey = keyPath.length > 0 ? keyPath[keyPath.length - 1] : undefined;

		if ((depth === 0 && policy.keepTopLevelBlockStyle) || (policy.keepStructuralListsBlockStyle && policy.structuralKeys.includes(lastKey))) {
			return false;
		}

		if (value.length === 0 || value.length > policy.maxInlineSequenceItems) {
			return false;
		}

		if (policy.inlineOnlyFlatSequences && value.some((item) => !this._isScalar(item))) {
			return false;
		}

		if (policy.neverInlineNestedCollections && value.some((item) => this._isCollection(item))) {
			return false;
		}

		const rendered = this._renderInlineCollection(value, policy);

		return this._fitsWithinLineLimit(rendered, depth, prefixLength, policy);
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Render a scalar using `js-yaml` so quoting and block-scalar choices stay valid.
	 *
	 * @param {*} value Scalar value.
	 * @param {object} policy Active formatting policy.
	 * @returns {string[]} YAML scalar lines without a trailing newline.
	 * @throws {Error} If the scalar is undefined or unsupported.
	 * @example
	 * const lines = ReadableYamlFormatter._renderScalarLines("example", policy);
	 */
	static _renderScalarLines(value, policy) {
		////////////////////////////////////////////////////////////////////////////
		// Delegate scalar quoting and block-style selection to `js-yaml`, but force
		// long prose into block form when the readable-compaction policy asks for it.
		if (typeof value === 'undefined') {
			throw new Error('ReadableYamlFormatter._renderScalarLines cannot render undefined values');
		}

		let rendered = yaml.safeDump(value, {
			indent: policy.indent,
			lineWidth: policy.maxLineLength,
			noRefs: true,
		});

		if (policy.preferBlockScalarsForLongText === true && typeof value === 'string' && value.length > policy.longTextThreshold && !value.includes('\n') && rendered.indexOf('\n') === rendered.trimEnd().lastIndexOf('\n')) {
			rendered = yaml.safeDump(value, {
				indent: policy.indent,
				lineWidth: Math.min(policy.maxLineLength, policy.longTextThreshold),
				noRefs: true,
			});
		}

		return rendered.trimEnd().split('\n');
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Render an object or array in flow style.
	 *
	 * @param {object|Array} value Collection value.
	 * @param {object} policy Active formatting policy.
	 * @returns {string} Single-line flow-style YAML.
	 * @example
	 * const rendered = ReadableYamlFormatter._renderInlineCollection([4, 2], policy);
	 */
	static _renderInlineCollection(value, policy) {
		////////////////////////////////////////////////////////////////////////////
		// Use `js-yaml` flow mode for correctness and keep spaces in the flow output
		// because this helper optimises for readability rather than byte count.
		return yaml
			.safeDump(value, {
				indent: policy.indent,
				flowLevel: 0,
				lineWidth: -1,
				condenseFlow: false,
				noRefs: true,
			})
			.trimEnd();
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Return whether a rendered fragment fits on the configured line.
	 *
	 * @param {string} rendered Candidate YAML fragment.
	 * @param {number} depth Zero-based indentation depth.
	 * @param {number} prefixLength Additional characters already present on the line.
	 * @param {object} policy Active formatting policy.
	 * @returns {boolean} True when the line stays within the configured limit.
	 * @example
	 * const fits = ReadableYamlFormatter._fitsWithinLineLimit("[4, 2]", 1, 10, policy);
	 */
	static _fitsWithinLineLimit(rendered, depth, prefixLength, policy) {
		////////////////////////////////////////////////////////////////////////////
		// Count indentation plus the already-emitted line prefix so inline decisions
		// honour the configured maximum line length.
		const lineLength = depth * policy.indent + prefixLength + rendered.length;

		return lineLength <= policy.maxLineLength;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Return whether a value is a scalar YAML value.
	 *
	 * @param {*} value Value to inspect.
	 * @returns {boolean} True when the value is a scalar.
	 * @example
	 * const yes = ReadableYamlFormatter._isScalar("hello");
	 */
	static _isScalar(value) {
		////////////////////////////////////////////////////////////////////////////
		// Treat null as scalar and leave objects plus arrays to the structural
		// rendering logic.
		return value === null || ['string', 'number', 'boolean'].includes(typeof value);
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Return whether a value is a collection that may need block rendering.
	 *
	 * @param {*} value Value to inspect.
	 * @returns {boolean} True when the value is an array or plain object.
	 * @example
	 * const yes = ReadableYamlFormatter._isCollection({ key: "value" });
	 */
	static _isCollection(value) {
		////////////////////////////////////////////////////////////////////////////
		// Limit collection detection to the YAML structures this helper supports.
		return Array.isArray(value) || this._isPlainObject(value);
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Return whether a value is a plain object.
	 *
	 * @param {*} value Value to inspect.
	 * @returns {boolean} True when the value is a plain object.
	 * @example
	 * const yes = ReadableYamlFormatter._isPlainObject({ key: "value" });
	 */
	static _isPlainObject(value) {
		////////////////////////////////////////////////////////////////////////////
		// Exclude arrays and class instances so the formatter fails fast on inputs
		// outside the supported YAML document shape.
		return value !== null && typeof value === 'object' && Array.isArray(value) === false && Object.getPrototypeOf(value) === Object.prototype;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Create a space-only indentation prefix.
	 *
	 * @param {number} length Number of spaces.
	 * @returns {string} Space prefix.
	 * @example
	 * const indent = ReadableYamlFormatter._repeatSpace(4);
	 */
	static _repeatSpace(length) {
		////////////////////////////////////////////////////////////////////////////
		// Keep indentation generation central so the rest of the formatter can work
		// in terms of logical depth rather than string literals.
		return ' '.repeat(length);
	}
}

module.exports = {
	ReadableYamlFormatter,
};
