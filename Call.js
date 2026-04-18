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
const schema = require("./schema.js");
const InputDocumentError = require("./InputDocumentError.js");

///////////////////////////////////////////////////////////////////////////////
/**
 * Resolve the arrowhead style for one end of a call line.
 *
 * @param {object} line Call-line definition.
 * @param {"from"|"to"} endpoint Arrow endpoint being resolved.
 * @returns {string} Normalised arrow style.
 * @example
 * const arrowType = getCallArrowType({ arrow: "fill" }, "to");
 */
function getCallArrowType(line, endpoint) {
	const propertyName = endpoint === "from" ? "fromArrow" : "toArrow";
	let arrowType = line[propertyName];
	if (!Utilities.isString(arrowType) && endpoint === "to" && Utilities.isString(line.arrow)) {
		arrowType = line.arrow;
	}
	if (!Utilities.isString(arrowType) && endpoint === "to" && line.async === true) {
		arrowType = "open";
	}
	if (!Utilities.isString(arrowType)) {
		arrowType = endpoint === "to" ? "fill" : "none";
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
		return endpoint === "to" ? "fill" : "none";
	}

	return arrowType;
}

///////////////////////////////////////////////////////////////////////////////
/**
 * Resolve the endpoint-anchor style for one end of a call line.
 *
 * @param {object} line Call-line definition.
 * @param {"from"|"to"} endpoint Endpoint being resolved.
 * @returns {"edge"|"central"} Normalised endpoint-anchor style.
 * @example
 * const anchorType = getCallAnchorType({ toAnchor: "central" }, "to");
 */
function getCallAnchorType(line, endpoint) {
	const propertyName = endpoint === "from" ? "fromAnchor" : "toAnchor";
	const anchorType = Utilities.isString(line[propertyName]) ? line[propertyName].toLowerCase() : "edge";
	return anchorType === "central" ? "central" : "edge";
}

///////////////////////////////////////////////////////////////////////////////
/**
 * Return the marker radius used for a central call connection.
 *
 * @param {number} arrowSizeY Arrow half-height for the call line.
 * @returns {number} Marker radius in pixels.
 * @example
 * const radius = getCentralConnectionRadius(5);
 */
function getCentralConnectionRadius(arrowSizeY) {
	return Math.max(3, Math.round(arrowSizeY * 0.8));
}

///////////////////////////////////////////////////////////////////////////////
/**
 * Resolve the rendered x coordinate for a call endpoint after flow and anchor
 * adjustments have been applied.
 *
 * @param {number} actorMiddleX Actor lifeline centre x coordinate.
 * @param {object} actorClass Actor renderer instance.
 * @param {"edge"|"central"} anchorType Endpoint-anchor style.
 * @param {number} direction Horizontal sign towards the line body.
 * @param {number} centralRadius Marker radius for central anchors.
 * @returns {number} Endpoint x coordinate.
 * @example
 * const x = resolveCallEndpointX(100, actorClass, "central", 1, 4);
 */
function resolveCallEndpointX(actorMiddleX, actorClass, anchorType, direction, centralRadius) {
	if (anchorType === "central") {
		return actorMiddleX + direction * centralRadius;
	}
	return actorMiddleX + direction * actorClass.flowWidth / 2;
}

///////////////////////////////////////////////////////////////////////////////
/**
 * Return whether an actor is currently lifecycle-active for the render pass.
 *
 * @param {object} working Shared working state.
 * @param {string} alias Actor alias.
 * @returns {boolean} True when the actor is currently active.
 * @example
 * const active = isActorLifecycleActive(working, "API");
 */
function isActorLifecycleActive(working, alias) {
	return !Utilities.isObject(working.actorLifecycleState) || !Utilities.isObject(working.actorLifecycleState[alias])
		? true
		: working.actorLifecycleState[alias].active === true;
}

