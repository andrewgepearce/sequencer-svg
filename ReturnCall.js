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
let TextMetadata = require("./TextMetadata.js");
let Actor = require("./Actor.js");
let Comment = require("./Comment.js");
const InputDocumentError = require("./InputDocumentError.js");

///////////////////////////////////////////////////////////////////////////////
/**
 * Resolve the arrowhead style for one end of a return line.
 *
 * @param {object} line Return-line definition.
 * @param {"from"|"to"} endpoint Arrow endpoint being resolved.
 * @returns {string} Normalised arrow style.
 * @example
 * const arrowType = getReturnArrowType({ arrow: "open" }, "to");
 */
function getReturnArrowType(line, endpoint) {
	const propertyName = endpoint === "from" ? "fromArrow" : "toArrow";
	let arrowType = line[propertyName];
	if (!Utilities.isString(arrowType) && endpoint === "to" && Utilities.isString(line.arrow)) {
		arrowType = line.arrow;
	}
	if (!Utilities.isString(arrowType) && endpoint === "to" && line.async === true) {
		arrowType = "open";
	}
	if (!Utilities.isString(arrowType)) {
		arrowType = endpoint === "to" ? "open" : "none";
	}

	arrowType = arrowType.toLowerCase();
	if (
		arrowType !== "fill" &&
		arrowType !== "open" &&
		arrowType !== "cross" &&
		arrowType !== "empty" &&
		arrowType !== "none" &&
		arrowType !== "halftop" &&
		arrowType !== "halfbottom" &&
		arrowType !== "sticktop" &&
		arrowType !== "stickbottom"
	) {
		return endpoint === "to" ? "open" : "none";
	}

	return arrowType;
}

///////////////////////////////////////////////////////////////////////////////
/**
 * Draw one arrowhead for a return line.
 *
 * @param {*} ctx Rendering context.
 * @param {number} x Arrow tip x coordinate.
 * @param {number} y Arrow tip y coordinate.
 * @param {"left"|"right"} direction Direction the arrow tip points towards.
 * @param {string} arrowType Arrow style to draw.
 * @param {number} arrowSizeY Arrow half-height.
 * @param {number} lineWidth Stroke width.
 * @param {string} lineColour Stroke or fill colour.
 * @returns {void} Nothing.
 * @example
 * drawReturnArrowhead(ctx, 40, 20, "left", "open", 5, 1, "rgb(0,0,0)");
 */
function drawReturnArrowhead(ctx, x, y, direction, arrowType, arrowSizeY, lineWidth, lineColour) {
	const horizontalDirection = direction === "right" ? -1 : 1;
	const rearX = x + horizontalDirection * arrowSizeY * 2;
	const topY = y - arrowSizeY;
	const bottomY = y + arrowSizeY;

	ctx.beginPath();
	ctx.setLineDash([]);
	ctx.strokeStyle = lineColour;
	ctx.fillStyle = lineColour;

	if (arrowType === "cross") {
		ctx.lineWidth = lineWidth + 1;
		ctx.moveTo(rearX, topY);
		ctx.lineTo(x, bottomY);
		ctx.moveTo(rearX, bottomY);
		ctx.lineTo(x, topY);
		ctx.stroke();
		ctx.lineWidth = lineWidth;
		return;
	}

	if (arrowType === "fill") {
		ctx.moveTo(x, y);
		ctx.lineTo(rearX, topY);
		ctx.lineTo(rearX, bottomY);
		ctx.lineTo(x, y);
		ctx.fill();
		return;
	}

	if (arrowType === "open") {
		ctx.moveTo(rearX, y);
		ctx.lineTo(x, y);
		ctx.moveTo(rearX, topY);
		ctx.lineTo(x, y);
		ctx.lineTo(rearX, bottomY);
		ctx.stroke();
		return;
	}

	if (arrowType === "halftop") {
		ctx.moveTo(rearX, topY);
		ctx.lineTo(x, y);
		ctx.stroke();
		return;
	}

	if (arrowType === "halfbottom") {
		ctx.moveTo(rearX, bottomY);
		ctx.lineTo(x, y);
		ctx.stroke();
		return;
	}

	if (arrowType === "sticktop") {
		ctx.moveTo(rearX, y);
		ctx.lineTo(x, y);
		ctx.moveTo(rearX, topY);
		ctx.lineTo(x, y);
		ctx.stroke();
		return;
	}

	if (arrowType === "stickbottom") {
		ctx.moveTo(rearX, y);
		ctx.lineTo(x, y);
		ctx.moveTo(rearX, bottomY);
		ctx.lineTo(x, y);
		ctx.stroke();
	}
}

