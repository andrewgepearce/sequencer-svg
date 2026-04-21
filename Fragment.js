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
let Actor = require("./Actor.js");
let Call = require("./Call.js");
let ReturnCall = require("./ReturnCall.js");
let State = require("./State.js");
let TextMetadata = require("./TextMetadata.js");
let Comment = require("./Comment.js");
let FragmentCondition = require("./FragmentCondition.js");
let Reference = require("./Reference.js");
let Terminate = require("./Terminate.js");
let Blank = require("./Blank.js");
let ErrorLine = require("./ErrorLine.js");
const InputDocumentError = require("./InputDocumentError.js");

///////////////////////////////////////////////////////////////////////////////
/**
 * Resolve the horizontal span of a fragment from optional actor bounds.
 *
 * @param {*} working Current working render state.
 * @param {object} line Fragment line definition.
 * @param {number} depthIndex Active nested-fragment depth.
 * @returns {{ startX: number, endX: number }} Fragment x-axis bounds.
 * @throws {InputDocumentError} If configured actor aliases are invalid or reversed.
 * @example
 * const span = resolveFragmentSpan(working, { startActor: "A", endActor: "B" }, 0);
 */
function resolveFragmentSpan(working, line, depthIndex) {
	const defaultStartX = working.windowPadding + depthIndex * working.fragmentSpacing;
	const defaultEndX = working.canvasWidth - working.windowPadding - depthIndex * working.fragmentSpacing;

	if (!Utilities.isString(line.startActor) && !Utilities.isString(line.endActor)) {
		return {
			startX: defaultStartX,
			endX: defaultEndX,
		};
	}

	let startActor = null;
	let endActor = null;
	if (Array.isArray(working.postdata.actors)) {
		working.postdata.actors.forEach((actor) => {
			if (Utilities.isString(line.startActor) && actor.alias === line.startActor) {
				startActor = actor;
			}
			if (Utilities.isString(line.endActor) && actor.alias === line.endActor) {
				endActor = actor;
			}
		});
	}

	if (Utilities.isString(line.startActor) && startActor == null) {
		throw new InputDocumentError(`'fragment' line 'startActor' alias "${line.startActor}" does not match any actor`, line);
	}
	if (Utilities.isString(line.endActor) && endActor == null) {
		throw new InputDocumentError(`'fragment' line 'endActor' alias "${line.endActor}" does not match any actor`, line);
	}

	const startX =
		startActor && Utilities.isNumber(startActor.clinstance.middle)
			? startActor.clinstance.middle - startActor.clinstance.width / 2 - working.globalSpacing / 2
			: defaultStartX;
	const endX =
		endActor && Utilities.isNumber(endActor.clinstance.middle)
			? endActor.clinstance.middle + endActor.clinstance.width / 2 + working.globalSpacing / 2
			: defaultEndX;

	if (startX > endX) {
		throw new InputDocumentError("'fragment' line actor bounds are reversed", line);
	}

	return {
		startX: startX < defaultStartX ? defaultStartX : startX,
		endX: endX > defaultEndX ? defaultEndX : endX,
	};
}

///////////////////////////////////////////////////////////////////////////////
/**
 * Return whether a fragment definition or instance represents a rect highlight.
 *
 * @param {*} fragment Candidate fragment line or Fragment instance.
 * @returns {boolean} True when the fragment type is `rect`.
 * @example
 * const isRect = isRectFragment({ fragmentType: "rect" });
 */
function isRectFragment(fragment) {
	if (Utilities.isObject(fragment) && Utilities.isString(fragment.fragmentType)) {
		return fragment.fragmentType === "rect";
	}

	return false;
}

///////////////////////////////////////////////////////////////////////////////
/**
 * Count the currently active structural fragments.
 *
 * @param {*} working Current working render state.
 * @returns {number} Number of active non-rect fragments.
 * @example
 * const depth = countActiveStructuralFragments(working);
 */
function countActiveStructuralFragments(working) {
	if (!Array.isArray(working.activeFragments)) {
		return 0;
	}

	return working.activeFragments.filter((fragment) => isRectFragment(fragment) === false).length;
}

///////////////////////////////////////////////////////////////////////////////
/**
 * Return the nearest active structural fragment, if any.
 *
 * @param {*} working Current working render state.
 * @returns {*} Active structural fragment instance or null.
 * @example
 * const parent = getLastActiveStructuralFragment(working);
 */
function getLastActiveStructuralFragment(working) {
	if (!Array.isArray(working.activeFragments)) {
		return null;
	}

	for (let index = working.activeFragments.length - 1; index >= 0; index--) {
		if (isRectFragment(working.activeFragments[index]) === false) {
			return working.activeFragments[index];
		}
	}

	return null;
}