///////////////////////////////////////////////////////////////////////////////
/**
 * Update an actor's lifecycle-active state for the current render pass.
 *
 * @param {object} working Shared working state.
 * @param {string} alias Actor alias.
 * @param {boolean} active New active state.
 * @returns {void} Nothing.
 * @example
 * setActorLifecycleActive(working, "API", false);
 */
function setActorLifecycleActive(working, alias, active) {
	if (!Utilities.isObject(working.actorLifecycleState) || !Utilities.isObject(working.actorLifecycleState[alias])) {
		return;
	}
	working.actorLifecycleState[alias].active = active === true;
}

///////////////////////////////////////////////////////////////////////////////
/**
 * Draw a central-connection marker on a call line.
 *
 * @param {*} ctx Rendering context.
 * @param {number} x Marker-centre x coordinate.
 * @param {number} y Marker-centre y coordinate.
 * @param {number} radius Marker radius.
 * @param {number} lineWidth Stroke width.
 * @param {string} lineColour Stroke colour.
 * @param {boolean} mimic Whether this is a measurement pass.
 * @returns {void} Nothing.
 * @example
 * drawCentralConnectionMarker(ctx, 40, 20, 4, 1, "rgb(0,0,0)", false);
 */
function drawCentralConnectionMarker(ctx, x, y, radius, lineWidth, lineColour, mimic) {
	if (mimic) {
		return;
	}
	ctx.beginPath();
	ctx.setLineDash([]);
	ctx.lineWidth = lineWidth;
	ctx.strokeStyle = lineColour;
	ctx.fillStyle = "rgb(255,255,255)";
	ctx.arc(x, y, radius, 0, 2 * Math.PI);
	ctx.fill();
	ctx.stroke();
}

///////////////////////////////////////////////////////////////////////////////
/**
 * Draw one arrowhead for a call line.
 *
 * @param {*} ctx Rendering context.
 * @param {number} x Arrow tip x coordinate.
 * @param {number} y Arrow tip y coordinate.
 * @param {"left"|"right"} direction Direction the arrow tip points towards.
 * @param {string} arrowType Arrow style to draw.
 * @param {number} arrowSizeY Arrow half-height.
 * @param {number} lineWidth Stroke width.
 * @param {string} lineColour Stroke or fill colour.
 * @param {boolean} includeStem Whether open-style arrows should include the centre stem.
 * @returns {void} Nothing.
 * @example
 * drawCallArrowhead(ctx, 40, 20, "right", "fill", 5, 1, "rgb(0,0,0)", false);
 */
