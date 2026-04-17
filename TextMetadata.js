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

let Utilities = require("./Utilities.js");

//////////////////////////////////////////////////////////////////////////////
/**
 * Hold the resolved text-rendering settings for titles, comments, calls, and
 * other text rectangles. Instantiated in `TextMetadata.getTextMetadataFromObject`
 * and consumed by `Utilities.getTextWidthAndHeight` and
 * `Utilities.drawTextRectangleNoBorderOrBg`.
 *
 * @example
 * const tmd = new TextMetadata("sans-serif", 14, 10, 1.2, "black", "white");
 */
module.exports = class TextMetadata {
	////////////////////////////////////////////////////////////////////////////
	/**
	 * Create a text-metadata instance with validated values and fallback
	 * defaults.
	 *
	 * @param {string} fontFamily Font family name.
	 * @param {number} fontSizePx Font size in pixels.
	 * @param {number} padding Horizontal padding in pixels.
	 * @param {number} spacing Line spacing multiplier.
	 * @param {string} fgColour Text colour.
	 * @param {string} bgColour Background colour.
	 * @param {string} align Text alignment.
	 * @param {string} borderColour Border colour.
	 * @param {number} borderWidth Border width in pixels.
	 * @param {number[]} borderDash Dash pattern for the border.
	 * @param {number|undefined} vpadding Vertical padding override.
	 * @returns {void} Nothing.
	 * @example
	 * const tmd = new TextMetadata("serif", 12, 8, 1, "black", "white", "left");
	 */
	constructor(fontFamily, fontSizePx, padding, spacing, fgColour, bgColour, align, borderColour, borderWidth, borderDash, vpadding) {
		this._fontFamily = Utilities.isString(fontFamily) ? fontFamily : "serif";
		this._fontSizePx = Utilities.isNumber(fontSizePx) && fontSizePx > 0 ? fontSizePx : 10;
		this._padding = Utilities.isNumber(padding) && padding > 0 ? padding : 0;
		this._vpadding = Utilities.isNumber(vpadding) && vpadding >= 0 ? vpadding : undefined;
		this._spacing = Utilities.isNumber(spacing) && spacing > 0 ? spacing : 1;
		this._fgColour = Utilities.validColour(fgColour) ? fgColour : "rgb(0,0,0)";
		this._bgColour = Utilities.validColour(bgColour) ? bgColour : "rgba(255,255,255,0)";
		this._align = Utilities.isString(align) ? align : "left";
		this._borderColour = Utilities.validColour(borderColour) ? borderColour : "rgb(0,0,0)";
		this._borderWidth = Utilities.isNumber(borderWidth) && borderWidth >= 0 ? borderWidth : 1;
		this._borderDash = Array.isArray(borderDash) ? borderDash : [];
		this._bold = false;
		this._italic = false;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Return the resolved font family.
	 *
	 * @returns {string} Font family name.
	 * @example
	 * const family = tmd.fontFamily;
	 */
	get fontFamily() {
		return this._fontFamily;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Return the resolved font size.
	 *
	 * @returns {number} Font size in pixels.
	 * @example
	 * const size = tmd.fontSizePx;
	 */
	get fontSizePx() {
		return this._fontSizePx;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Return the horizontal padding value.
	 *
	 * @returns {number} Padding in pixels.
	 * @example
	 * const padding = tmd.padding;
	 */
	get padding() {
		return this._padding;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Return the optional vertical padding override.
	 *
	 * @returns {number|undefined} Vertical padding in pixels.
	 * @example
	 * const vpadding = tmd.vpadding;
	 */
	get vpadding() {
		return this._vpadding;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Return the line spacing multiplier.
	 *
	 * @returns {number} Line spacing multiplier.
	 * @example
	 * const spacing = tmd.spacing;
	 */
	get spacing() {
		return this._spacing;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Return the foreground colour.
	 *
	 * @returns {string} Text colour.
	 * @example
	 * const colour = tmd.fgColour;
	 */
	get fgColour() {
		return this._fgColour;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Update the foreground colour.
	 *
	 * @param {string} value New foreground colour.
	 * @returns {void} Nothing.
	 * @example
	 * tmd.fgColour = "rgb(0,0,0)";
	 */
	set fgColour(value) {
		this._fgColour = value;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Return the background colour.
	 *
	 * @returns {string} Background colour.
	 * @example
	 * const colour = tmd.bgColour;
	 */
	get bgColour() {
		return this._bgColour;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Update the background colour.
	 *
	 * @param {string} value New background colour.
	 * @returns {void} Nothing.
	 * @example
	 * tmd.bgColour = "rgba(255,255,255,0)";
	 */
	set bgColour(value) {
		this._bgColour = value;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Return the alignment setting.
	 *
	 * @returns {string} Alignment string.
	 * @example
	 * const align = tmd.align;
	 */
	get align() {
		return this._align;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Update the alignment when the input is a string.
	 *
	 * @param {string} alignstr New alignment.
	 * @returns {void} Nothing.
	 * @example
	 * tmd.align = "centre";
	 */
	set align(alignstr) {
		if (Utilities.isString(alignstr)) this._align = alignstr;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Update the padding when the input is numeric.
	 *
	 * @param {number} p New padding value.
	 * @returns {void} Nothing.
	 * @example
	 * tmd.padding = 12;
	 */
	set padding(p) {
		if (Utilities.isNumber(p)) this._padding = p;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Update the vertical padding when the input is numeric.
	 *
	 * @param {number} value New vertical padding value.
	 * @returns {void} Nothing.
	 * @example
	 * tmd.vpadding = 6;
	 */
	set vpadding(value) {
		if (Utilities.isNumber(value)) this._vpadding = value;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Return the border colour.
	 *
	 * @returns {string} Border colour.
	 * @example
	 * const border = tmd.borderColour;
	 */
	get borderColour() {
		return this._borderColour;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Update the border colour when the input is a string.
	 *
	 * @param {string} value New border colour.
	 * @returns {void} Nothing.
	 * @example
	 * tmd.borderColour = "rgb(0,0,0)";
	 */
	set borderColour(value) {
		if (typeof value == "string") this._borderColour = value;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Return the border width.
	 *
	 * @returns {number} Border width in pixels.
	 * @example
	 * const width = tmd.borderWidth;
	 */
	get borderWidth() {
		return this._borderWidth;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Update the border width when the input is numeric and non-negative.
	 *
	 * @param {number} value New border width.
	 * @returns {void} Nothing.
	 * @example
	 * tmd.borderWidth = 2;
	 */
	set borderWidth(value) {
		if (typeof value == "number" && value >= 0) this._borderWidth = value;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Return the border dash pattern.
	 *
	 * @returns {number[]} Border dash array.
	 * @example
	 * const dash = tmd.borderDash;
	 */
	get borderDash() {
		return this._borderDash;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Update the border dash pattern when the input is an array.
	 *
	 * @param {number[]} value New dash pattern.
	 * @returns {void} Nothing.
	 * @example
	 * tmd.borderDash = [4, 2];
	 */
	set borderDash(value) {
		if (Array.isArray(value)) this._borderDash = value;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Update the bold flag.
	 *
	 * @param {boolean} value New bold flag.
	 * @returns {void} Nothing.
	 * @example
	 * tmd.bold = true;
	 */
	set bold(value) {
		if (value === true || value === false) this._bold = value;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Return the bold flag.
	 *
	 * @returns {boolean} True when bold text should be used.
	 * @example
	 * const bold = tmd.bold;
	 */
	get bold() {
		return this._bold;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Update the italic flag.
	 *
	 * @param {boolean} value New italic flag.
	 * @returns {void} Nothing.
	 * @example
	 * tmd.italic = true;
	 */
	set italic(value) {
		if (value === true || value === false) this._italic = value;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Return the italic flag.
	 *
	 * @returns {boolean} True when italic text should be used.
	 * @example
	 * const italic = tmd.italic;
	 */
	get italic() {
		return this._italic;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Reduce a string to the supplied width budget using the shared utilities
	 * helper.
	 *
	 * @param {object} ctx Drawing context.
	 * @param {string} str Source string.
	 * @param {number} plannedWidth Width budget in pixels.
	 * @returns {string} Trimmed string.
	 * @throws {ReferenceError} If the legacy `ctsx` variable is unavailable.
	 * @example
	 * const shortened = tmd.reduceStringToFitWidth(ctx, "hello", 80);
	 */
	reduceStringToFitWidth(ctx, str, plannedWidth) {
		return Utilities.reduceStringToFitWidth(ctsx, str, plannedWidth);
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Resolve a new `TextMetadata` instance by merging an explicit object, a
	 * default object, and a final fallback object.
	 *
	 * @param {object} working Shared working context used for font validation.
	 * @param {object} obj Highest-priority source object.
	 * @param {object} defaultObj Default source object.
	 * @param {object} finalFallback Last-resort fallback object.
	 * @returns {TextMetadata} Resolved text metadata.
	 * @example
	 * const tmd = TextMetadata.getTextMetadataFromObject(working, line, params, fallback);
	 */
	static getTextMetadataFromObject(working, obj, defaultObj, finalFallback) {
		////////////////////////////////////////////////////////////////////////////
		// Normalise the inputs so the fallback chain can access properties safely.
		if (obj == null || typeof obj != "object") {
			obj = {};
		}

		if (defaultObj == null || typeof defaultObj != "object") {
			defaultObj = {};
		}

		if (finalFallback == null || typeof finalFallback != "object") {
			finalFallback = {};
		}

		return new TextMetadata(
			working.isValidFont(obj.fontFamily)
				? obj.fontFamily
				: working.isValidFont(defaultObj.fontFamily)
				? defaultObj.fontFamily
				: working.isValidFont(finalFallback.fontFamily)
				? finalFallback.fontFamily
				: "sourceCodePro",
			Utilities.isNumberGt0(obj.fontSizePx)
				? obj.fontSizePx
				: Utilities.isNumberGt0(defaultObj.fontSizePx)
				? defaultObj.fontSizePx
				: Utilities.isNumberGt0(finalFallback.fontSizePx)
				? finalFallback.fontSizePx
				: 10,
			Utilities.isNumberGtEq0(obj.padding)
				? obj.padding
				: Utilities.isNumberGtEq0(defaultObj.padding)
				? defaultObj.padding
				: Utilities.isNumberGtEq0(finalFallback.padding)
				? finalFallback.padding
				: 10,
			Utilities.isNumberGtEq0(obj.spacing)
				? obj.spacing
				: Utilities.isNumberGtEq0(defaultObj.spacing)
				? defaultObj.spacing
				: Utilities.isNumberGtEq0(finalFallback.spacing)
				? finalFallback.spacing
				: 1,
			Utilities.validColour(obj.fgColour)
				? obj.fgColour
				: Utilities.validColour(defaultObj.fgColour)
				? defaultObj.fgColour
				: Utilities.validColour(finalFallback.fgColour)
				? finalFallback.fgColour
				: "rgb(0, 0, 0)",
			Utilities.validColour(obj.bgColour)
				? obj.bgColour
				: Utilities.validColour(defaultObj.bgColour)
				? defaultObj.bgColour
				: Utilities.validColour(finalFallback.bgColour)
				? finalFallback.bgColour
				: "rgba(255,255,255,0)",
			Utilities.isString(obj.align)
				? obj.align
				: Utilities.isString(defaultObj.align)
				? defaultObj.align
				: Utilities.isString(finalFallback.align)
				? finalFallback.align
				: "left",
			Utilities.validColour(obj.borderColour)
				? obj.borderColour
				: Utilities.validColour(defaultObj.borderColour)
				? defaultObj.borderColour
				: Utilities.validColour(finalFallback.borderColour)
				? finalFallback.borderColour
				: "rgba(255,255,255,0)",
			Utilities.isNumberGtEq0(obj.borderWidth)
				? obj.borderWidth
				: Utilities.isNumberGtEq0(defaultObj.borderWidth)
				? defaultObj.borderWidth
				: Utilities.isNumberGtEq0(finalFallback.borderWidth)
				? finalFallback.borderWidth
				: 0,
			Utilities.isAllNumber(obj.borderDash)
				? obj.borderDash
				: Utilities.isAllNumber(defaultObj.borderDash)
				? defaultObj.borderDash
				: Utilities.isAllNumber(finalFallback.borderDash)
				? finalFallback.borderDash
				: [],
			Utilities.isNumberGtEq0(obj.vpadding)
				? obj.vpadding
				: Utilities.isNumberGtEq0(defaultObj.vpadding)
				? defaultObj.vpadding
				: Utilities.isNumberGtEq0(finalFallback.vpadding)
				? finalFallback.vpadding
				: undefined
		);
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Return the project-wide default text metadata object.
	 *
	 * @returns {{
	 *   fontFamily: string,
	 *   fontSizePx: number,
	 *   fgColour: string,
	 *   bgColour: string,
	 *   padding: number,
	 *   spacing: number,
	 *   align: string,
	 *   borderColour: string|null,
	 *   borderWidth: number,
	 *   borderDash: number[],
	 *   vpadding: undefined
	 * }} Default metadata object.
	 * @example
	 * const defaults = TextMetadata.getDefaultTmd();
	 */
	static getDefaultTmd() {
		return {
			fontFamily: "sans-serif",
			fontSizePx: 14,
			fgColour: "rgb(0,0,0)",
			bgColour: "rgba(0,0,0,0)",
			padding: 10,
			spacing: 1.2,
			align: "left",
			borderColour: null,
			borderWidth: 0,
			borderDash: [],
			vpadding: undefined,
		};
	}
};