module.exports = class ReturnCall {
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Initialise the ReturnCall instance.
	 *
	 * @param {*} ctx Parameter derived from ctx.
	 * @param {*} line Parameter derived from line.
	 * @param {*} working Parameter derived from working.
	 * @returns {void} Nothing.
	 * @example
	 * const instance = new ReturnCall(ctx, line, working);
	 */
	constructor(ctx, line, working) {
		this._ctx = ctx;
		this._line = line;
		this._startx = null;
		this._endx = null;
		this._actorFromClass = null;
		this._actorToClass = null;
		this._callCount = ++working.callCount;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Draw the return call element.
	 *
	 * @param {*} working Parameter derived from working.
	 * @param {*} starty Parameter derived from starty.
	 * @param {*} mimic Parameter derived from mimic.
	 * @returns {*} Result value.
	 * @example
	 * instance.draw(working, starty, mimic);
	 */
	draw(working, starty, mimic) {
		//////////////////////////////////////////////////////////////////////////////
		// Draw blank line (without timelines) if there is no line object
		if (this._line == null || typeof this._line != "object") {
			throw new InputDocumentError("'return' line must be an object", this._line);
		}
		if (!Utilities.isString(this._line.from)) {
			throw new InputDocumentError("'return' line must define a string 'from' actor alias", this._line);
		}
		if (!Utilities.isString(this._line.to)) {
			throw new InputDocumentError("'return' line must define a string 'to' actor alias", this._line);
		}

		if (!working.postdata) {
			working.postdata = {};
		}
		if (!working.postdata.params) {
			working.postdata.params = {};
		}
		if (!working.postdata.params.return) {
			working.postdata.params.return = {};
		}

		//////////////////////////////////////////////////////////////////////////////
		// Get the call TMD
		let returntmd = TextMetadata.getTextMetadataFromObject(working, this._line, working.postdata.params.return, ReturnCall.getDefaultTmd());
		returntmd.bgColour = "rgba(0,0,0,0)";

		//////////////////////////////////////////////////////////////////////////////
		// Get the line dash
		let lineDash =
			Array.isArray(this._line.lineDash) && Utilities.isAllNumber(this._line.lineDash)
				? this._line.lineDash
				: working.postdata.params &&
				  working.postdata.params.return &&
				  Array.isArray(working.postdata.params.return.lineDash) &&
				  Utilities.isAllNumber(working.postdata.params.return.lineDash)
				? working.postdata.params.return.lineDash
				: [6, 3];

		//////////////////////////////////////////////////////////////////////////////
		// Get the line width
		let lineWidth =
			Utilities.isNumber(this._line.lineWidth) && this._line.lineWidth > 0
				? this._line.lineWidth
				: working.postdata.params &&
				  working.postdata.params.return &&
				  Utilities.isNumber(working.postdata.params.return.lineWidth) &&
				  working.postdata.params.return.lineWidth > 0
				? working.postdata.params.return.lineWidth
				: 1;

		//////////////////////////////////////////////////////////////////////////////
		// Get the line colour
		let lineColour = Utilities.validColour(this._line.lineColour)
			? this._line.lineColour
			: working.postdata.params && working.postdata.params.return && Utilities.validColour(working.postdata.params.return.lineColour)
			? working.postdata.params.return.lineColour
			: "rgb(0, 0, 0)";

		//////////////////////////////////////////////////////////////////////////////
		// Get the arrow size
		let arrowSizeY =
			Utilities.isNumber(this._line.arrowSize) && this._line.arrowSize > 0
				? this._line.arrowSize
				: working.postdata.params &&
				  working.postdata.params.return &&
				  Utilities.isNumber(working.postdata.params.return.arrowSize) &&
				  working.postdata.params.return.arrowSize > 0
				? working.postdata.params.return.arrowSize
				: 5;

		//////////////////////////////////////////////////////////////////////////////
		// Get startx and endx for the call
		working.postdata.actors.forEach((actor) => {
			if (actor.alias === this._line.from) {
				this._startx = actor.clinstance.middle;
				this._actorFromClass = actor.clinstance;
			}
			if (actor.alias === this._line.to) {
				this._endx = actor.clinstance.middle;
				this._actorToClass = actor.clinstance;
			}
		});
		if (typeof this._startx != "number") {
			throw new InputDocumentError(`'return' line 'from' alias "${this._line.from}" does not match any actor`, this._line);
		}
		if (typeof this._endx != "number") {
			throw new InputDocumentError(`'return' line 'to' alias "${this._line.to}" does not match any actor`, this._line);
		}

		//////////////////////////////////////////////////////////////////////////////
		// Should we break the to or from flows
		const continueFromFlow = this._line.continueFromFlow === true ? true : false;
		const breakToFlow = this._line.breakToFlow === true ? true : false;

		//////////////////////////////////////////////////////////////////////////////
		// Ignore line if start and enx are not numbers
		if (typeof this._startx != "number" || typeof this._endx != "number") {
			return {
				x: 0,
				y: starty,
			};
		}

		//////////////////////////////////////////////////////////////////////////////
		// Ignore line if the return is to the same actor
		if (this._endx == this._startx) {
			throw new InputDocumentError("'return' line cannot target the same actor as its source", this._line);
		}

		//////////////////////////////////////////////////////////////////////////////
		// Calculate height of fragment condition line
		let startxAfterFlow, endxAfterFlow;
		const ctx = this._ctx;
		let commentxy = null;
		let comment = null;
		let calltexty = null;
		let callliney = null;
		let commentOnStartx = true;

		let textToPrint = null;
		if (Utilities.isAllStrings(this._line.text)) {
			textToPrint = this._line.text.slice();
			for (let i = 0; i < textToPrint.length; i++) {
				textToPrint[i] = "<hang>" + textToPrint[i];
			}
			if (working.autonumber !== false) {
				textToPrint.unshift("" + this._callCount + ". ");
			}
		} else if (Utilities.isString(this._line.text)) {
			textToPrint = working.autonumber !== false ? this._callCount + ". " + this._line.text : this._line.text;
		} else {
			textToPrint = working.autonumber !== false ? this._callCount + ". " : "";
		}

		let wh = Utilities.getTextWidthAndHeight(ctx, returntmd, textToPrint, working.tags);
		const textheight = wh.h;
		if (this._startx < this._endx) {
			startxAfterFlow = this._startx + this._actorFromClass.flowWidth / 2;
			endxAfterFlow = this._endx - this._actorToClass.flowWidth / 2;
		} else {
			startxAfterFlow = this._startx - this._actorFromClass.flowWidth / 2;
			endxAfterFlow = this._endx + this._actorToClass.flowWidth / 2;
			commentOnStartx = false;
		}
		if (this._line.comment != null) {
			comment = new Comment(ctx, this._line.comment);

			if (commentOnStartx) {
				commentxy = comment.draw(
					working,
					startxAfterFlow + working.globalSpacing,
					starty + working.globalSpacing,
					textheight,
					working.globalSpacing,
					true
				);
			} else {
				commentxy = comment.draw(
					working,
					endxAfterFlow + 2 * arrowSizeY + working.globalSpacing,
					starty + working.globalSpacing,
					textheight,
					working.globalSpacing,
					true
				);
			}
			callliney = commentxy.y;
			calltexty = callliney - textheight;
		} else {
			callliney = starty + textheight + working.globalSpacing;
			calltexty = callliney - textheight;
		}

		let xy = Actor.drawTimelines(working, ctx, starty, callliney + arrowSizeY - starty + 1, true);
		let finalHeightOfAllLine = xy.y - starty;

		//////////////////////////////////////////////////////////////////////////////
		// Height now calculated .. not draw the items in order
		//////////////////////////////////////////////////////////////////////////////
		// 1. Background fragments
		//////////////////////////////////////////////////////////////////////////////
		// 2. Time lines
		//////////////////////////////////////////////////////////////////////////////
		// 3. Comment
		//////////////////////////////////////////////////////////////////////////////
		// 4. Call text
		//////////////////////////////////////////////////////////////////////////////
		// 5a. Call line
		//////////////////////////////////////////////////////////////////////////////
		// 5b. Call line arrow

		//////////////////////////////////////////////////////////////////////////////
		// 1. Background fragments

		Utilities.drawActiveFragments(working, this._ctx, starty, finalHeightOfAllLine, mimic);

		//////////////////////////////////////////////////////////////////////////////
		// 2. Time lines
		if (continueFromFlow) {
			this._actorFromClass.flowStartYPos = callliney - arrowSizeY;
			this._actorFromClass.flowEndYPos = null;
		} else {
			this._actorFromClass.flowStartYPos = callliney - arrowSizeY;
			this._actorFromClass.flowEndYPos = callliney + arrowSizeY;
		}
		if (breakToFlow) {
			this._actorToClass.flowStartYPos = callliney - arrowSizeY;
			this._actorToClass.flowEndYPos = callliney + arrowSizeY;
		} else {
			this._actorToClass.flowStartYPos = callliney - arrowSizeY;
			this._actorToClass.flowEndYPos = null;
		}
		xy = Actor.drawTimelines(working, ctx, starty, finalHeightOfAllLine, mimic);

		//////////////////////////////////////////////////////////////////////////////
		// 3. Comment
		if (comment != null) {
			if (commentOnStartx) {
				commentxy = comment.draw(
					working,
					startxAfterFlow + working.globalSpacing,
					starty + working.globalSpacing,
					textheight,
					working.globalSpacing,
					mimic
				);
			} else {
				commentxy = comment.draw(
					working,
					endxAfterFlow + 2 * arrowSizeY + working.globalSpacing,
					starty + working.globalSpacing,
					textheight,
					working.globalSpacing,
					mimic
				);
			}
		}

		//////////////////////////////////////////////////////////////////////////////
		// 4. Draw the call line text
		let gapToText = comment != null ? 2 * working.globalSpacing : working.globalSpacing;
		if (commentOnStartx) {
			let calltextxy = Utilities.drawTextRectangleNoBorderOrBg(
				ctx,
				textToPrint,
				returntmd,
				calltexty,
				startxAfterFlow + gapToText,
				null,
				null,
				mimic,
				wh
			);
			working.manageMaxWidth(calltextxy.x, calltextxy.y);
		} else {
			let calltextxy = Utilities.drawTextRectangleNoBorderOrBg(
				ctx,
				textToPrint,
				returntmd,
				calltexty,
				endxAfterFlow + 2 * arrowSizeY + gapToText,
				null,
				null,
				mimic,
				wh
			);
			working.manageMaxWidth(calltextxy.x, calltextxy.y);
		}

		//////////////////////////////////////////////////////////////////////////////
		// 5a. Draw the call line
		ctx.lineWidth = lineWidth;
		ctx.strokeStyle = lineColour;
		ctx.setLineDash(lineDash);
		ctx.beginPath();
		ctx.moveTo(startxAfterFlow, callliney);
		Utilities.drawOrMovePath(ctx, endxAfterFlow, callliney, mimic);
		ctx.stroke();

		//////////////////////////////////////////////////////////////////////////////
		// 5a. Draw the call arrow
		const goingLeft = this._startx > this._endx;
		const goingRight = !goingLeft;
		drawReturnArrowhead(
			ctx,
			endxAfterFlow,
			callliney,
			goingRight ? "right" : "left",
			getReturnArrowType(this._line, "to"),
			arrowSizeY,
			lineWidth,
			lineColour
		);
		drawReturnArrowhead(
			ctx,
			startxAfterFlow,
			callliney,
			goingRight ? "left" : "right",
			getReturnArrowType(this._line, "from"),
			arrowSizeY,
			lineWidth,
			lineColour
		);

		return working.manageMaxWidth(0, starty + finalHeightOfAllLine);
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return the default tmd configuration.
	 * @returns {*} Result value.
	 * @example
	 * instance.getDefaultTmd();
	 */
	static getDefaultTmd() {
		const defaultCallTmd = {
			fontFamily: "sans-serif",
			fontSizePx: 14,
			fgColour: "rgb(0,0,0)",
			bgColour: "rgba(255,255,255,0)",
			padding: 15,
			spacing: 1,
			align: "left",
			borderColour: "rgba(255,255,255,0)",
			borderWidth: 0,
			borderDash: [6, 3],
		};
		return defaultCallTmd;
	}
};