function drawCallArrowhead(ctx, x, y, direction, arrowType, arrowSizeY, lineWidth, lineColour, includeStem) {
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
		ctx.moveTo(rearX, topY);
		ctx.lineTo(rearX, bottomY);
		ctx.lineTo(x, y);
		ctx.fill();
		return;
	}

	if (arrowType === "open") {
		if (includeStem) {
			ctx.moveTo(rearX, y);
			ctx.lineTo(x, y);
		}
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

module.exports = class Call {
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Initialise the Call instance.
	 *
	 * @param {*} ctx Parameter derived from ctx.
	 * @param {*} line Parameter derived from line.
	 * @param {*} working Parameter derived from working.
	 * @returns {void} Nothing.
	 * @example
	 * const instance = new Call(ctx, line, working);
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
	 * Draw the call element.
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
			throw new InputDocumentError("'call' line must be an object", this._line);
		}
		if (!Utilities.isString(this._line.from)) {
			throw new InputDocumentError("'call' line must define a string 'from' actor alias", this._line);
		}
		if (!Utilities.isString(this._line.to)) {
			throw new InputDocumentError("'call' line must define a string 'to' actor alias", this._line);
		}

		if (!working.postdata) {
			working.postdata = {};
		}
		if (!working.postdata.params) {
			working.postdata.params = {};
		}
		if (!working.postdata.params.call) {
			working.postdata.params.call = {};
		}
		//////////////////////////////////////////////////////////////////////////////
		// Get startx and endx for the call
		let foundFrom = false;
		let foundTo = false;
		working.postdata.actors.forEach((actor) => {
			if (actor.alias === this._line.from) {
				this._startx = actor.clinstance.middle;
				this._actorFromClass = actor.clinstance;
				foundFrom = true;
			}
			if (actor.alias === this._line.to) {
				this._endx = actor.clinstance.middle;
				this._actorToClass = actor.clinstance;
				foundTo = true;
			}
		});

		if (!foundFrom)
			throw new InputDocumentError(`'call' line 'from' alias "${this._line.from}" does not match any actor`, this._line);
		if (!foundTo)
			throw new InputDocumentError(`'call' line 'to' alias "${this._line.to}" does not match any actor`, this._line);

		if (typeof this._startx != "number" || typeof this._endx != "number") {
			return {
				x: 0,
				y: starty,
			};
		}
		const isCreateLine = Utilities.isString(this._line.type) && this._line.type.toLowerCase() === "create";
		const fromActive = isActorLifecycleActive(working, this._line.from);
		const toActive = isActorLifecycleActive(working, this._line.to);
		if (!fromActive) {
			throw new InputDocumentError(`'${this._line.type}' line 'from' actor "${this._line.from}" is not currently active`, this._line);
		}
		if (isCreateLine) {
			if (toActive) {
				throw new InputDocumentError(`'create' line 'to' actor "${this._line.to}" is already active`, this._line);
			}
		} else if (!toActive) {
			throw new InputDocumentError(`'${this._line.type}' line 'to' actor "${this._line.to}" is not currently active`, this._line);
		}
		if (this._endx != this._startx) {
			return this.drawDifferentActor(working, starty, mimic);
		} else if (this._endx == this._startx) {
			return this.drawSameActor(working, starty, mimic);
		}
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle draw same actor.
	 *
	 * @param {*} working Parameter derived from working.
	 * @param {*} starty Parameter derived from starty.
	 * @param {*} mimic Parameter derived from mimic.
	 * @returns {*} Result value.
	 * @example
	 * instance.drawSameActor(working, starty, mimic);
	 */
	drawSameActor(working, starty, mimic) {
		if (Utilities.isString(this._line.type) && this._line.type.toLowerCase() === "create") {
			throw new InputDocumentError("'create' line cannot target the same actor as its source", this._line);
		}
		//////////////////////////////////////////////////////////////////////////////
		// Get the call TMD
		let calltmd = TextMetadata.getTextMetadataFromObject(working, this._line, working.postdata.params.call, Call.getSelfCallDefaultTmd());
		calltmd.bgColour = "rgba(0,0,0,0)";

		//////////////////////////////////////////////////////////////////////////////
		// Get the line dash
		let lineDash = Array.isArray(this._line.lineDash) && Utilities.isAllNumber(this._line.lineDash) ? this._line.lineDash : [];

		//////////////////////////////////////////////////////////////////////////////
		// Get the line width
		let lineWidth = Utilities.isNumberGt0(this._line.lineWidth)
			? this._line.lineWidth
			: working.postdata.params && working.postdata.params.call && Utilities.isNumberGt0(working.postdata.params.call.lineWidth)
			? working.postdata.params.call.lineWidth
			: 1;

		//////////////////////////////////////////////////////////////////////////////
		// Get the line colour
		let lineColour = Utilities.validColour(this._line.lineColour)
			? this._line.lineColour
			: working.postdata.params && working.postdata.params.call && Utilities.validColour(working.postdata.params.call.lineColour)
			? working.postdata.params.call.lineColour
			: "rgb(0, 0, 0)";

		//////////////////////////////////////////////////////////////////////////////
		// Get the arrow size
		let arrowSizeY = Utilities.isNumberGt0(this._line.arrowSize)
			? this._line.arrowSize
			: working.postdata.params && working.postdata.params.call && Utilities.isNumberGt0(working.postdata.params.call.arrowSize)
			? working.postdata.params.call.arrowSize
			: 5;

		//////////////////////////////////////////////////////////////////////////////
		// Get the radius
		let radius = Utilities.isNumberGtEq0(this._line.radius)
			? this._line.radius
			: working.postdata.params && working.postdata.params.call && Utilities.isNumberGtEq0(working.postdata.params.call.radius)
			? working.postdata.params.call.radius
			: 5;

		//////////////////////////////////////////////////////////////////////////////
		// Calculate height of fragment condition line
		let startxAfterFlow;
		const ctx = this._ctx;
		let commentxy = null;
		let comment = null;
		let callliney = null;
		const fromAnchorType = getCallAnchorType(this._line, "from");
		const toAnchorType = getCallAnchorType(this._line, "to");
		const centralRadius = getCentralConnectionRadius(arrowSizeY);
		startxAfterFlow = resolveCallEndpointX(this._startx, this._actorFromClass, fromAnchorType, 1, centralRadius);
		if (this._line.comment != null) {
			comment = new Comment(ctx, this._line.comment);
			commentxy = comment.draw(
				working,
				startxAfterFlow + working.globalSpacing,
				starty + working.globalSpacing,
				working.globalSpacing,
				working.globalSpacing,
				true
			);
			callliney = commentxy.y;
		} else {
			callliney = starty + working.globalSpacing;
		}

		//////////////////////////////////////////////////////////////////////////////
		// 5. Draw the call line text
		let textToPrint = null;
		if (Utilities.isAllStrings(this._line.text)) {
			textToPrint = this._line.text.slice();
			if (working.autonumber !== false) {
				let s = textToPrint[0];
				textToPrint[0] = this._callCount + ". " + s;
			}
		} else if (Utilities.isString(this._line.text)) {
			textToPrint = working.autonumber !== false ? this._callCount + ". " + this._line.text : this._line.text;
		} else {
			textToPrint = working.autonumber !== false ? this._callCount + ". " : "";
		}
		let wh = Utilities.getTextWidthAndHeight(ctx, calltmd, textToPrint, working.tags);
		const texty = callliney + wh.h;
		let xy = Actor.drawTimelines(working, ctx, starty, callliney + 2 * lineWidth + working.globalSpacing + arrowSizeY - starty, true);
		let finalHeightOfAllLine = texty > xy.y ? texty - starty : xy.y - starty;

		//////////////////////////////////////////////////////////////////////////////
		// Height now calculated .. not draw the items in order
		//////////////////////////////////////////////////////////////////////////////
		// 1. Background fragments
		//////////////////////////////////////////////////////////////////////////////
		// 2. Time lines
		//////////////////////////////////////////////////////////////////////////////
		// 3. Comment
		//////////////////////////////////////////////////////////////////////////////
		// 4. Call line
		//////////////////////////////////////////////////////////////////////////////
		// 4a. Call line arrow
		//////////////////////////////////////////////////////////////////////////////
		// 5a. Call text

		//////////////////////////////////////////////////////////////////////////////
		// 1. Background fragments
		Utilities.drawActiveStructuralFragmentBackgrounds(working, this._ctx, starty, finalHeightOfAllLine, mimic);
		Utilities.drawActiveRectHighlights(working, this._ctx, starty, finalHeightOfAllLine, mimic);

		//////////////////////////////////////////////////////////////////////////////
		// 2. Time lines
		this._actorFromClass.flowStartYPos = callliney;
		if (this._line.destroyFrom === true) {
			this._actorFromClass.lifecycleEndYPos = callliney + working.globalSpacing;
		}
		if (this._line.destroyTo === true && this._actorToClass != null) {
			this._actorToClass.lifecycleEndYPos = callliney + working.globalSpacing;
		}
		if (
			this._line.breakFromFlow === true ||
			this._line.breakFlow === true ||
			this._line.breakToFlow === true ||
			this._line.bff === true ||
			this._line.btf === true ||
			this._line.bf === true
		) {
			this._actorFromClass.flowEndYPos = callliney + working.globalSpacing + arrowSizeY;
		}
		if (this._line.async != true) {
			xy = Actor.drawTimelines(working, ctx, starty, finalHeightOfAllLine, mimic);
		} else {
			let gapForBreak = working.globalSpacing / 2 > 0 ? working.globalSpacing / 2 : 0;
			let breakAtYPos = callliney + working.globalSpacing / 2;
			let breakAtYPosForActor = this._actorFromClass.alias;
			xy = Actor.drawTimelinesWithBreak(working, ctx, starty, finalHeightOfAllLine, breakAtYPos, breakAtYPosForActor, gapForBreak, mimic);
		}
		if (this._line.destroyFrom === true) {
			setActorLifecycleActive(working, this._line.from, false);
		}
		if (this._line.destroyTo === true) {
			setActorLifecycleActive(working, this._line.to, false);
		}

		//////////////////////////////////////////////////////////////////////////////
		// 3. Comment
		if (comment != null) {
			commentxy = comment.draw(
				working,
				startxAfterFlow + working.globalSpacing,
				starty + working.globalSpacing,
				working.globalSpacing,
				working.globalSpacing,
				mimic
			);
		}

		//////////////////////////////////////////////////////////////////////////////
		// 4. Draw the line
		ctx.lineWidth = lineWidth;
		ctx.strokeStyle = lineColour;
		ctx.setLineDash(lineDash);
		ctx.beginPath();
		ctx.moveTo(startxAfterFlow, callliney);
		Utilities.drawOrMovePath(ctx, startxAfterFlow + 2 * working.globalSpacing - radius, callliney, mimic);
		Utilities.drawOrMoveArcTo(
			ctx,
			startxAfterFlow + 2 * working.globalSpacing,
			callliney, // x1, y1
			startxAfterFlow + 2 * working.globalSpacing,
			callliney + radius, //x2, y2
			radius, // radius
			mimic
		);
		Utilities.drawOrMovePath(ctx, startxAfterFlow + 2 * working.globalSpacing, callliney + working.globalSpacing - radius, mimic);
		Utilities.drawOrMoveArcTo(
			ctx,
			startxAfterFlow + 2 * working.globalSpacing,
			callliney + working.globalSpacing, // x1, y1
			startxAfterFlow + 2 * working.globalSpacing - radius,
			callliney + working.globalSpacing, //x2, y2
			radius,
			mimic
		);
		const endxAfterFlow = resolveCallEndpointX(this._startx, this._actorFromClass, toAnchorType, 1, centralRadius);
		Utilities.drawOrMovePath(ctx, endxAfterFlow, callliney + working.globalSpacing, mimic);
		ctx.stroke();

		//////////////////////////////////////////////////////////////////////////////
		// 5. Draw the line arrow
		drawCallArrowhead(
			ctx,
			endxAfterFlow,
			callliney + working.globalSpacing,
			"left",
			getCallArrowType(this._line, "to"),
			arrowSizeY,
			lineWidth,
			lineColour,
			false
		);
		if (fromAnchorType === "central") {
			drawCentralConnectionMarker(ctx, this._startx, callliney, centralRadius, lineWidth, lineColour, mimic);
		}
		if (toAnchorType === "central") {
			drawCentralConnectionMarker(
				ctx,
				this._startx,
				callliney + working.globalSpacing,
				centralRadius,
				lineWidth,
				lineColour,
				mimic
			);
		}

		//////////////////////////////////////////////////////////////////////////////
		// 5. Draw the call line text
		let calltextxy = Utilities.drawTextRectangleNoBorderOrBg(
			ctx,
			textToPrint,
			calltmd,
			callliney,
			startxAfterFlow + 2 * working.globalSpacing,
			null,
			null,
			mimic
		);
		Utilities.drawActiveStructuralFragmentBorders(working, this._ctx, starty, finalHeightOfAllLine, mimic);
		//////////////////////////////////////////////////////////////////////////////
		// let calltextxy = Utilities.drawTextRectangle(ctx, textToPrint,
		//////////////////////////////////////////////////////////////////////////////
		//    calltmd, callliney, startxAfterFlow + (2 * working.globalSpacing), null, null, 0, false, false, false, false, mimic);
		working.manageMaxWidth(calltextxy.x, calltextxy.y);
		return working.manageMaxWidth(0, starty + finalHeightOfAllLine);
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle draw different actor.
	 *
	 * @param {*} working Parameter derived from working.
	 * @param {*} starty Parameter derived from starty.
	 * @param {*} mimic Parameter derived from mimic.
	 * @returns {*} Result value.
	 * @example
	 * instance.drawDifferentActor(working, starty, mimic);
	 */
	drawDifferentActor(working, starty, mimic) {
		//////////////////////////////////////////////////////////////////////////////
		// Get the call TMD
		let calltmd = TextMetadata.getTextMetadataFromObject(working, this._line, working.postdata.params.call, Call.getDefaultTmd());
		calltmd.bgColour = "rgba(0,0,0,0)";

		//////////////////////////////////////////////////////////////////////////////
		// Get the line dash
		let lineDash = Array.isArray(this._line.lineDash) && Utilities.isAllNumber(this._line.lineDash) ? this._line.lineDash : [];

		//////////////////////////////////////////////////////////////////////////////
		const cross = Utilities.isBoolean(this._line.cross) && this._line.cross === true ? true : false;

		//////////////////////////////////////////////////////////////////////////////
		// Get the line width
		let lineWidth =
			Utilities.isNumber(this._line.lineWidth) && this._line.lineWidth > 0
				? this._line.lineWidth
				: working.postdata.params &&
				  working.postdata.params.call &&
				  Utilities.isNumber(working.postdata.params.call.lineWidth) &&
				  working.postdata.params.call.lineWidth > 0
				? working.postdata.params.call.lineWidth
				: 1;

		//////////////////////////////////////////////////////////////////////////////
		// Get the line colour
		let lineColour = Utilities.validColour(this._line.lineColour)
			? this._line.lineColour
			: working.postdata.params && working.postdata.params.call && Utilities.validColour(working.postdata.params.call.lineColour)
			? working.postdata.params.call.lineColour
			: "rgb(0, 0, 0)";

		//////////////////////////////////////////////////////////////////////////////
		// Get the arrow size
		let arrowSizeY =
			Utilities.isNumber(this._line.arrowSize) && this._line.arrowSize > 0
				? this._line.arrowSize
				: working.postdata.params &&
				  working.postdata.params.call &&
				  Utilities.isNumber(working.postdata.params.call.arrowSize) &&
				  working.postdata.params.call.arrowSize > 0
				? working.postdata.params.call.arrowSize
				: 5;

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
		let wh = Utilities.getTextWidthAndHeight(ctx, calltmd, textToPrint, working.tags);
		const textheight = wh.h;
		const fromAnchorType = getCallAnchorType(this._line, "from");
		const toAnchorType = getCallAnchorType(this._line, "to");
		const centralRadius = getCentralConnectionRadius(arrowSizeY);
		if (this._startx < this._endx) {
			startxAfterFlow = resolveCallEndpointX(this._startx, this._actorFromClass, fromAnchorType, 1, centralRadius);
			endxAfterFlow = resolveCallEndpointX(this._endx, this._actorToClass, toAnchorType, -1, centralRadius);
		} else {
			startxAfterFlow = resolveCallEndpointX(this._startx, this._actorFromClass, fromAnchorType, -1, centralRadius);
			endxAfterFlow = resolveCallEndpointX(this._endx, this._actorToClass, toAnchorType, 1, centralRadius);
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

		let xy = Actor.drawTimelines(working, ctx, starty, callliney + arrowSizeY - starty + working.globalSpacing / 3, true);
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
		Utilities.drawActiveStructuralFragmentBackgrounds(working, this._ctx, starty, finalHeightOfAllLine, mimic);
		Utilities.drawActiveRectHighlights(working, this._ctx, starty, finalHeightOfAllLine, mimic);

		//////////////////////////////////////////////////////////////////////////////
		// 2. Time lines
		this._actorFromClass.flowStartYPos = callliney;
		this._actorToClass.flowStartYPos = callliney;
		if (Utilities.isString(this._line.type) && this._line.type.toLowerCase() === "create") {
			this._actorToClass.lifecycleStartYPos = callliney;
		}
		if (this._line.destroyFrom === true) {
			this._actorFromClass.lifecycleEndYPos = callliney;
		}
		if (this._line.destroyTo === true) {
			this._actorToClass.lifecycleEndYPos = callliney;
		}
		if (this._line.breakFromFlow === true || this._line.bff === true) {
			this._actorFromClass.flowEndYPos = callliney + working.globalSpacing / 3;
		}
		if (this._line.breakToFlow === true || this._line.btf === true) {
			this._actorToClass.flowEndYPos = callliney + working.globalSpacing / 3;
		}
		xy = Actor.drawTimelines(working, ctx, starty, finalHeightOfAllLine, mimic);
		if (Utilities.isString(this._line.type) && this._line.type.toLowerCase() === "create") {
			setActorLifecycleActive(working, this._line.to, true);
		}
		if (this._line.destroyFrom === true) {
			setActorLifecycleActive(working, this._line.from, false);
		}
		if (this._line.destroyTo === true) {
			setActorLifecycleActive(working, this._line.to, false);
		}

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
				calltmd,
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
				calltmd,
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
		drawCallArrowhead(
			ctx,
			endxAfterFlow,
			callliney,
			goingRight ? "right" : "left",
			getCallArrowType(this._line, "to"),
			arrowSizeY,
			lineWidth,
			lineColour,
			false
		);
		drawCallArrowhead(
			ctx,
			startxAfterFlow,
			callliney,
			goingRight ? "left" : "right",
			getCallArrowType(this._line, "from"),
			arrowSizeY,
			lineWidth,
			lineColour,
			false
		);
		if (fromAnchorType === "central") {
			drawCentralConnectionMarker(ctx, this._startx, callliney, centralRadius, lineWidth, lineColour, mimic);
		}
		if (toAnchorType === "central") {
			drawCentralConnectionMarker(ctx, this._endx, callliney, centralRadius, lineWidth, lineColour, mimic);
		}
		Utilities.drawActiveStructuralFragmentBorders(working, this._ctx, starty, finalHeightOfAllLine, mimic);

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
			fontFamily: schema.call.properties.fontFamily.default,
			fontSizePx: schema.call.properties.fontSizePx.default,
			fgColour: schema.call.properties.fgColour.default,
			bgColour: "rgba(0,0,0,0)",
			padding: schema.call.properties.padding.default,
			spacing: schema.call.properties.spacing.default,
			align: schema.call.properties.align.default,
			borderColour: schema.call.properties.borderColour.default,
			borderWidth: schema.call.properties.borderWidth.default,
			borderDash: schema.call.properties.borderDash.default,
		};
		return defaultCallTmd;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle get self call default tmd.
	 * @returns {*} Result value.
	 * @example
	 * instance.getSelfCallDefaultTmd();
	 */
	static getSelfCallDefaultTmd() {
		const defaultCallTmd = {
			fontFamily: schema.call.properties.fontFamily.default,
			fontSizePx: schema.call.properties.fontSizePx.default,
			fgColour: schema.call.properties.fgColour.default,
			bgColour: "rgba(0,0,0,0)",
			padding: schema.call.properties.padding.default,
			spacing: schema.call.properties.spacing.default,
			align: schema.call.properties.align.default,
			borderColour: schema.call.properties.borderColour.default,
			borderWidth: schema.call.properties.borderWidth.default,
			borderDash: schema.call.properties.borderDash.default,
			vpadding: schema.call.properties.fontSizePx.default / 2,
		};
		return defaultCallTmd;
	}
};