///////////////////////////////////////////////////////////////////////////////
/**
 * Return the nearest active rect highlight, if any.
 *
 * @param {*} working Current working render state.
 * @returns {*} Active rect fragment instance or null.
 * @example
 * const rectParent = getLastActiveRectHighlight(working);
 */
function getLastActiveRectHighlight(working) {
	if (!Array.isArray(working.activeRectHighlights)) {
		return null;
	}

	for (let index = working.activeRectHighlights.length - 1; index >= 0; index--) {
		if (isRectFragment(working.activeRectHighlights[index]) === true) {
			return working.activeRectHighlights[index];
		}
	}

	return null;
}

///////////////////////////////////////////////////////////////////////////////
/**
 * Resolve the configured nested rect inset distance in pixels.
 *
 * @param {*} working Current working render state.
 * @returns {number} Non-negative inset amount.
 * @example
 * const inset = getRectNestedInsetPx(working);
 */
function getRectNestedInsetPx(working) {
	return working.postdata &&
		working.postdata.params &&
		working.postdata.params.fragment &&
		Utilities.isNumber(working.postdata.params.fragment.rectNestedInsetPx) &&
		working.postdata.params.fragment.rectNestedInsetPx >= 0
		? working.postdata.params.fragment.rectNestedInsetPx
		: 10;
}

///////////////////////////////////////////////////////////////////////////////
/**
 * Draw the inset parallel-marker lines inside a fragment title tab.
 *
 * @param {*} ctx Render context.
 * @param {number} fragmentStartX Left edge of the title tab.
 * @param {number} fragmentTop Top edge of the title tab.
 * @param {*} textxy Measured title text bounds.
 * @param {number} offset Diagonal tab offset.
 * @param {string} borderColour Stroke colour for the marker.
 * @param {number} borderWidth Stroke width for the marker.
 * @param {Array<number>} borderDash Border dash pattern for the marker.
 * @param {*} mimic Whether this is a measurement-only render pass.
 * @returns {void} Nothing.
 * @example
 * drawParallelTitleMarker(ctx, 30, 200, { x: 65, y: 224 }, 10, "rgb(0,0,0)", 1, [], false);
 */
function drawParallelTitleMarker(ctx, fragmentStartX, fragmentTop, textxy, offset, borderColour, borderWidth, borderDash, mimic) {
	if (mimic === true || !Utilities.isObject(textxy) || !Utilities.isNumber(textxy.x) || !Utilities.isNumber(textxy.y)) {
		return;
	}

	const inset = Math.max(3, Math.round(borderWidth) + 2);
	const innerLeft = fragmentStartX + inset;
	const innerTop = fragmentTop + inset;
	const innerBottom = textxy.y - inset;
	const innerRight = textxy.x - inset;
	const diagonalX = textxy.x + offset - inset;
	const diagonalY = textxy.y - offset - inset;
	if (innerBottom <= innerTop || innerRight <= innerLeft || diagonalX <= innerRight || diagonalY < innerTop) {
		return;
	}

	ctx.beginPath();
	ctx.moveTo(innerLeft, innerTop);
	ctx.lineTo(innerLeft, innerBottom);
	ctx.lineTo(innerRight, innerBottom);
	ctx.lineTo(diagonalX, diagonalY);
	ctx.lineTo(diagonalX, innerTop);
	ctx.lineTo(innerLeft, innerTop);
	ctx.setLineDash(borderDash);
	ctx.lineWidth = borderWidth;
	ctx.strokeStyle = borderColour;
	ctx.stroke();
}

