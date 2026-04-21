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
let ActorGroup = require("./ActorGroup.js");
const schema = require("./schema.js");
const InputDocumentError = require("./InputDocumentError.js");

module.exports = class Actor {
	static _linkIconPathData =
		"M634.48 932.5c.6-.73 1.32-1.2 2.16-1.45.84-.36 1.68-.48 2.52-.48 1.92 0 3.36.84 4.2 2.52 1.32 1.3 1.92 2.75 1.92 4.55 0 1.68-.6 3.12-1.92 4.44l-8.88 8.63c-3.12 3.12-6.72 5.52-10.8 7.08-3.96 1.7-7.92 2.53-12 2.53s-8.16-.84-12-2.52c-3.72-1.55-7.2-3.95-10.32-7.07-3-3-5.4-6.6-6.96-10.56-1.56-3.84-2.4-7.8-2.4-12 0-3.96.84-8.04 2.4-11.88 1.56-3.97 3.84-7.45 6.96-10.57l17.88-17.64c3.12-3.13 6.6-5.4 10.56-6.97 3.84-1.68 8.04-2.52 12.24-2.64 4.08 0 8.04.95 12 2.63 3.84 1.56 7.32 3.84 10.32 6.96 1.2 1.3 1.8 2.75 1.8 4.55 0 1.68-.6 3.12-1.8 4.44-.6.6-1.32 1.07-2.04 1.3-.84.37-1.68.5-2.52.5-.72 0-1.56-.13-2.4-.5-.72-.23-1.44-.7-2.04-1.3-3.6-3.97-7.92-5.9-13.08-5.9s-9.6 1.93-13.44 5.9l-17.76 17.5c-3.96 3.6-5.88 8.05-5.88 13.2 0 5.05 1.92 9.6 5.88 13.57 3.6 3.72 7.92 5.64 13.08 5.64s9.6-1.9 13.44-5.63l8.88-8.88zm55.92-82.57c3.12 3 5.4 6.36 6.96 10.32 1.8 3.96 2.64 7.92 2.64 12s-.84 8.04-2.64 11.88c-1.56 3.72-3.84 7.2-6.96 10.32l-17.64 17.64c-3.24 3.23-6.84 5.63-10.8 7.2-3.84 1.55-8.04 2.4-12.24 2.4-4.08 0-8.16-.85-12-2.4-3.84-1.57-7.32-4.1-10.08-7.2-.6-.6-.96-1.2-1.32-1.93-.36-.72-.48-1.56-.48-2.28 0-1.8.6-3.25 1.8-4.57.6-.48 1.2-.96 1.92-1.32.72-.35 1.56-.47 2.4-.47 1.68 0 3.12.6 4.44 1.8 1.68 1.92 3.72 3.36 6.12 4.32 4.56 1.8 9.72 1.8 14.28 0 2.4-.96 4.44-2.4 6.36-4.32l17.88-17.76c3.72-3.6 5.52-7.92 5.52-13.08 0-5.17-1.8-9.73-5.52-13.7-3.72-3.7-8.04-5.63-13.2-5.63s-9.72 1.92-13.68 5.64l-8.88 8.9c-.6.7-1.2 1.07-2.04 1.43-.72.36-1.56.48-2.4.48-.84 0-1.68-.1-2.4-.47-.84-.36-1.44-.72-2.04-1.44-.6-.5-1.08-1.2-1.44-1.93-.36-.84-.48-1.68-.48-2.52 0-1.68.6-3.12 1.92-4.44l8.88-8.87c3.12-3.12 6.72-5.52 10.56-7.08 3.84-1.56 8.04-2.52 12.24-2.52 4.08 0 8.04.84 12 2.64 3.84 1.44 7.32 3.84 10.32 6.96z";
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Initialise the Actor instance.
	 *
	 * @param {*} ctx Parameter derived from ctx.
	 * @param {*} actorObj Parameter derived from actorObj.
	 * @returns {void} Nothing.
	 * @example
	 * const instance = new Actor(ctx, actorObj);
	 */
	constructor(ctx, actorObj) {
		this._ctx = ctx;
		this._actorObj = actorObj;
		this._name = null;
		this._alias = null;
		this._height = null;
		this._width = null;
		this._top = null;
		this._left = null;
		this._middle = null;
		this._tmd = null;
		this._actorType = "participant";
		this._iconReservation = 0;
		this._linkBadgeReservation = 0;
		this._links = [];
		this._headerHeight = null;
		this._startx = null;
		this._starty = null;
		this._flowStateContinue = false;
		this._flowStartYPos = null;
		this._flowEndYPos = null;
		this._lifecycleStartYPos = null;
		this._lifecycleEndYPos = null;
		this._height = null;
		this._width = null;
		this._middle = null;
		this._gapToNext = null;
		this._radius = null;
		this._flowWidth = null;
		this._timelineDash = null;
		this._timelineWidth = null;
		this._actorTmd = null;

		//////////////////////////////////////////////////////////////////////////////
		// this._height = this._tmd.getBoxHeight(this._lines);
		//////////////////////////////////////////////////////////////////////////////
		// this._width = this._tmd.getBoxWidth(this._ctx, this._lines);
		//////////////////////////////////////////////////////////////////////////////
		// this._middle = this._startx + (this._width / 2);
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return actor tmd.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.actorTmd;
	 */
	get actorTmd() {
		return this._actorTmd;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return timeline width.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.timelineWidth;
	 */
	get timelineWidth() {
		return this._timelineWidth;
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
	 * Return flow width.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.flowWidth;
	 */
	get flowWidth() {
		return this._flowWidth;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return ctx.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.ctx;
	 */
	get ctx() {
		return this._ctx;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return radius.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.radius;
	 */
	get radius() {
		return this._radius;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return actor obj.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.actorObj;
	 */
	get actorObj() {
		return this._actorObj;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return gap to next.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.gapToNext;
	 */
	get gapToNext() {
		return this._gapToNext;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle set flow state continue.
	 * @returns {*} Result value.
	 * @example
	 * instance.setFlowStateContinue();
	 */
	setFlowStateContinue() {
		this._flowStateContinue = true;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle clear flow state continue.
	 * @returns {*} Result value.
	 * @example
	 * instance.clearFlowStateContinue();
	 */
	clearFlowStateContinue() {
		this._flowStateContinue = false;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle is flow state continue.
	 * @returns {*} Result value.
	 * @example
	 * instance.isFlowStateContinue();
	 */
	isFlowStateContinue() {
		return this._flowStateContinue;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return flow start ypos.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.flowStartYPos;
	 */
	get flowStartYPos() {
		return this._flowStartYPos;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return flow end ypos.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.flowEndYPos;
	 */
	get flowEndYPos() {
		return this._flowEndYPos;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Update flow start ypos.
	 *
	 * @param {*} value Parameter derived from value.
	 * @returns {void} Nothing.
	 * @example
	 * instance.flowStartYPos = value;
	 */
	set flowStartYPos(value) {
		this._flowStartYPos = value;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Update flow end ypos.
	 *
	 * @param {*} value Parameter derived from value.
	 * @returns {void} Nothing.
	 * @example
	 * instance.flowEndYPos = value;
	 */
	set flowEndYPos(value) {
		this._flowEndYPos = value;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return lifecycle start ypos.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.lifecycleStartYPos;
	 */
	get lifecycleStartYPos() {
		return this._lifecycleStartYPos;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return lifecycle end ypos.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.lifecycleEndYPos;
	 */
	get lifecycleEndYPos() {
		return this._lifecycleEndYPos;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Update lifecycle start ypos.
	 *
	 * @param {*} value Parameter derived from value.
	 * @returns {void} Nothing.
	 * @example
	 * instance.lifecycleStartYPos = value;
	 */
	set lifecycleStartYPos(value) {
		this._lifecycleStartYPos = value;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Update lifecycle end ypos.
	 *
	 * @param {*} value Parameter derived from value.
	 * @returns {void} Nothing.
	 * @example
	 * instance.lifecycleEndYPos = value;
	 */
	set lifecycleEndYPos(value) {
		this._lifecycleEndYPos = value;
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
	 * Return name.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.name;
	 */
	get name() {
		return this._name;
	}
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return alias.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.alias;
	 */
	get alias() {
		return this._alias;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return actor type.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.actorType;
	 */
	get actorType() {
		return this._actorType;
	}
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return middle.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.middle;
	 */
	get middle() {
		return this._middle;
	}
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return width.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.width;
	 */
	get width() {
		return this._width;
	}
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return left.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.left;
	 */
	get left() {
		return this._left;
	}
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return right.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.right;
	 */
	get right() {
		return this._right;
	}
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return x.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.x;
	 */
	get x() {
		return this._startx;
	}
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return y.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.y;
	 */
	get y() {
		return this._starty;
	}
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return tmd.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.tmd;
	 */
	get tmd() {
		return this._tmd;
	}
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return actor box height.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.height;
	 */
	get height() {
		return this._height;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return actor box width.
	 * @returns {*} Result value.
	 * @example
	 * const value = instance.width;
	 */
	get width() {
		return this._width;
	}
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Update startx.
	 *
	 * @param {*} x Parameter derived from x.
	 * @returns {void} Nothing.
	 * @example
	 * instance.startx = value;
	 */
	set startx(x) {
		this._startx = x;
	}
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Update starty.
	 *
	 * @param {*} y Parameter derived from y.
	 * @returns {void} Nothing.
	 * @example
	 * instance.starty = value;
	 */
	set starty(y) {
		this._starty = y;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Draw the actor element.
	 *
	 * @param {*} working Parameter derived from working.
	 * @param {*} startx Parameter derived from startx.
	 * @param {*} starty Parameter derived from starty.
	 * @param {*} mimic Parameter derived from mimic.
	 * @returns {*} Result value.
	 * @example
	 * instance.draw(working, startx, starty, mimic);
	 */
	draw(working, startx, starty, mimic) {
		if (!Utilities.isObject(this._actorObj)) {
			throw new InputDocumentError("actor entry is not a valid object", this._actorObj);
		}
		if (!Utilities.isString(this._actorObj.name) && !Array.isArray(this.actorObj.name)) {
			throw new InputDocumentError("actor is missing a valid 'name'", this._actorObj);
		} else {
			this._name = this.actorObj.name;
		}
		if (!Utilities.isString(this.actorObj.alias)) {
			throw new InputDocumentError("actor is missing a valid 'alias'", this._actorObj);
		} else {
			this._alias = this.actorObj.alias;
		}
		this._actorType = Actor._normaliseActorType(this.actorObj.actorType);
		this._links = Array.isArray(this.actorObj.links)
			? this.actorObj.links.filter((link) => Utilities.isObject(link) && Utilities.isString(link.label) && Utilities.isString(link.url))
			: [];
		if (!working.postdata) {
			working.postdata = {};
		}
		if (!working.postdata.params) {
			working.postdata.params = {};
		}
		if (!working.postdata.params.actor) {
			working.postdata.params.actor = {};
		}
		//////////////////////////////////////////////////////////////////////////////
		// Initialise drawing parameters
		let actortmd = TextMetadata.getTextMetadataFromObject(working, this.actorObj, working.postdata.params.actor, Actor.getDefaultTmd());
		this._actorTmd = actortmd;
		this._gapToNext =
			Utilities.isNumber(this.actorObj.gapToNext) && this.actorObj.gapToNext > 0
				? this.actorObj.gapToNext
				: working.postdata.params && working.postdata.params.actor && Utilities.isNumberGt0(working.postdata.params.actor.gapToNext)
				? working.postdata.params.actor.gapToNext
				: schema.actor.properties.gapToNext.default;
		this._radius = Utilities.isNumberGtEq0(this.actorObj.radius)
			? this.actorObj.radius
			: working.postdata.params && working.postdata.params.actor && Utilities.isNumberGtEq0(working.postdata.params.actor.radius)
			? working.postdata.params.actor.radius
			: schema.actor.properties.radius.default;
		this._flowWidth = Utilities.isNumberGt0(this.actorObj.flowWidth)
			? this.actorObj.flowWidth
			: working.postdata.params && working.postdata.params.actor && Utilities.isNumberGtEq0(working.postdata.params.actor.flowWidth)
			? working.postdata.params.actor.flowWidth
			: schema.actor.properties.flowWidth.default;
		this._timelineWidth = Utilities.isNumberGt0(this.actorObj.timelineWidth)
			? this.actorObj.timelineWidth
			: working.postdata.params && working.postdata.params.actor && Utilities.isNumberGtEq0(working.postdata.params.actor.timelineWidth)
			? working.postdata.params.actor.timelineWidth
			: schema.actor.properties.timelineWidth.default;
		this._timelineDash = Utilities.isAllNumber(this.actorObj.timelineDash)
			? this.actorObj.timelineDash
			: working.postdata.params && working.postdata.params.actor && Utilities.isAllNumber(working.postdata.params.actor.timelineDash)
			? working.postdata.params.actor.timelineDash
			: schema.actor.properties.timelineDash.default;

		//////////////////////////////////////////////////////////////////////////////
		// Draw the actor, obeying the mimic request
		this._startx = startx;
		this._starty = starty;
		const wh = Utilities.getTextWidthAndHeight(this._ctx, actortmd, this._name, working.tags);
		this._iconReservation = Actor._getHeaderIconReservation(this._actorType, actortmd.fontSizePx);
		this._linkBadgeReservation = this._links.length > 0 ? Actor._getHeaderLinkBadgeReservation(actortmd.fontSizePx) : 0;

		this._headerHeight = wh.h;
		this._height = this._headerHeight;
		this._width = wh.w + this._iconReservation + this._linkBadgeReservation;
		this._left = this._startx;
		this._right = this._startx + this._width;
		this._middle = this._startx + this._width / 2;
		if (!Utilities.isNumber(working.scratchPad.maxActorHeight)) {
			working.scratchPad.maxActorHeight = 0;
		}
		if (this._height > working.scratchPad.maxActorHeight) {
			working.scratchPad.maxActorHeight = this._height;
		} else {
			this._height = working.scratchPad.maxActorHeight;
		}

		const lifecycleState =
			working.actorLifecycleState && Utilities.isObject(working.actorLifecycleState[this._alias])
				? working.actorLifecycleState[this._alias]
				: null;
		const suppressTopHeader = lifecycleState && lifecycleState.firstEvent === "create";
		let xy = {
			x: this._startx + this._width,
			y: this._starty + this._height,
		};
		if (!suppressTopHeader) {
			xy = this.drawHeader(working, this._starty, mimic, wh);
		}

		//////////////////////////////////////////////////////////////////////////////
		// Return
		return working.manageMaxWidthXy(xy);
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Draw the actor header box at an arbitrary y position.
	 *
	 * @param {*} working Parameter derived from working.
	 * @param {*} topY Parameter derived from topY.
	 * @param {*} mimic Parameter derived from mimic.
	 * @param {*} wh Optional cached text width/height.
	 * @returns {*} Result value.
	 * @example
	 * instance.drawHeader(working, topY, mimic, wh);
	 */
	drawHeader(working, topY, mimic, wh) {
		const actortmd = this._actorTmd;
		const textSize = wh || Utilities.getTextWidthAndHeight(this._ctx, actortmd, this._name, working.tags);
		const headerBgColour = this._iconReservation > 0 ? actortmd.bgColour || "rgb(210,210,210)" : "rgb(210,210,210)";
		let xy = Utilities.drawRectangle(
			this._ctx,
			0,
			null,
			null,
			headerBgColour,
			topY + 3,
			this._startx + 3,
			this._width,
			this._headerHeight,
			this._radius,
			false,
			false,
			false,
			false,
			mimic
		);
		working.manageMaxWidthXy(xy);
		if (this._iconReservation > 0) {
			xy = this._drawHeaderIcon(topY, mimic);
			working.manageMaxWidthXy(xy);
		}
		if (this._linkBadgeReservation > 0) {
			xy = this._drawHeaderLinkBadge(topY, mimic);
			working.manageMaxWidthXy(xy);
		}
		if (this._iconReservation > 0) {
			const previousBgColour = actortmd.bgColour;
			const previousBorderColour = actortmd.borderColour;
			const previousBorderWidth = actortmd.borderWidth;
			const previousBorderDash = actortmd.borderDash;
			actortmd.bgColour = "rgba(0,0,0,0)";
			actortmd.borderColour = null;
			actortmd.borderWidth = 0;
			actortmd.borderDash = [];
			xy = Utilities.drawTextRectangle(
				this._ctx,
				this._name,
				actortmd,
				topY,
				this._startx + this._iconReservation,
				this._width - this._iconReservation - this._linkBadgeReservation,
				this._headerHeight,
				this._radius,
				false,
				false,
				false,
				false,
				mimic,
				textSize,
				working.tags
			);
			actortmd.bgColour = previousBgColour;
			actortmd.borderColour = previousBorderColour;
			actortmd.borderWidth = previousBorderWidth;
			actortmd.borderDash = previousBorderDash;
		} else {
			xy = Utilities.drawTextRectangle(
				this._ctx,
				this._name,
				actortmd,
				topY,
				this._startx,
				this._width - this._linkBadgeReservation,
				this._headerHeight,
				this._radius,
				true,
				true,
				true,
				true,
				mimic,
				textSize,
				working.tags
			);
		}
		return working.manageMaxWidthXy(xy);
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Draw the specialised participant icon within the actor header.
	 *
	 * @param {*} topY Parameter derived from topY.
	 * @param {*} mimic Parameter derived from mimic.
	 * @returns {*} Result value.
	 * @example
	 * instance._drawHeaderIcon(topY, mimic);
	 */
	_drawHeaderIcon(topY, mimic) {
		const iconBoxLeft = this._startx + 6;
		const iconBoxTop = topY + 4;
		const iconBoxWidth = Math.max(12, this._iconReservation - 10);
		const iconBoxHeight = Math.max(12, this._headerHeight - 8);
		const lineColour = this._actorTmd.borderColour || "rgb(0,0,0)";
		const lineWidth = 1.5;

		if (mimic) {
			return {
				x: iconBoxLeft + iconBoxWidth,
				y: iconBoxTop + iconBoxHeight,
			};
		}

		switch (this._actorType) {
			case "actor":
				this._drawActorPersonIcon(iconBoxLeft, iconBoxTop, iconBoxWidth, iconBoxHeight, lineColour, lineWidth);
				break;
			case "boundary":
				this._drawBoundaryIcon(iconBoxLeft, iconBoxTop, iconBoxWidth, iconBoxHeight, lineColour, lineWidth);
				break;
			case "control":
				this._drawControlIcon(iconBoxLeft, iconBoxTop, iconBoxWidth, iconBoxHeight, lineColour, lineWidth);
				break;
			case "entity":
				this._drawEntityIcon(iconBoxLeft, iconBoxTop, iconBoxWidth, iconBoxHeight, lineColour, lineWidth);
				break;
			case "database":
				this._drawDatabaseIcon(iconBoxLeft, iconBoxTop, iconBoxWidth, iconBoxHeight, lineColour, lineWidth);
				break;
			case "collections":
				this._drawCollectionsIcon(iconBoxLeft, iconBoxTop, iconBoxWidth, iconBoxHeight, lineColour, lineWidth);
				break;
			case "queue":
				this._drawQueueIcon(iconBoxLeft, iconBoxTop, iconBoxWidth, iconBoxHeight, lineColour, lineWidth);
				break;
			default:
				break;
		}

		return {
			x: iconBoxLeft + iconBoxWidth,
			y: iconBoxTop + iconBoxHeight,
		};
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Draw a compact link badge within the actor header when links exist.
	 *
	 * @param {*} topY Parameter derived from topY.
	 * @param {*} mimic Parameter derived from mimic.
	 * @returns {*} Result value.
	 * @example
	 * instance._drawHeaderLinkBadge(topY, mimic);
	 */
	_drawHeaderLinkBadge(topY, mimic) {
		const badgeWidth = Math.max(20, this._linkBadgeReservation - 4);
		const badgeHeight = Math.max(16, this._headerHeight - 8);
		const badgeLeft = this._startx + this._width - this._linkBadgeReservation + 1;
		const badgeTop = topY + Math.max(4, Math.round((this._headerHeight - badgeHeight) / 2));
		const ctx = this._ctx;
		const strokeColour = "rgb(0, 70, 140)";

		if (mimic) {
			return {
				x: badgeLeft + badgeWidth,
				y: badgeTop + badgeHeight,
			};
		}

		if (typeof ctx.addSvgElement === "function") {
			const sourceLeft = 580;
			const sourceTop = 840.33;
			const sourceSize = 120;
			const scale = Math.min(badgeWidth / sourceSize, badgeHeight / sourceSize);
			const renderedWidth = sourceSize * scale;
			const renderedHeight = sourceSize * scale;
			const translateX = badgeLeft + (badgeWidth - renderedWidth) / 2;
			const translateY = badgeTop + (badgeHeight - renderedHeight) / 2;
			ctx.addSvgElement("path", {
				d: Actor._linkIconPathData,
				fill: strokeColour,
				stroke: "none",
				transform: `translate(${translateX} ${translateY}) scale(${scale}) translate(${-sourceLeft} ${-sourceTop})`,
			});
		} else {
			this._drawFallbackChainLinkIcon(badgeLeft, badgeTop, badgeWidth, badgeHeight, strokeColour);
		}

		return {
			x: badgeLeft + badgeWidth,
			y: badgeTop + badgeHeight,
		};
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Draw a fallback chain-link icon when raw SVG path injection is not
	 * available.
	 *
	 * @param {*} left Parameter derived from left.
	 * @param {*} top Parameter derived from top.
	 * @param {*} width Parameter derived from width.
	 * @param {*} height Parameter derived from height.
	 * @param {*} strokeColour Parameter derived from strokeColour.
	 * @returns {void} Nothing.
	 * @example
	 * instance._drawFallbackChainLinkIcon(1, 2, 20, 16, "rgb(0,70,140)");
	 */
	_drawFallbackChainLinkIcon(left, top, width, height, strokeColour) {
		const ctx = this._ctx;
		const lineWidth = Math.max(2, Math.min(width, height) * 0.12);
		const radius = Math.max(4, Math.min(width, height) * 0.22);
		const firstStart = { x: left + width * 0.28, y: top + height * 0.72 };
		const firstEnd = { x: left + width * 0.5, y: top + height * 0.5 };
		const secondStart = { x: left + width * 0.5, y: top + height * 0.5 };
		const secondEnd = { x: left + width * 0.72, y: top + height * 0.28 };

		const drawCapsule = (startPoint, endPoint) => {
			const dx = endPoint.x - startPoint.x;
			const dy = endPoint.y - startPoint.y;
			const length = Math.sqrt(dx * dx + dy * dy);
			if (length <= 0.0001) {
				return;
			}
			const ux = dx / length;
			const uy = dy / length;
			const px = -uy;
			const py = ux;
			const startOuterX = startPoint.x + px * radius;
			const startOuterY = startPoint.y + py * radius;
			const endOuterX = endPoint.x + px * radius;
			const endOuterY = endPoint.y + py * radius;
			const startInnerX = startPoint.x - px * radius;
			const startInnerY = startPoint.y - py * radius;
			const outerAngle = Math.atan2(py, px);
			const innerAngle = Math.atan2(-py, -px);

			ctx.beginPath();
			ctx.moveTo(startOuterX, startOuterY);
			ctx.lineTo(endOuterX, endOuterY);
			ctx.arc(endPoint.x, endPoint.y, radius, outerAngle, innerAngle, false);
			ctx.lineTo(startInnerX, startInnerY);
			ctx.arc(startPoint.x, startPoint.y, radius, innerAngle, outerAngle, false);
			ctx.stroke();
		};

		ctx.lineWidth = lineWidth;
		ctx.strokeStyle = strokeColour;
		ctx.setLineDash([]);
		drawCapsule(firstStart, firstEnd);
		drawCapsule(secondStart, secondEnd);
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Draw a stick-person icon for Mermaid actors.
	 *
	 * @param {*} left Parameter derived from left.
	 * @param {*} top Parameter derived from top.
	 * @param {*} width Parameter derived from width.
	 * @param {*} height Parameter derived from height.
	 * @param {*} lineColour Parameter derived from lineColour.
	 * @param {*} lineWidth Parameter derived from lineWidth.
	 * @returns {void} Nothing.
	 * @example
	 * instance._drawActorPersonIcon(left, top, width, height, lineColour, lineWidth);
	 */
	_drawActorPersonIcon(left, top, width, height, lineColour, lineWidth) {
		const ctx = this._ctx;
		const headRadius = Math.max(3, Math.min(width, height) * 0.14);
		const centreX = left + width * 0.4;
		const headCentreY = top + height * 0.28;
		const shoulderY = headCentreY + headRadius + 2;
		const hipY = top + height * 0.68;
		const armSpan = width * 0.22;
		const legSpan = width * 0.18;

		ctx.lineWidth = lineWidth;
		ctx.strokeStyle = lineColour;
		ctx.setLineDash([]);
		ctx.beginPath();
		ctx.arc(centreX, headCentreY, headRadius, 0, 2 * Math.PI);
		ctx.moveTo(centreX, shoulderY);
		ctx.lineTo(centreX, hipY);
		ctx.moveTo(centreX - armSpan, shoulderY + 2);
		ctx.lineTo(centreX + armSpan, shoulderY + 2);
		ctx.moveTo(centreX, hipY);
		ctx.lineTo(centreX - legSpan, top + height - 2);
		ctx.moveTo(centreX, hipY);
		ctx.lineTo(centreX + legSpan, top + height - 2);
		ctx.stroke();
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Draw a boundary icon.
	 *
	 * @param {*} left Parameter derived from left.
	 * @param {*} top Parameter derived from top.
	 * @param {*} width Parameter derived from width.
	 * @param {*} height Parameter derived from height.
	 * @param {*} lineColour Parameter derived from lineColour.
	 * @param {*} lineWidth Parameter derived from lineWidth.
	 * @returns {void} Nothing.
	 * @example
	 * instance._drawBoundaryIcon(left, top, width, height, lineColour, lineWidth);
	 */
	_drawBoundaryIcon(left, top, width, height, lineColour, lineWidth) {
		const ctx = this._ctx;
		const innerTop = top + 3;
		const innerBottom = top + height - 3;
		const leftBar = left + width * 0.18;
		const rightBar = left + width * 0.62;

		ctx.lineWidth = lineWidth;
		ctx.strokeStyle = lineColour;
		ctx.setLineDash([]);
		ctx.beginPath();
		ctx.moveTo(leftBar, innerTop);
		ctx.lineTo(leftBar, innerBottom);
		ctx.moveTo(rightBar, innerTop);
		ctx.lineTo(rightBar, innerBottom);
		ctx.moveTo(leftBar, innerTop);
		ctx.lineTo(rightBar, innerTop);
		ctx.moveTo(leftBar, innerBottom);
		ctx.lineTo(rightBar, innerBottom);
		ctx.stroke();
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Draw a control icon.
	 *
	 * @param {*} left Parameter derived from left.
	 * @param {*} top Parameter derived from top.
	 * @param {*} width Parameter derived from width.
	 * @param {*} height Parameter derived from height.
	 * @param {*} lineColour Parameter derived from lineColour.
	 * @param {*} lineWidth Parameter derived from lineWidth.
	 * @returns {void} Nothing.
	 * @example
	 * instance._drawControlIcon(left, top, width, height, lineColour, lineWidth);
	 */
	_drawControlIcon(left, top, width, height, lineColour, lineWidth) {
		const ctx = this._ctx;
		const centreX = left + width * 0.4;
		const centreY = top + height * 0.52;
		const radius = Math.max(5, Math.min(width, height) * 0.26);

		ctx.lineWidth = lineWidth;
		ctx.strokeStyle = lineColour;
		ctx.setLineDash([]);
		ctx.beginPath();
		ctx.arc(centreX, centreY, radius, 0, 2 * Math.PI);
		ctx.moveTo(centreX - radius, centreY);
		ctx.lineTo(centreX + radius, centreY);
		ctx.moveTo(centreX, centreY - radius);
		ctx.lineTo(centreX, centreY + radius);
		ctx.stroke();
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Draw an entity icon.
	 *
	 * @param {*} left Parameter derived from left.
	 * @param {*} top Parameter derived from top.
	 * @param {*} width Parameter derived from width.
	 * @param {*} height Parameter derived from height.
	 * @param {*} lineColour Parameter derived from lineColour.
	 * @param {*} lineWidth Parameter derived from lineWidth.
	 * @returns {void} Nothing.
	 * @example
	 * instance._drawEntityIcon(left, top, width, height, lineColour, lineWidth);
	 */
	_drawEntityIcon(left, top, width, height, lineColour, lineWidth) {
		const ctx = this._ctx;
		const boxLeft = left + width * 0.12;
		const boxTop = top + 3;
		const boxWidth = width * 0.56;
		const boxHeight = height - 6;
		const fold = Math.max(4, Math.min(boxWidth, boxHeight) * 0.22);

		ctx.lineWidth = lineWidth;
		ctx.strokeStyle = lineColour;
		ctx.setLineDash([]);
		ctx.beginPath();
		ctx.moveTo(boxLeft, boxTop);
		ctx.lineTo(boxLeft + boxWidth - fold, boxTop);
		ctx.lineTo(boxLeft + boxWidth, boxTop + fold);
		ctx.lineTo(boxLeft + boxWidth, boxTop + boxHeight);
		ctx.lineTo(boxLeft, boxTop + boxHeight);
		ctx.lineTo(boxLeft, boxTop);
		ctx.moveTo(boxLeft + boxWidth - fold, boxTop);
		ctx.lineTo(boxLeft + boxWidth - fold, boxTop + fold);
		ctx.lineTo(boxLeft + boxWidth, boxTop + fold);
		ctx.stroke();
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Draw a database icon.
	 *
	 * @param {*} left Parameter derived from left.
	 * @param {*} top Parameter derived from top.
	 * @param {*} width Parameter derived from width.
	 * @param {*} height Parameter derived from height.
	 * @param {*} lineColour Parameter derived from lineColour.
	 * @param {*} lineWidth Parameter derived from lineWidth.
	 * @returns {void} Nothing.
	 * @example
	 * instance._drawDatabaseIcon(left, top, width, height, lineColour, lineWidth);
	 */
	_drawDatabaseIcon(left, top, width, height, lineColour, lineWidth) {
		const ctx = this._ctx;
		const boxLeft = left + width * 0.1;
		const boxWidth = width * 0.6;
		const topY = top + 4;
		const bottomY = top + height - 4;
		const ellipseHeight = Math.max(4, height * 0.16);
		const centreX = boxLeft + boxWidth / 2;
		const radiusX = boxWidth / 2;
		const radiusY = ellipseHeight / 2;

		ctx.lineWidth = lineWidth;
		ctx.strokeStyle = lineColour;
		ctx.setLineDash([]);
		ctx.beginPath();
		ctx.moveTo(boxLeft, topY + radiusY);
		ctx.lineTo(boxLeft, bottomY - radiusY);
		ctx.moveTo(boxLeft + boxWidth, topY + radiusY);
		ctx.lineTo(boxLeft + boxWidth, bottomY - radiusY);
		ctx.stroke();

		ctx.beginPath();
		ctx.arc(centreX, topY + radiusY, radiusX, Math.PI, 0, false);
		ctx.stroke();
		ctx.beginPath();
		ctx.arc(centreX, topY + radiusY, radiusX, 0, Math.PI, false);
		ctx.stroke();
		ctx.beginPath();
		ctx.arc(centreX, bottomY - radiusY, radiusX, 0, Math.PI, false);
		ctx.stroke();
		ctx.beginPath();
		ctx.arc(centreX, bottomY - radiusY, radiusX, Math.PI, 0, false);
		ctx.stroke();
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Draw a collections icon.
	 *
	 * @param {*} left Parameter derived from left.
	 * @param {*} top Parameter derived from top.
	 * @param {*} width Parameter derived from width.
	 * @param {*} height Parameter derived from height.
	 * @param {*} lineColour Parameter derived from lineColour.
	 * @param {*} lineWidth Parameter derived from lineWidth.
	 * @returns {void} Nothing.
	 * @example
	 * instance._drawCollectionsIcon(left, top, width, height, lineColour, lineWidth);
	 */
	_drawCollectionsIcon(left, top, width, height, lineColour, lineWidth) {
		const backLeft = left + width * 0.18;
		const backTop = top + 3;
		const frontLeft = left + width * 0.08;
		const frontTop = top + 7;
		const boxWidth = width * 0.52;
		const boxHeight = height - 10;
		Utilities.drawRectangle(this._ctx, lineWidth, lineColour, [], null, backTop, backLeft, boxWidth, boxHeight, 0, true, true, true, true, false);
		Utilities.drawRectangle(this._ctx, lineWidth, lineColour, [], null, frontTop, frontLeft, boxWidth, boxHeight, 0, true, true, true, true, false);
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Draw a queue icon.
	 *
	 * @param {*} left Parameter derived from left.
	 * @param {*} top Parameter derived from top.
	 * @param {*} width Parameter derived from width.
	 * @param {*} height Parameter derived from height.
	 * @param {*} lineColour Parameter derived from lineColour.
	 * @param {*} lineWidth Parameter derived from lineWidth.
	 * @returns {void} Nothing.
	 * @example
	 * instance._drawQueueIcon(left, top, width, height, lineColour, lineWidth);
	 */
	_drawQueueIcon(left, top, width, height, lineColour, lineWidth) {
		const ctx = this._ctx;
		const startX = left + width * 0.08;
		const endX = left + width * 0.56;
		const yPositions = [top + height * 0.3, top + height * 0.5, top + height * 0.7];
		const arrowX = left + width * 0.72;

		ctx.lineWidth = lineWidth;
		ctx.strokeStyle = lineColour;
		ctx.setLineDash([]);
		ctx.beginPath();
		yPositions.forEach((yPos) => {
			ctx.moveTo(startX, yPos);
			ctx.lineTo(endX, yPos);
		});
		ctx.moveTo(arrowX - 6, top + height * 0.5);
		ctx.lineTo(arrowX, top + height * 0.5);
		ctx.moveTo(arrowX - 4, top + height * 0.5 - 4);
		ctx.lineTo(arrowX, top + height * 0.5);
		ctx.lineTo(arrowX - 4, top + height * 0.5 + 4);
		ctx.stroke();
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return the supported actor type for rendering.
	 *
	 * @param {*} actorType Parameter derived from actorType.
	 * @returns {*} Result value.
	 * @example
	 * const value = Actor._normaliseActorType(actorType);
	 */
	static _normaliseActorType(actorType) {
		if (
			Utilities.isString(actorType) &&
			["participant", "actor", "boundary", "control", "entity", "database", "collections", "queue"].includes(actorType)
		) {
			return actorType;
		}
		return "participant";
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return the reserved width for an actor-type icon.
	 *
	 * @param {*} actorType Parameter derived from actorType.
	 * @param {*} fontSizePx Parameter derived from fontSizePx.
	 * @returns {*} Result value.
	 * @example
	 * const value = Actor._getHeaderIconReservation(actorType, fontSizePx);
	 */
	static _getHeaderIconReservation(actorType, fontSizePx) {
		if (actorType === "participant") {
			return 0;
		}
		const baseSize = Utilities.isNumberGt0(fontSizePx) ? fontSizePx : 18;
		return Math.max(26, Math.round(baseSize * 1.5));
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return the reserved width for a compact header link badge.
	 *
	 * @param {*} fontSizePx Parameter derived from fontSizePx.
	 * @returns {*} Result value.
	 * @example
	 * const value = Actor._getHeaderLinkBadgeReservation(fontSizePx);
	 */
	static _getHeaderLinkBadgeReservation(fontSizePx) {
		const baseSize = Utilities.isNumberGt0(fontSizePx) ? fontSizePx : 18;
		return Math.max(30, Math.round(baseSize * 1.55));
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle draw all actors.
	 *
	 * @param {*} working Parameter derived from working.
	 * @param {*} ctx Parameter derived from ctx.
	 * @param {*} starty Parameter derived from starty.
	 * @returns {*} Result value.
	 * @example
	 * instance.drawAllActors(working, ctx, starty);
	 */
	static drawAllActors(working, ctx, starty) {
		let actorStartY = starty;
		let nextActorX = working.startX;
		let maxx = 0;
		let maxy = 0;

		if (!Array.isArray(working.postdata.actors) || working.postdata.actors.length == 0) {
			throw new InputDocumentError("document must define at least one actor in the top-level 'actors' array", working.postdata);
		}

		//////////////////////////////////////////////////////////////////////////////
		// Initialise the actors with mimic=true, primarily to get the same height across all of them
		working.postdata.actors.forEach((actor) => {
			actor.clinstance = new Actor(ctx, actor);
			let xy = actor.clinstance.draw(working, nextActorX, actorStartY, true);
			nextActorX = xy.x + actor.clinstance.gapToNext;
			maxx = xy.x > maxx ? xy.x : maxx;
			maxy = xy.y > maxy ? xy.y : maxy;
		});

		//////////////////////////////////////////////////////////////////////////////
		// Draw bottom-layer actor groups now that actor positions are known.
		ActorGroup.drawAll(working, ctx, actorStartY, false);

		//////////////////////////////////////////////////////////////////////////////
		// Now actually draw the actors
		nextActorX = working.startX;
		working.postdata.actors.forEach((actor) => {
			let xy = actor.clinstance.draw(working, nextActorX, actorStartY, false);
			nextActorX = xy.x + actor.clinstance.gapToNext;
			maxx = xy.x > maxx ? xy.x : maxx;
			maxy = xy.y > maxy ? xy.y : maxy;
		});
		return working.manageMaxWidth(maxx, maxy);
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle clear all flows.
	 *
	 * @param {*} working Parameter derived from working.
	 * @param {*} starty Parameter derived from starty.
	 * @returns {*} Result value.
	 * @example
	 * instance.clearAllFlows(working, starty);
	 */
	static clearAllFlows(working, starty) {
		if (!Array.isArray(working.postdata && working.postdata.actors)) {
			return;
		}
		working.postdata.actors.forEach((actor) => {
			if (actor.clinstance && actor.clinstance.isFlowStateContinue()) actor.clinstance.flowEndYPos = starty;
		});
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle draw timelines.
	 *
	 * @param {*} working Parameter derived from working.
	 * @param {*} ctx Parameter derived from ctx.
	 * @param {*} starty Parameter derived from starty.
	 * @param {*} minimumHeight Parameter derived from minimumHeight.
	 * @param {*} mimic Parameter derived from mimic.
	 * @returns {*} Result value.
	 * @example
	 * instance.drawTimelines(working, ctx, starty, minimumHeight, mimic);
	 */
	static drawTimelines(working, ctx, starty, minimumHeight, mimic) {
		return Actor.drawTimelinesWithBreak(working, ctx, starty, minimumHeight, null, null, null, mimic);
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Draw an activation/flow rectangle only when it has visible area.
	 *
	 * @param {*} ctx Parameter derived from ctx.
	 * @param {*} fillColour Parameter derived from fillColour.
	 * @param {*} top Parameter derived from top.
	 * @param {*} left Parameter derived from left.
	 * @param {*} width Parameter derived from width.
	 * @param {*} height Parameter derived from height.
	 * @param {*} radius Parameter derived from radius.
	 * @param {*} topBorder Parameter derived from topBorder.
	 * @param {*} rightBorder Parameter derived from rightBorder.
	 * @param {*} bottomBorder Parameter derived from bottomBorder.
	 * @param {*} leftBorder Parameter derived from leftBorder.
	 * @param {*} mimic Parameter derived from mimic.
	 * @returns {void} Nothing.
	 * @example
	 * Actor.drawFlowRectangle(ctx, fillColour, top, left, width, height, radius, topBorder, rightBorder, bottomBorder, leftBorder, mimic);
	 */
	static drawFlowRectangle(ctx, fillColour, top, left, width, height, radius, topBorder, rightBorder, bottomBorder, leftBorder, mimic) {
		if (!Utilities.isNumber(width) || !Utilities.isNumber(height) || width <= 0 || height < 0) {
			return;
		}

		// Zero-height flow rectangles only need the visible termination cap.
		if (height === 0) {
			if (!mimic && (topBorder === true || bottomBorder === true)) {
				let oldStrokeStyle = ctx.strokeStyle;
				let oldLineDash = ctx.getLineDash();
				let oldLineWidth = ctx.lineWidth;
				ctx.strokeStyle = "rgb(0, 0, 0)";
				ctx.setLineDash([]);
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.moveTo(left, top);
				ctx.lineTo(left + width, top);
				ctx.stroke();
				ctx.strokeStyle = oldStrokeStyle;
				ctx.setLineDash(oldLineDash);
				ctx.lineWidth = oldLineWidth;
			}
			return;
		}

		Utilities.drawRectangle(
			ctx,
			1,
			"rgb(0, 0, 0)",
			[],
			fillColour,
			top,
			left,
			width,
			height,
			radius,
			topBorder,
			rightBorder,
			bottomBorder,
			leftBorder,
			mimic
		);
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle draw timelines with break.
	 *
	 * @param {*} working Parameter derived from working.
	 * @param {*} ctx Parameter derived from ctx.
	 * @param {*} starty Parameter derived from starty.
	 * @param {*} minimumHeight Parameter derived from minimumHeight.
	 * @param {*} breakAtYPos Parameter derived from breakAtYPos.
	 * @param {*} breakAtYPosForActor Parameter derived from breakAtYPosForActor.
	 * @param {*} gapForBreak Parameter derived from gapForBreak.
	 * @param {*} mimic Parameter derived from mimic.
	 * @returns {*} Result value.
	 * @example
	 * instance.drawTimelinesWithBreak(working, ctx, starty, minimumHeight, breakAtYPos, breakAtYPosForActor, gapForBreak, mimic);
	 */
	static drawTimelinesWithBreak(working, ctx, starty, minimumHeight, breakAtYPos, breakAtYPosForActor, gapForBreak, mimic) {
		let maxx = 0;
		let maxy = 0;
		if (!Array.isArray(working.postdata && working.postdata.actors)) {
			return working.manageMaxWidth(working.startX, starty + minimumHeight);
		}
		const drawableActors = working.postdata.actors.filter((actor) => actor && actor.clinstance);
		if (drawableActors.length === 0) {
			return working.manageMaxWidth(working.startX, starty + minimumHeight);
		}
		drawableActors.forEach((actor) => {
			const actorcl = actor.clinstance;
			let extra = actorcl.getExtraYToMeetTimeLineDash(minimumHeight);
			let actualHeight = minimumHeight + extra;
			const lifecycleState =
				working.actorLifecycleState && Utilities.isObject(working.actorLifecycleState[actorcl.alias])
					? working.actorLifecycleState[actorcl.alias]
					: { active: true };
			const lifecycleStartYPos = Utilities.isNumber(actorcl.lifecycleStartYPos) ? actorcl.lifecycleStartYPos : null;
			const lifecycleEndYPos = Utilities.isNumber(actorcl.lifecycleEndYPos) ? actorcl.lifecycleEndYPos : null;
			let timelineStart = null;
			let timelineEnd = null;
			if (lifecycleState.active === true) {
				timelineStart = starty;
				timelineEnd = lifecycleEndYPos != null ? Math.min(starty + actualHeight, lifecycleEndYPos) : starty + actualHeight;
			} else if (lifecycleStartYPos != null) {
				timelineStart = Math.max(starty, lifecycleStartYPos);
				timelineEnd = lifecycleEndYPos != null ? Math.min(starty + actualHeight, lifecycleEndYPos) : starty + actualHeight;
			}
			if (timelineStart != null && timelineEnd != null && timelineEnd > timelineStart) {
				if (!mimic) {
					ctx.lineWidth = actorcl.timelineWidth;
					ctx.setLineDash(actorcl.timelineDash);
					ctx.strokeStyle = "rgb(0,0,0)";
					ctx.beginPath();
					ctx.moveTo(actorcl.middle, timelineStart);
					ctx.lineTo(actorcl.middle, timelineEnd);
					ctx.stroke();
				}
			}
			if (actorcl.middle > maxx) maxx = actorcl.middle;
			if (starty + actualHeight > maxy) maxy = starty + actualHeight;

			/////////////////////////////////////////////////////////////////////////////
			// Check if we need to break the flow on the calling actor
			let breakAtYPosStart = null;
			let breakAtYPosEnd = null;
			if (
				actorcl.alias === breakAtYPosForActor &&
				Utilities.isNumber(breakAtYPos) &&
				breakAtYPos - gapForBreak / 2 > starty &&
				breakAtYPos + gapForBreak / 2 < starty + actualHeight &&
				Utilities.isNumber(gapForBreak) &&
				gapForBreak > 0
			) {
				breakAtYPosStart = breakAtYPos - gapForBreak / 2;
				breakAtYPosEnd = breakAtYPos + gapForBreak / 2;
			}

			/////////////////////////////////////////////////////////////////////////////
			// We have a start and an end and we have a break
			if (
				Utilities.isNumber(actorcl.flowStartYPos) &&
				Utilities.isNumber(actorcl.flowEndYPos) &&
				breakAtYPosStart != null &&
				breakAtYPosEnd != null
			) {
				let leftBlock = actorcl.middle - actorcl.flowWidth / 2;
				let widthBlock = actorcl.flowWidth;
				let rightBorder = true;
				let leftBorder = true;
				let radius = 0;
				if (breakAtYPosEnd < actorcl.flowEndYPos) {
					let topBlock1 = actorcl.isFlowStateContinue() ? starty : actorcl.flowStartYPos;
					let heightBlock1 = breakAtYPosStart - topBlock1;
					let topBorder = actorcl.isFlowStateContinue() ? false : true;
					let bottomBorder = true;
					Actor.drawFlowRectangle(
						ctx,
						actorcl.actorTmd.bgColour,
						topBlock1,
						leftBlock,
						widthBlock,
						heightBlock1,
						radius,
						topBorder,
						rightBorder,
						bottomBorder,
						leftBorder,
						mimic
					);
					let topBlock2 = breakAtYPosEnd;
					let heightBlock2 = actorcl.flowEndYPos - breakAtYPosEnd;
					topBorder = true;
					bottomBorder = true;
					Actor.drawFlowRectangle(
						ctx,
						actorcl.actorTmd.bgColour,
						topBlock2,
						leftBlock,
						widthBlock,
						heightBlock2,
						radius,
						topBorder,
						rightBorder,
						bottomBorder,
						leftBorder,
						mimic
					);
					actorcl.clearFlowStateContinue();
				} else {
					let topBlock = actorcl.isFlowStateContinue() ? starty : actorcl.flowStartYPos;
					let topBorder = actorcl.isFlowStateContinue() ? false : true;
					let bottomBorder = true;
					let height = actorcl.isFlowStateContinue() ? actualHeight : actualHeight - (actorcl.flowStartYPos - starty);
					Actor.drawFlowRectangle(
						ctx,
						actorcl.actorTmd.bgColour,
						topBlock,
						leftBlock,
						widthBlock,
						height,
						radius,
						topBorder,
						rightBorder,
						bottomBorder,
						leftBorder,
						mimic
					);
					actorcl.clearFlowStateContinue();
				}
			}
			/////////////////////////////////////////////////////////////////////////////
			// We have a start and an end but we have no break
			else if (Utilities.isNumber(actorcl.flowStartYPos) && Utilities.isNumber(actorcl.flowEndYPos)) {
				let leftBlock = actorcl.middle - actorcl.flowWidth / 2;
				let widthBlock = actorcl.flowWidth;
				let heightBlock = actorcl.isFlowStateContinue() ? actorcl.flowEndYPos - starty : actorcl.flowEndYPos - actorcl.flowStartYPos;
				let topBlock = actorcl.isFlowStateContinue() ? starty : actorcl.flowStartYPos;
				let radius = 0;
				let topBorder = actorcl.isFlowStateContinue() ? false : true;
				let rightBorder = true;
				let bottomBorder = true;
				let leftBorder = true;
				Actor.drawFlowRectangle(
					ctx,
					actorcl.actorTmd.bgColour,
					topBlock,
					leftBlock,
					widthBlock,
					heightBlock,
					radius,
					topBorder,
					rightBorder,
					bottomBorder,
					leftBorder,
					mimic
				);
				////////////////////////////////////////////////////////////////////////////
				// Clear the continue state
				actorcl.clearFlowStateContinue();
			}
			/////////////////////////////////////////////////////////////////////////////
			// We have a start but no end, and we have a break
			else if (
				Utilities.isNumber(actorcl.flowStartYPos) &&
				!Utilities.isNumber(actorcl.flowEndYPos) &&
				breakAtYPosStart != null &&
				breakAtYPosEnd != null
			) {
				let topBlock = actorcl.isFlowStateContinue() ? starty : actorcl.flowStartYPos;
				let leftBlock = actorcl.middle - actorcl.flowWidth / 2;
				let widthBlock = actorcl.flowWidth;
				let rightBorder = true;
				let leftBorder = true;
				let radius = 0;
				if (breakAtYPosEnd < starty + actualHeight) {
					let heightBlock1 = breakAtYPosStart - topBlock;
					let topBorder = actorcl.isFlowStateContinue() ? false : true;
					let bottomBorder = true;
					Actor.drawFlowRectangle(
						ctx,
						actorcl.actorTmd.bgColour,
						topBlock,
						leftBlock,
						widthBlock,
						heightBlock1,
						radius,
						topBorder,
						rightBorder,
						bottomBorder,
						leftBorder,
						mimic
					);
					let topBlock2 = breakAtYPosEnd;
					let heightBlock2 = starty + actualHeight - breakAtYPosEnd;
					topBorder = true;
					bottomBorder = false;
					Actor.drawFlowRectangle(
						ctx,
						actorcl.actorTmd.bgColour,
						topBlock2,
						leftBlock,
						widthBlock,
						heightBlock2,
						radius,
						topBorder,
						rightBorder,
						bottomBorder,
						leftBorder,
						mimic
					);
					actorcl.setFlowStateContinue();
				} else {
					let topBorder = actorcl.isFlowStateContinue() ? false : true;
					let bottomBorder = false;
					let height = actorcl.isFlowStateContinue() ? actualHeight : actualHeight - (actorcl.flowStartYPos - starty);
					Actor.drawFlowRectangle(
						ctx,
						actorcl.actorTmd.bgColour,
						topBlock,
						leftBlock,
						widthBlock,
						height,
						radius,
						topBorder,
						rightBorder,
						bottomBorder,
						leftBorder,
						mimic
					);
					actorcl.setFlowStateContinue();
				}
			}
			/////////////////////////////////////////////////////////////////////////////
			// We have a start but no end, and we DO NOT have a break
			else if (Utilities.isNumber(actorcl.flowStartYPos) && !Utilities.isNumber(actorcl.flowEndYPos)) {
				let leftBlock = actorcl.middle - actorcl.flowWidth / 2;
				let widthBlock = actorcl.flowWidth;
				let heightBlock = actorcl.isFlowStateContinue() ? actualHeight : actualHeight - (actorcl.flowStartYPos - starty);
				let topBlock = actorcl.isFlowStateContinue() ? starty : actorcl.flowStartYPos;
				let radius = 0;
				let topBorder = actorcl.isFlowStateContinue() ? false : true;
				let rightBorder = true;
				let bottomBorder = false;
				let leftBorder = true;
				Actor.drawFlowRectangle(
					ctx,
					actorcl.actorTmd.bgColour,
					topBlock,
					leftBlock,
					widthBlock,
					heightBlock,
					radius,
					topBorder,
					rightBorder,
					bottomBorder,
					leftBorder,
					mimic
				);
				actorcl.setFlowStateContinue();
			}
			/////////////////////////////////////////////////////////////////////////////
			// We have no start but we do have an end and we have a break
			else if (
				!Utilities.isNumber(actorcl.flowStartYPos) &&
				Utilities.isNumber(actorcl.flowEndYPos) &&
				breakAtYPosStart != null &&
				breakAtYPosEnd != null
			) {
				let topBlock = starty;
				let leftBlock = actorcl.middle - actorcl.flowWidth / 2;
				let widthBlock = actorcl.flowWidth;
				let rightBorder = true;
				let leftBorder = true;
				let radius = 0;
				if (breakAtYPosEnd < actorcl.flowEndYPos) {
					let heightBlock1 = breakAtYPosStart - topBlock;
					let topBorder = actorcl.isFlowStateContinue() ? false : true;
					let bottomBorder = true;
					Actor.drawFlowRectangle(
						ctx,
						actorcl.actorTmd.bgColour,
						topBlock,
						leftBlock,
						widthBlock,
						heightBlock1,
						radius,
						topBorder,
						rightBorder,
						bottomBorder,
						leftBorder,
						mimic
					);
					let topBlock2 = breakAtYPosEnd;
					let heightBlock2 = actorcl.flowEndYPos - breakAtYPosEnd;
					topBorder = true;
					bottomBorder = true;
					Actor.drawFlowRectangle(
						ctx,
						actorcl.actorTmd.bgColour,
						topBlock2,
						leftBlock,
						widthBlock,
						heightBlock2,
						radius,
						topBorder,
						rightBorder,
						bottomBorder,
						leftBorder,
						mimic
					);
					actorcl.clearFlowStateContinue();
				} else {
					let topBorder = actorcl.isFlowStateContinue() ? false : true;
					let bottomBorder = true;
					let height = actualHeight - (actualHeight - (actorcl.flowEndYPos - starty));
					Actor.drawFlowRectangle(
						ctx,
						actorcl.actorTmd.bgColour,
						topBlock,
						leftBlock,
						widthBlock,
						height,
						radius,
						topBorder,
						rightBorder,
						bottomBorder,
						leftBorder,
						mimic
					);
					actorcl.clearFlowStateContinue();
				}
			}
			/////////////////////////////////////////////////////////////////////////////
			// We have no start but we do have an end and we DO NOT have a break
			else if (!Utilities.isNumber(actorcl.flowStartYPos) && Utilities.isNumber(actorcl.flowEndYPos)) {
				let leftBlock = actorcl.middle - actorcl.flowWidth / 2;
				let widthBlock = actorcl.flowWidth;
				let heightBlock = actualHeight - (actualHeight - (actorcl.flowEndYPos - starty));
				let topBlock = starty;
				let radius = 0;
				let topBorder = actorcl.isFlowStateContinue() ? false : true;
				let rightBorder = true;
				let bottomBorder = true;
				let leftBorder = true;
				Actor.drawFlowRectangle(
					ctx,
					actorcl.actorTmd.bgColour,
					topBlock,
					leftBlock,
					widthBlock,
					heightBlock,
					radius,
					topBorder,
					rightBorder,
					bottomBorder,
					leftBorder,
					mimic
				);
				actorcl.clearFlowStateContinue();
			}
			/////////////////////////////////////////////////////////////////////////////
			// We are marked to continue and have no number for either flowStartYPos or flowEndYPos
			else if (actorcl.isFlowStateContinue()) {
				Actor.drawFlowRectangle(
					ctx,
					actorcl.actorTmd.bgColour,
					starty,
					actorcl.middle - actorcl.flowWidth / 2,
					actorcl.flowWidth,
					actualHeight,
					0,
					false,
					true,
					false,
					true,
					mimic
				);
			}
			if (Utilities.isNumber(actorcl.lifecycleEndYPos)) {
				if (!mimic) {
					const markerSize = Math.max(6, actorcl.flowWidth / 2);
					ctx.lineWidth = 2;
					ctx.setLineDash([]);
					ctx.strokeStyle = "rgb(0,0,0)";
					ctx.beginPath();
					ctx.moveTo(actorcl.middle - markerSize / 2, actorcl.lifecycleEndYPos - markerSize / 2);
					ctx.lineTo(actorcl.middle + markerSize / 2, actorcl.lifecycleEndYPos + markerSize / 2);
					ctx.moveTo(actorcl.middle - markerSize / 2, actorcl.lifecycleEndYPos + markerSize / 2);
					ctx.lineTo(actorcl.middle + markerSize / 2, actorcl.lifecycleEndYPos - markerSize / 2);
					ctx.stroke();
				}
			}
			actorcl.flowStartYPos = null;
			actorcl.flowEndYPos = null;
			actorcl.lifecycleStartYPos = null;
			actorcl.lifecycleEndYPos = null;
		});
		return working.manageMaxWidth(maxx, maxy);
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle get extra yto meet time line dash.
	 *
	 * @param {*} minimumHeight Parameter derived from minimumHeight.
	 * @returns {*} Result value.
	 * @example
	 * instance.getExtraYToMeetTimeLineDash(minimumHeight);
	 */
	getExtraYToMeetTimeLineDash(minimumHeight) {
		let count = 0;
		this._timelineDash.forEach((space) => {
			count += space;
		});

		if (minimumHeight < count) return count;
		else if (minimumHeight % count == 0) return 0;
		else return count - (minimumHeight % count);
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return the default tmd configuration.
	 * @returns {*} Result value.
	 * @example
	 * instance.getDefaultTmd();
	 */
	static getDefaultTmd() {
		const defaultTmd = {
			fontFamily: schema.actor.properties.fontFamily.default,
			fontSizePx: schema.actor.properties.fontSizePx.default,
			fgColour: schema.actor.properties.fgColour.default,
			bgColour: schema.actor.properties.bgColour.default,
			padding: schema.actor.properties.padding.default,
			spacing: schema.actor.properties.spacing.default,
			align: schema.actor.properties.align.default,
			borderColour: schema.actor.properties.borderColour.default,
			borderWidth: schema.actor.properties.borderWidth.default,
			borderDash: schema.actor.properties.borderDash.default,
		};
		return defaultTmd;
	}
};
