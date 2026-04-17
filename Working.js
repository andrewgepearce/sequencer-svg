// Copyright (C) 2019 Mark The Page

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.

// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

let Utilities = require("./Utilities.js");

/**
 * Class to provide stateful working parameters as the post data is parsed
 *
 * @class Working
 */
module.exports = class Working {
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Initialise the Working instance.
	 *
	 * @param {*} fontManager Parameter derived from fontManager.
	 * @returns {void} Nothing.
	 * @example
	 * const instance = new Working(fontManager);
	 */
	constructor(fontManager) {
		this._postdata = null;
		this._globalSpacing = null;
		this._windowPadding = null;
		this._maxWidth = -1;
		this._maxHeight = -1;
		this._canvasWidth = 0;
		this._canvasHeight = 0;
		this._scratchPad = {};
		this._maxFragDepth = 0;
		this._fragmentSpacing = 0;
		this._startX = 0;
		this._startY = 0;
		this._actorSpacing = 0;
		this._timelineDash = [3, 3];
		this._activeFragments = [];
		this._callCount = 0;
		this._negativeX = 0;
		this._id = undefined;
		this._debug = false;
		this._tags = [];
		this._fontManager = fontManager;
		this._seenWarningMessages = new Set();
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return tags.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.tags;
	 */
	get tags() {
		return this._tags;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Update tags.
	 *
	 * @param {*} value Parameter derived from value.
	 * @returns {void} Nothing.
	 * @example
	 * instance.tags = value;
	 */
	set tags(value) {
		this._tags = value;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return id.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.id;
	 */
	get id() {
		return this._id;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Update id.
	 *
	 * @param {*} value Parameter derived from value.
	 * @returns {void} Nothing.
	 * @example
	 * instance.id = value;
	 */
	set id(value) {
		this._id = value;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return negative x.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.negativeX;
	 */
	get negativeX() {
		return this._negativeX;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Update negative x.
	 *
	 * @param {*} value Parameter derived from value.
	 * @returns {void} Nothing.
	 * @example
	 * instance.negativeX = value;
	 */
	set negativeX(value) {
		this._negativeX = value;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return debug.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.debug;
	 */
	get debug() {
		return this._debug;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Update debug.
	 *
	 * @param {*} value Parameter derived from value.
	 * @returns {void} Nothing.
	 * @example
	 * instance.debug = value;
	 */
	set debug(value) {
		this._debug = value;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return call count.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.callCount;
	 */
	get callCount() {
		return this._callCount;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Update call count.
	 *
	 * @param {*} value Parameter derived from value.
	 * @returns {void} Nothing.
	 * @example
	 * instance.callCount = value;
	 */
	set callCount(value) {
		this._callCount = value;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return active fragments.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.activeFragments;
	 */
	get activeFragments() {
		return this._activeFragments;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return timeline dash.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.timelineDash;
	 */
	get timelineDash() {
		return this._timelineDash;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return max width.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.maxWidth;
	 */
	get maxWidth() {
		return this._maxWidth;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Update max width.
	 *
	 * @param {*} value Parameter derived from value.
	 * @returns {void} Nothing.
	 * @example
	 * instance.maxWidth = value;
	 */
	set maxWidth(value) {
		this._maxWidth = value;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return max height.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.maxHeight;
	 */
	get maxHeight() {
		return this._maxHeight;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Update max height.
	 *
	 * @param {*} value Parameter derived from value.
	 * @returns {void} Nothing.
	 * @example
	 * instance.maxHeight = value;
	 */
	set maxHeight(value) {
		this._maxHeight = value;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return actor spacing.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.actorSpacing;
	 */
	get actorSpacing() {
		return this._actorSpacing;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return start y.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.startY;
	 */
	get startY() {
		return this._startY;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return start x.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.startX;
	 */
	get startX() {
		return this._startX;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return fragment spacing.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.fragmentSpacing;
	 */
	get fragmentSpacing() {
		return this._fragmentSpacing;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return max frag depth.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.maxFragDepth;
	 */
	get maxFragDepth() {
		return this._maxFragDepth;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return scratch pad.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.scratchPad;
	 */
	get scratchPad() {
		return this._scratchPad;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return postdata.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.postdata;
	 */
	get postdata() {
		return this._postdata;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Update postdata.
	 *
	 * @param {*} value Parameter derived from value.
	 * @returns {void} Nothing.
	 * @example
	 * instance.postdata = value;
	 */
	set postdata(value) {
		this._postdata = value;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return global spacing.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.globalSpacing;
	 */
	get globalSpacing() {
		return this._globalSpacing;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return canvas width.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.canvasWidth;
	 */
	get canvasWidth() {
		return this._canvasWidth;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Update canvas width.
	 *
	 * @param {*} value Parameter derived from value.
	 * @returns {void} Nothing.
	 * @example
	 * instance.canvasWidth = value;
	 */
	set canvasWidth(value) {
		this._canvasWidth = value;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return canvas height.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.canvasHeight;
	 */
	get canvasHeight() {
		return this._canvasHeight;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Update canvas height.
	 *
	 * @param {*} value Parameter derived from value.
	 * @returns {void} Nothing.
	 * @example
	 * instance.canvasHeight = value;
	 */
	set canvasHeight(value) {
		this._canvasHeight = value;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return window padding.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.windowPadding;
	 */
	get windowPadding() {
		return this._windowPadding;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle calculate fragment depth.
	 *
	 * @param {*} lines Parameter derived from lines.
	 * @param {*} reset Parameter derived from reset.
	 * @returns {*} Result value.
	 * @example
	 * instance.calculateFragmentDepth(lines, reset);
	 */
	calculateFragmentDepth(lines, reset) {
		if (typeof this.scratchPad.maxFragmentDepth != "number") {
			this.scratchPad.maxFragmentDepth = 0;
		}
		if (typeof this.scratchPad.curFragmentDepth != "number") {
			this.scratchPad.curFragmentDepth = 0;
		}
		if (!Array.isArray(lines)) {
			return this.scratchPad.maxFragmentDepth;
		}
		if (reset) {
			this.scratchPad.maxFragmentDepth = 0;
			this.scratchPad.curFragmentDepth = 0;
		}
		lines.forEach((line) => {
			if (Utilities.isObject(line) && line.type == "fragment") {
				this.scratchPad.curFragmentDepth++;
				if (this.scratchPad.curFragmentDepth > this.scratchPad.maxFragmentDepth) {
					this.scratchPad.maxFragmentDepth = this.scratchPad.curFragmentDepth;
				}
				this.calculateFragmentDepth(line.lines, false);
				this.scratchPad.curFragmentDepth--;
			}
		});
		return this.scratchPad.maxFragmentDepth;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Initialise the working state for a render pass.
	 * @returns {*} Result value.
	 * @example
	 * instance.init();
	 */
	init() {
		if (typeof this.postdata != "object" || this.postdata == null) {
			this.postdata = {};
		}
		if (typeof this.postdata.params != "object" || this.postdata.params == null) {
			this.postdata.params = {};
		}
		if (!Array.isArray(this.postdata.lines)) {
			this.postdata.lines = [];
		}
		this._canvasWidth = 0;
		this._canvasHeight = 0;
		this._maxWidth = 0;
		this._maxHeight = 0;
		this._globalSpacing =
			Utilities.isNumber(this.postdata.params.globalSpacing) && this.postdata.params.globalSpacing >= 0
				? this.postdata.params.globalSpacing
				: 30;
		this._windowPadding =
			Utilities.isNumber(this.postdata.params.windowPadding) && this.postdata.params.windowPadding >= 0
				? this.postdata.params.windowPadding
				: this._globalSpacing;
		this._fragmentSpacing =
			this.postdata.params.fragment &&
			Utilities.isNumber(this.postdata.params.fragment.fragmentSpacing) &&
			this.postdata.params.fragmentSpacing >= 0
				? this.postdata.params.fragment.fragmentSpacing
				: this._globalSpacing;
		this._maxFragDepth = this.calculateFragmentDepth(this.postdata.lines, true);
		let shiftToTheRight = this._negativeX < 0 ? -this._negativeX + this._windowPadding : 0;
		this._startX =
			this._windowPadding + shiftToTheRight + (Utilities.isNumber(this._maxFragDepth) ? this._maxFragDepth * this._fragmentSpacing : 0);
		this._startY = this._windowPadding;
		this._actorSpacing =
			Utilities.isNumber(this.postdata.params.actorSpacing) && this.postdata.params.actorSpacing >= 0
				? this.postdata.params.actorSpacing
				: 150;
		this._tags = Utilities.isAllStrings(this.postdata.params.tags) ? this.postdata.params.tags : [];
		if (this.tags.length > 0) {
			this.logDebug("Using tags array of " + this.tags);
		}
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle manage max width.
	 *
	 * @param {*} maxx Parameter derived from maxx.
	 * @param {*} maxy Parameter derived from maxy.
	 * @returns {*} Result value.
	 * @example
	 * instance.manageMaxWidth(maxx, maxy);
	 */
	manageMaxWidth(maxx, maxy) {
		if (Utilities.isNumber(maxx)) this._maxWidth = maxx > this._maxWidth ? maxx : this._maxWidth;
		if (Utilities.isNumber(maxy)) this._maxHeight = maxy > this._maxHeight ? maxy : this._maxHeight;
		return {
			x: maxx,
			y: maxy,
		};
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle manage max width xy.
	 *
	 * @param {*} xy Parameter derived from xy.
	 * @returns {*} Result value.
	 * @example
	 * instance.manageMaxWidthXy(xy);
	 */
	manageMaxWidthXy(xy) {
		return this.manageMaxWidth(xy.x, xy.y);
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Update or expose debug behaviour for the current instance.
	 * @returns {*} Result value.
	 * @example
	 * instance.debug();
	 */
	debug() {
		return this._debug;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle is valid font.
	 *
	 * @param {*} fontname Parameter derived from fontname.
	 * @returns {*} Result value.
	 * @example
	 * instance.isValidFont(fontname);
	 */
	isValidFont(fontname) {
		return this._fontManager.isValidFont(fontname);
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle log info.
	 *
	 * @param {*} message Parameter derived from message.
	 * @returns {*} Result value.
	 * @example
	 * instance.logInfo(message);
	 */
	logInfo(message) {
		if (typeof message != "string") return;
		message = typeof this.id == "string" ? this.id + " : " + message : message;
		this.logger != undefined
			? this.logger.info(message)
			: console.error(
					JSON.stringify({
						date: new Date().toISOString(),
						level: "info",
						message: message,
					})
			  );
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle log debug.
	 *
	 * @param {*} message Parameter derived from message.
	 * @returns {*} Result value.
	 * @example
	 * instance.logDebug(message);
	 */
	logDebug(message) {
		if (typeof message != "string") return;
		if (!this.debug) return;
		message = typeof this.id == "string" ? this.id + " : " + message : message;
		this.logger != undefined
			? this.logger.debug(message)
			: console.error(
					JSON.stringify({
						date: new Date().toISOString(),
						level: "debug",
						message: message,
					})
			  );
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle log error.
	 *
	 * @param {*} message Parameter derived from message.
	 * @returns {*} Result value.
	 * @example
	 * instance.logError(message);
	 */
	logError(message) {
		if (typeof message != "string") return;
		message = typeof this.id == "string" ? this.id + " : " + message : message;
		this.logger != undefined
			? this.logger.error(message)
			: console.error(
					JSON.stringify({
						date: new Date().toISOString(),
						level: "error",
						message: message,
					})
			  );
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle log warn.
	 *
	 * @param {*} message Parameter derived from message.
	 * @returns {*} Result value.
	 * @example
	 * instance.logWarn(message);
	 */
	logWarn(message) {
		if (typeof message != "string") return;
		message = typeof this.id == "string" ? this.id + " : " + message : message;
		this.logger != undefined
			? this.logger.warning(message)
			: console.error(
					JSON.stringify({
						date: new Date().toISOString(),
						level: "warning",
						message: message,
					})
			  );
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle reset seen warnings.
	 * @returns {*} Result value.
	 * @example
	 * instance.resetSeenWarnings();
	 */
	resetSeenWarnings() {
		this._seenWarningMessages.clear();
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle log warn once.
	 *
	 * @param {*} message Parameter derived from message.
	 * @returns {*} Result value.
	 * @example
	 * instance.logWarnOnce(message);
	 */
	logWarnOnce(message) {
		if (typeof message != "string") return;
		if (this._seenWarningMessages.has(message)) return;
		this._seenWarningMessages.add(message);
		this.logWarn(message);
	}
};