module.exports = class Fragment {
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Initialise the Fragment instance.
	 *
	 * @param {*} ctx Parameter derived from ctx.
	 * @param {*} line Parameter derived from line.
	 * @returns {void} Nothing.
	 * @example
	 * const instance = new Fragment(ctx, line);
	 */
	constructor(ctx, line) {
		this._ctx = ctx;
		this._line = line;
		this._titleTmd = null;
		this._conditionTmd = null;
		this._fragmentStartX = null;
		this._fragmentEndX = null;
		this._colour = null;
		this._borderDash = null;
		this._borderWidth = null;
		this._borderColour = null;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return colour.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.colour;
	 */
	get colour() {
		return this._colour;
	}
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return border dash.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.borderDash;
	 */
	get borderDash() {
		return this._borderDash;
	}
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return border width.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.borderWidth;
	 */
	get borderWidth() {
		return this._borderWidth;
	}
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return border colour.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.borderColour;
	 */
	get borderColour() {
		return this._borderColour;
	}
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return fragment start x.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.fragmentStartX;
	 */
	get fragmentStartX() {
		return this._fragmentStartX;
	}
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return fragment end x.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.fragmentEndX;
	 */
	get fragmentEndX() {
		return this._fragmentEndX;
	}
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return fragment type.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.fragmentType;
	 */
	get fragmentType() {
		return Utilities.isObject(this._line) && Utilities.isString(this._line.fragmentType) ? this._line.fragmentType : "";
	}
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return configured start actor alias.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.startActor;
	 */
	get startActor() {
		return Utilities.isObject(this._line) && Utilities.isString(this._line.startActor) ? this._line.startActor : undefined;
	}
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return configured end actor alias.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.endActor;
	 */
	get endActor() {
		return Utilities.isObject(this._line) && Utilities.isString(this._line.endActor) ? this._line.endActor : undefined;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Draw the fragment element.
	 *
	 * @param {*} working Parameter derived from working.
	 * @param {*} starty Parameter derived from starty.
	 * @param {*} mimic Parameter derived from mimic.
	 * @returns {*} Result value.
	 * @example
	 * instance.draw(working, starty, mimic);
	 */
	draw(working, starty, mimic) {
		if (!Utilities.isObject(this._line)) {
			throw new InputDocumentError("'fragment' line must be an object", this._line);
		}
		if (!Utilities.isString(this._line.fragmentType)) {
			throw new InputDocumentError("'fragment' line must define a string 'fragmentType'", this._line);
		}
		if (!Array.isArray(this._line.lines)) {
			throw new InputDocumentError("'fragment' line must define 'lines' as an array", this._line);
		}
		let currentActiveAboveThisFragment = 0;
		if (!Array.isArray(working.activeFragments)) {
			working.activeFragments = [];
		}
		if (!Array.isArray(working.activeRectHighlights)) {
			working.activeRectHighlights = [];
		}
		currentActiveAboveThisFragment = countActiveStructuralFragments(working);
		if (!working.postdata) {
			working.postdata = [];
		}
		if (!working.postdata.params) {
			working.postdata.params = [];
		}
		if (!working.postdata.params.fragment) {
			working.postdata.params.fragment = [];
		}

		//////////////////////////////////////////////////////////////////////////////
		// Get fragment type early so later rendering can apply any type-specific
		// geometry treatment without changing the fragment model.
		let type = Utilities.isString(this._line.fragmentType) ? this._line.fragmentType : "";

		//////////////////////////////////////////////////////////////////////////////
		// Get the fragment colour
		this._colour = Utilities.validColour(this._line.bgColour)
			? this._line.bgColour
			: working.postdata.params &&
			  working.postdata.params.fragment &&
			  Array.isArray(working.postdata.params.fragment.bgColours) &&
			  Utilities.validColour(working.postdata.params.fragment.bgColours[currentActiveAboveThisFragment])
			? working.postdata.params.fragment.bgColours[currentActiveAboveThisFragment]
			: Utilities.validColour(Utilities.getBuiltInFragmentBgColours()[currentActiveAboveThisFragment])
			? Utilities.getBuiltInFragmentBgColours()[currentActiveAboveThisFragment]
			: "rgb(255,212,121)";

		//////////////////////////////////////////////////////////////////////////////
		// Get the title bar colour
		let titleBgColour =
			Utilities.isObject(this._line.title) && this._line.title.bgColour && Utilities.validColour(this._line.title.bgColour)
				? this._line.title.bgColour
				: working.postdata.params &&
				  working.postdata.params.fragment &&
				  working.postdata.params.fragment.title &&
				  working.postdata.params.fragment.title.bgColour &&
				  Utilities.validColour(working.postdata.params.fragment.title.bgColour)
				? working.postdata.params.fragment.title.bgColour
				: "rgba(200,200,0,0.8)";

		//////////////////////////////////////////////////////////////////////////////
		// Get the title bar  fg colour
		let titleFgColour =
			Utilities.isObject(this._line.title) && this._line.title.fgColour && Utilities.validColour(this._line.title.fgColour)
				? this._line.title.fgColour
				: working.postdata.params &&
				  working.postdata.params.fragment &&
				  working.postdata.params.fragment.title &&
				  working.postdata.params.fragment.title.fgColour &&
				  Utilities.validColour(working.postdata.params.fragment.title.fgColour)
				? working.postdata.params.fragment.title.fgColour
				: "rgb(0,0,0)";

		//////////////////////////////////////////////////////////////////////////////
		// Get the border colour
		this._borderColour = Utilities.validColour(this._line.borderColour)
			? this._line.borderColour
			: working.postdata.params && working.postdata.params.fragment && Utilities.validColour(working.postdata.params.fragment.borderColour)
			? working.postdata.params.fragment.borderColour
			: "rgb(0, 0, 0)";

		//////////////////////////////////////////////////////////////////////////////
		// Get the border dash
		this._borderDash =
			Array.isArray(this._line.borderDash) && Utilities.isAllNumber(this._line.borderDash)
				? this._line.borderDash
				: working.postdata.params &&
				  working.postdata.params.fragment &&
				  Array.isArray(working.postdata.params.fragment.borderDash) &&
				  Utilities.isAllNumber(working.postdata.params.fragment.borderDash)
				? working.postdata.params.fragment.borderDash
				: [];

		//////////////////////////////////////////////////////////////////////////////
		// Get the border width
		this._borderWidth =
			Utilities.isNumber(this._line.borderWidth) && this._line.borderWidth >= 0
				? this._line.borderWidth
				: working.postdata.params &&
				  working.postdata.params.fragment &&
				  Utilities.isNumber(working.postdata.params.fragment.borderWidth) &&
				  working.postdata.params.fragment.borderWidth >= 0
				? working.postdata.params.fragment.borderWidth
				: 1;

		//////////////////////////////////////////////////////////////////////////////
		// Resolve rect-specific behaviour.
		const isRectHighlight = type === "rect";
		if (!isRectHighlight && !Utilities.validColour(this._line.bgColour) && getLastActiveRectHighlight(working) != null) {
			this._colour = "rgba(255,255,255,0)";
		}

		//////////////////////////////////////////////////////////////////////////////
		// Get fragment title
		let title = Utilities.isString(this._line.title)
			? this._line.title
			: this._line.title == "object" && Utilities.isString(this._line.title.text)
			? this._line.title.text
			: "";

		//////////////////////////////////////////////////////////////////////////////
		// Get fragment condition
		let condition = Utilities.isString(this._line.condition)
			? this._line.condition
			: this._line.condition == "object" && Utilities.isString(this._line.condition.text)
			? this._line.condition.text
			: "";
		const showRectHeader = !isRectHighlight || title.length > 0 || condition.length > 0;

		//////////////////////////////////////////////////////////////////////////////
		// Create text metadata objects
		const titleTmd = Utilities.isObject(this._line.title)
			? TextMetadata.getTextMetadataFromObject(
					working,
					this._line.title,
					working.postdata.params.fragment.title,
					Fragment.getDefaultTitleTmd()
			  )
			: TextMetadata.getTextMetadataFromObject(working, this._line, working.postdata.params.fragment.title, Fragment.getDefaultTitleTmd());
		titleTmd.fgColour = titleFgColour;
		titleTmd.bgColour = "rgba(0,0,0,0)";
		const conditionTmd = Utilities.isObject(this._line.condition)
			? TextMetadata.getTextMetadataFromObject(
					working,
					this._line.condition,
					working.postdata.params.fragment.condition,
					Fragment.getDefaultConditionTmd()
			  )
			: TextMetadata.getTextMetadataFromObject(
					working,
					this._line,
					working.postdata.params.fragment.condition,
					Fragment.getDefaultConditionTmd()
			  );
		conditionTmd.bgColour = "rgba(255,255,255,0)";
		if (type === "par") {
			titleTmd.padding = titleTmd.padding + 10;
		} else if (type === "critical") {
			titleTmd.padding = titleTmd.padding + 1;
		}

		//////////////////////////////////////////////////////////////////////////////
		// Calculate height of fragment start line
		let ctx = this._ctx;
		const structuralParentFragment = getLastActiveStructuralFragment(working);
		let fragmentSpan = resolveFragmentSpan(working, this._line, currentActiveAboveThisFragment);
		if (isRectHighlight && !Utilities.isString(this._line.startActor) && !Utilities.isString(this._line.endActor)) {
			if (structuralParentFragment != null) {
				fragmentSpan = {
					startX: structuralParentFragment.fragmentStartX,
					endX: structuralParentFragment.fragmentEndX,
				};
			} else {
				fragmentSpan = {
					startX: working.windowPadding,
					endX: working.canvasWidth - working.windowPadding,
				};
			}
		}
		const activeRectParent = getLastActiveRectHighlight(working);
		if (
			isRectHighlight &&
			activeRectParent != null &&
			Utilities.isString(this._line.startActor) &&
			Utilities.isString(activeRectParent.startActor) &&
			this._line.startActor === activeRectParent.startActor
		) {
			const rectNestedInsetPx = getRectNestedInsetPx(working);
			fragmentSpan = {
				startX: fragmentSpan.startX + rectNestedInsetPx,
				endX: fragmentSpan.endX - rectNestedInsetPx,
			};
		}
		if (fragmentSpan.endX - fragmentSpan.startX < working.globalSpacing) {
			fragmentSpan.endX = fragmentSpan.startX + working.globalSpacing;
		}
		let fragmentStartX = fragmentSpan.startX;
		let fragmentEndX = fragmentSpan.endX;
		this._fragmentStartX = fragmentStartX;
		this._fragmentEndX = fragmentEndX;
		let fragmentTop = null;
		let commentxy = null;
		let comment = null;
		let gapRight = 1.5 * working.globalSpacing;
		if (this._line.comment != null) {
			comment = new Comment(ctx, this._line.comment);
			commentxy = comment.draw(
				working,
				fragmentStartX + working.globalSpacing,
				starty + working.globalSpacing,
				working.globalSpacing,
				gapRight,
				true
			);
		}
		fragmentTop = Utilities.isObject(commentxy) && Utilities.isNumber(commentxy.y) ? commentxy.y : starty + working.globalSpacing;
		let textxy = !showRectHeader
			? { x: fragmentStartX, y: fragmentTop }
			: Utilities.drawTextRectangleNoBorderOrBg(
					this._ctx,
					type + " " + title,
					titleTmd,
					fragmentTop,
					fragmentStartX,
					null,
					null,
					true
			  );
		let conditionxy = !showRectHeader
			? { x: fragmentStartX, y: fragmentTop }
			: Utilities.drawTextRectangleNoBorderOrBg(
					this._ctx,
					condition,
					conditionTmd,
					textxy.y,
					fragmentStartX,
					null,
					null,
					true
			  );
		let xy = Actor.drawTimelines(working, this._ctx, starty, conditionxy.y - starty, false);
		let finalHeightOfAllLine = xy.y - starty;
		let finalHeightAboveFragmentInLine = fragmentTop - starty;
		let finalHeightOfFragmentRectangle = finalHeightOfAllLine - finalHeightAboveFragmentInLine;
		let blankWidth = conditionxy.x > textxy.x ? conditionxy.x : textxy.x;

		//////////////////////////////////////////////////////////////////////////////
		// Height now calculated .. now draw the items in order
		//////////////////////////////////////////////////////////////////////////////
		// 1. Backgorund fragments
		//////////////////////////////////////////////////////////////////////////////
		// 2. Current Fragment rectangle
		//////////////////////////////////////////////////////////////////////////////
		// 3. Time lines
		//////////////////////////////////////////////////////////////////////////////
		// 4. Type and Title rectangle
		//////////////////////////////////////////////////////////////////////////////
		// 5. Type and title text
		//////////////////////////////////////////////////////////////////////////////
		// 6. Condition text
		//////////////////////////////////////////////////////////////////////////////
		// 7. Comment

		//////////////////////////////////////////////////////////////////////////////
		// 1. Background fragments
		Utilities.drawActiveStructuralFragmentBackgrounds(working, this._ctx, starty, finalHeightOfAllLine, mimic);

		//////////////////////////////////////////////////////////////////////////////
		// 2. Current Fragment rectangle
		if (!isRectHighlight || showRectHeader) {
			xy = Utilities.drawRectangle(
				this._ctx,
				0,
				this._borderColour,
				this._borderDash,
				this._colour,
				fragmentTop, // top
				fragmentStartX, // left
				fragmentEndX - fragmentStartX > 0 ? fragmentEndX - fragmentStartX : working.globalSpacing, // width
				finalHeightOfFragmentRectangle, //height
				0,
				true,
				true,
				false,
				true,
				false
			);
		}
		Utilities.drawActiveRectHighlights(working, this._ctx, starty, finalHeightOfAllLine, mimic);
		if (isRectHighlight) {
			xy = Utilities.drawRectangle(
				this._ctx,
				this._borderWidth,
				this._borderColour,
				this._borderDash,
				this._colour,
				fragmentTop,
				fragmentStartX,
				fragmentEndX - fragmentStartX > 0 ? fragmentEndX - fragmentStartX : working.globalSpacing,
				finalHeightOfFragmentRectangle,
				0,
				true,
				true,
				false,
				true,
				mimic
			);
		}

		//////////////////////////////////////////////////////////////////////////////
		// 3. Time lines
		xy = Actor.drawTimelines(working, ctx, starty, finalHeightOfAllLine, mimic);
		Utilities.drawActiveStructuralFragmentBorders(working, this._ctx, starty, finalHeightOfAllLine, mimic);
		if (!isRectHighlight || showRectHeader) {
			xy = Utilities.drawRectangle(
				this._ctx,
				this._borderWidth,
				this._borderColour,
				this._borderDash,
				"rgba(255,255,255,0)",
				fragmentTop,
				fragmentStartX,
				fragmentEndX - fragmentStartX > 0 ? fragmentEndX - fragmentStartX : working.globalSpacing,
				finalHeightOfFragmentRectangle,
				0,
				true,
				true,
				false,
				true,
				mimic
			);
		}

		//////////////////////////////////////////////////////////////////////////////
		// 4. Type and Title rectangle
		if (!isRectHighlight || showRectHeader) {
			let offset = (textxy.y - fragmentTop) / 2;
			const titleBorderWidth = type === "critical" ? this._borderWidth + 1 : this._borderWidth;
			if (offset > 10) offset = 10;
			if (offset < 0) offset = 0;
			ctx.beginPath();
			ctx.moveTo(fragmentStartX, fragmentTop);
			ctx.lineTo(fragmentStartX, textxy.y);
			ctx.lineTo(textxy.x, textxy.y);
			ctx.lineTo(textxy.x + offset, textxy.y - offset);
			ctx.lineTo(textxy.x + offset, fragmentTop);
			ctx.lineTo(fragmentStartX, fragmentTop);
			ctx.fillStyle = titleBgColour;
			ctx.fill();
			ctx.setLineDash(this._borderDash);
			ctx.lineWidth = titleBorderWidth;
			ctx.strokeStyle = this._borderColour;
			ctx.stroke();
			if (type === "par") {
				drawParallelTitleMarker(
					ctx,
					fragmentStartX,
					fragmentTop,
					textxy,
					offset,
					this._borderColour,
					titleBorderWidth,
					this._borderDash,
					mimic
				);
			}
		}

		//////////////////////////////////////////////////////////////////////////////
		// 5. Type and title text
		if (!isRectHighlight || showRectHeader) {
			textxy = Utilities.drawTextRectangleNoBorderOrBg(
				this._ctx,
				type + " " + title,
				titleTmd,
				fragmentTop,
				fragmentStartX,
				null,
				null,
				mimic
			);
		}

		//////////////////////////////////////////////////////////////////////////////
		// 6. Condition text
		if (!isRectHighlight || showRectHeader) {
			conditionxy = Utilities.drawTextRectangleNoBorderOrBg(
				this._ctx,
				condition,
				conditionTmd,
				textxy.y,
				fragmentStartX,
				null,
				null,
				mimic
			);
		}

		//////////////////////////////////////////////////////////////////////////////
		// 7. Comment
		if (comment != null) {
			commentxy = comment.draw(
				working,
				fragmentStartX + working.globalSpacing,
				starty + working.globalSpacing,
				working.globalSpacing,
				gapRight,
				mimic
			);
		}

		//////////////////////////////////////////////////////////////////////////////
		// Make this an active fragment
		if (isRectHighlight) {
			working.activeRectHighlights.push(this);
		} else {
			working.activeFragments.push(this);
		}

		//////////////////////////////////////////////////////////////////////////////
		// Draw the lines of the fragment
		xy = Fragment.drawLines(working, ctx, xy.y, this._line.lines);

		//////////////////////////////////////////////////////////////////////////////
		// Add a small bottom pad to pure rect highlights so the colour reads as a band.
		if (isRectHighlight) {
			const rectBottomPad = Math.max(4, Math.round(working.globalSpacing / 3));
			let bottomPad = new Blank(ctx, { type: "blank", height: rectBottomPad });
			xy = bottomPad.draw(working, xy.y, mimic);
		}

		//////////////////////////////////////////////////////////////////////////////
		// Draw a final blank line to make sure we have width
		if (!isRectHighlight) {
			let blank = new Blank(ctx, { type: "blank", width: blankWidth, height: 0 });
			xy = blank.draw(working, xy.y, false);
		}

		//////////////////////////////////////////////////////////////////////////////
		// Remove this active fragment
		if (isRectHighlight) {
			working.activeRectHighlights.pop();
		} else {
			working.activeFragments.pop();
		}

		if (isRectHighlight) {
			working.manageMaxWidth(0, xy.y);
			return xy;
		}

		let endLineTop = xy.y;
		ctx.lineWidth = 1;
		ctx.setLineDash([2, 2]);
		ctx.strokeStyle = "rgb(0,0,0)";
		ctx.beginPath();
		ctx.moveTo(0, endLineTop);
		ctx.lineTo(working.canvasWidth, endLineTop);

		//////////////////////////////////////////////////////////////////////////////
		// DEBUG End Line
		if (working.debug) {
			ctx.stroke();
			let dbgtext = new TextMetadata("monospace", 8, 5, 1, "rgb(0,0,0)", "rgba(0,0,0,1)", "left");
			Utilities.drawTextRectangleNoBorderOrBg(ctx, "" + endLineTop, dbgtext, endLineTop + 5, 10, null, null, false);
			/////////////////////////////////////////////////////////////////////////////
			//dbgtext.writeLines(ctx, "" + endLineTop, 10, endLineTop + 5, null, null);
		}

		//////////////////////////////////////////////////////////////////////////////
		// Calculate the end line dimensions
		const heightOfEndRectangle = working.globalSpacing;
		const heightOfEndLine = heightOfEndRectangle + working.globalSpacing;
		const xyend = Actor.drawTimelines(working, ctx, endLineTop, heightOfEndLine, true);
		const finalHeightOfEndLine = xyend.y - endLineTop;
		const finalHeightOfEndRectangle = finalHeightOfEndLine - working.globalSpacing;

		//////////////////////////////////////////////////////////////////////////////
		// Draw any active fragments
		Utilities.drawActiveStructuralFragmentBackgrounds(working, this._ctx, endLineTop, finalHeightOfEndLine, mimic);

		//////////////////////////////////////////////////////////////////////////////
		// Draw this end part of the fragment
		xy = Utilities.drawRectangle(
			this._ctx,
			0,
			this._borderColour,
			this._borderDash,
			this._colour,
			endLineTop,
			this._fragmentStartX,
			fragmentEndX - fragmentStartX > 0 ? fragmentEndX - fragmentStartX : working.globalSpacing, // width
			finalHeightOfEndRectangle,
			0,
			false,
			true,
			true,
			true,
			false
		);
		Utilities.drawActiveRectHighlights(working, this._ctx, endLineTop, finalHeightOfEndLine, mimic);

		//////////////////////////////////////////////////////////////////////////////
		// Draw the structural borders before the timelines so activation bars can
		// visually cap the fragment end as they did in the legacy renderer.
		Utilities.drawActiveStructuralFragmentBorders(working, this._ctx, endLineTop, finalHeightOfEndLine, mimic);
		const endRectangleXy = Utilities.drawRectangle(
			this._ctx,
			this._borderWidth,
			this._borderColour,
			this._borderDash,
			"rgba(255,255,255,0)",
			endLineTop,
			this._fragmentStartX,
			fragmentEndX - fragmentStartX > 0 ? fragmentEndX - fragmentStartX : working.globalSpacing,
			finalHeightOfEndRectangle,
			0,
			false,
			true,
			true,
			true,
			mimic
		);

		//////////////////////////////////////////////////////////////////////////////
		// Draw the timelines for this fragment
		xy = Actor.drawTimelines(working, ctx, endLineTop, finalHeightOfEndLine, mimic);

		//////////////////////////////////////////////////////////////////////////////
		// Do not manage max width HERE!!
		//////////////////////////////////////////////////////////////////////////////
		// max width should only consider no fragment drawings
		working.manageMaxWidth(0, xy.y);
		return xy;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle calculate fragment depth.
	 *
	 * @param {*} working Parameter derived from working.
	 * @param {*} lines Parameter derived from lines.
	 * @param {*} reset Parameter derived from reset.
	 * @returns {*} Result value.
	 * @example
	 * instance.calculateFragmentDepth(working, lines, reset);
	 */
	calculateFragmentDepth(working, lines, reset) {
		if (typeof working.scratchPad.maxFragmentDepth != "number") {
			working.scratchPad.maxFragmentDepth = 0;
		}
		if (typeof working.scratchPad.curFragmentDepth != "number") {
			working.scratchPad.curFragmentDepth = 0;
		}
		if (!Array.isArray(lines)) {
			return working.scratchPad.maxFragmentDepth;
		}
		if (reset) {
			working.scratchPad.maxFragmentDepth = 0;
			working.scratchPad.curFragmentDepth = 0;
		}
		lines.forEach((line) => {
			if (line.type == "fragment" && line.fragmentType !== "rect") {
				working.scratchPad.curFragmentDepth++;
				if (working.scratchPad.curFragmentDepth > working.scratchPad.maxFragmentDepth) {
					working.scratchPad.maxFragmentDepth = working.scratchPad.curFragmentDepth;
				}
				this.calculateFragmentDepth(working, line.lines, false);
				working.scratchPad.curFragmentDepth--;
			}
		});
		return working.scratchPad.maxFragmentDepth;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return the default title tmd configuration.
	 * @returns {*} Result value.
	 * @example
	 * instance.getDefaultTitleTmd();
	 */
	static getDefaultTitleTmd() {
		const defaultFragTitleTmd = {
			fontFamily: "sans-serif",
			fontSizePx: 14,
			fgColour: "rgb(0,0,0)",
			bgColour: "rgba(255,255,255,0)",
			padding: 10,
			spacing: 1,
			align: "left",
			borderColour: "rgba(255,255,255,0)",
			borderWidth: 0,
			borderDash: [],
		};
		return defaultFragTitleTmd;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return the default condition tmd configuration.
	 * @returns {*} Result value.
	 * @example
	 * instance.getDefaultConditionTmd();
	 */
	static getDefaultConditionTmd() {
		const defaultFragConditionTmd = {
			fontFamily: "sans-serif",
			fontSizePx: 12,
			fgColour: "rgb(0,0,0)",
			bgColour: "rgba(200,200,0,0)",
			padding: 10,
			spacing: 1,
			align: "left",
			borderColour: "rgba(255,255,255,0)",
			borderWidth: 0,
			borderDash: [],
		};
		return defaultFragConditionTmd;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle draw lines.
	 *
	 * @param {*} working Parameter derived from working.
	 * @param {*} ctx Parameter derived from ctx.
	 * @param {*} starty Parameter derived from starty.
	 * @param {*} lines Parameter derived from lines.
	 * @returns {*} Result value.
	 * @example
	 * instance.drawLines(working, ctx, starty, lines);
	 */
	static drawLines(working, ctx, starty, lines) {
		let xy = {
			x: 0,
			y: starty,
		};
		if (!Array.isArray(lines) || lines.length == 0) {
			return xy;
		}

		lines.forEach((line) => {
			let linetop = xy.y;
			try {
				if (line.type == undefined) {
					xy = ErrorLine.draw(working, ctx, xy.y, "line has no 'type' identifier", line, false);
				} else if (!Utilities.isString(line.type)) {
					xy = ErrorLine.draw(working, ctx, xy.y, "line 'type' identifier must be a string", line, false);
				} else if (line.type.toLowerCase() == "blank") {
					if (!Utilities.isNumberGtEq0(line.height)) {
						throw new InputDocumentError("'blank' line must define 'height' as a number >= 0", line);
					}
					working.logDebug("Processing Blank line at y:" + xy.y + " - " + Utilities.objToString(line));
					let blank = new Blank(ctx, line);
					xy = blank.draw(working, xy.y, false);
				} else if (line.type.toLowerCase() == "fragment") {
					working.logDebug("Processing Fragment line at y:" + xy.y + " - " + Utilities.objToString(line));
					let frag = new Fragment(ctx, line);
					xy = frag.draw(working, xy.y, false);
				} else if (line.type.toLowerCase() == "state") {
					working.logDebug("Processing State line at y:" + xy.y + " - " + Utilities.objToString(line));
					let statecl = new State(ctx, line);
					xy = statecl.draw(working, xy.y, false);
				} else if (line.type.toLowerCase() == "condition") {
					working.logDebug("Processing Condition line at y:" + xy.y + " - " + Utilities.objToString(line));
					let fragmentCondition = new FragmentCondition(ctx, line);
					xy = fragmentCondition.draw(working, xy.y, false);
				} else if (line.type.toLowerCase() == "call") {
					working.logDebug("Processing Call line at y:" + xy.y + " - " + Utilities.objToString(line));
					let call = new Call(ctx, line, working);
					xy = call.draw(working, xy.y, false);
				} else if (line.type.toLowerCase() == "create") {
					working.logDebug("Processing Create line at y:" + xy.y + " - " + Utilities.objToString(line));
					let createLine = Utilities.jsonCopy(line);
					createLine.type = "create";
					let call = new Call(ctx, createLine, working);
					xy = call.draw(working, xy.y, false);
				} else if (line.type.toLowerCase() == "return") {
					working.logDebug("Processing Return line at y:" + xy.y + " - " + Utilities.objToString(line));
					let rcall = new ReturnCall(ctx, line, working);
					xy = rcall.draw(working, xy.y, false);
				} else if (line.type.toLowerCase() == "reference") {
					working.logDebug("Processing Reference line at y:" + xy.y + " - " + Utilities.objToString(line));
					let ref = new Reference(ctx, line, working);
					xy = ref.draw(working, xy.y, false);
				} else if (line.type.toLowerCase() == "terminate") {
					working.logDebug("Processing Terminate line at y:" + xy.y + " - " + Utilities.objToString(line));
					let term = new Terminate(ctx, line, working);
					xy = term.draw(working, xy.y, false);
				} else {
					xy = ErrorLine.draw(
						working,
						ctx,
						xy.y,
						"unrecognised line type '" + line.type + "' (expected blank, fragment, state, condition, call, create, return, reference or terminate)",
						line,
						false
					);
				}
			} catch (error) {
				if (error instanceof InputDocumentError) {
					xy = ErrorLine.draw(working, ctx, xy.y, error.reason, error.offendingObject != null ? error.offendingObject : line, false);
				} else {
					throw error;
				}
			}

			if (working.debug) {
				ctx.lineWidth = 1;
				ctx.setLineDash([2, 2]);
				ctx.strokeStyle = "rgb(0,0,0)";
				ctx.beginPath();
				ctx.moveTo(0, linetop);
				ctx.lineTo(working.canvasWidth, linetop);
				ctx.stroke();
				let dbgtext = new TextMetadata("monospace", 8, 5, 1, "rgb(0,0,0)", "rgba(0,0,0,1)", "left", null, 0, null);
				if (Array.isArray(line.lines)) {
					let linecpy = Utilities.jsonCopy(line);
					linecpy.lines = "[...]";
					Utilities.drawTextRectangleNoBorderOrBg(
						ctx,
						linetop + ":" + JSON.stringify(linecpy),
						dbgtext,
						linetop + 5,
						10,
						null,
						null,
						false
					);
				} else {
					Utilities.drawTextRectangleNoBorderOrBg(ctx, linetop + ":" + JSON.stringify(line), dbgtext, linetop + 5, 10, null, null, false);
				}
			}
		});
		return working.manageMaxWidthXy(xy);
	}
};
