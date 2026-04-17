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
let Comment = require("./Comment.js");

module.exports = class Blank {
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Initialise the Blank instance.
	 *
	 * @param {*} ctx Parameter derived from ctx.
	 * @param {*} line Parameter derived from line.
	 * @param {*} working Parameter derived from working.
	 * @returns {void} Nothing.
	 * @example
	 * const instance = new Blank(ctx, line, working);
	 */
	constructor(ctx, line, working) {
		this._ctx = ctx;
		this._line = line;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Draw the blank element.
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
			return {
				x: 0,
				y: starty + working.globalSpacing,
			};
		}

		if (!working.postdata) {
			working.postdata = {};
		}
		if (!working.postdata.params) {
			working.postdata.params = {};
		}
		if (!working.postdata.params.terminate) {
			working.postdata.params.terminate = {};
		}

		let currentActiveAboveThisFragment = 0;
		if (Array.isArray(working.activeFragments)) {
			currentActiveAboveThisFragment = working.activeFragments.length;
		}

		let ctx = this._ctx;
		let width = Utilities.isNumber(this._line.width) && this._line.width > 0 ? this._line.width : 0;
		let height = Utilities.isNumber(this._line.height) && this._line.height > 0 ? this._line.height : 0;
		let xoffset = Utilities.isNumber(this._line.xoffset) && this._line.xoffset > 0 ? this._line.xoffset : 0;
		let blankleft = working.windowPadding + currentActiveAboveThisFragment * working.fragmentSpacing + xoffset;
		let blankRight = blankleft + width;
		let blankTop = starty;
		let blankBottom = starty + height;
		let flowTransitionHeight = this._getFlowTransitionHeight(working);
		const actorLookup = this._buildActorLookup(working);
		const incomingFlowState = this._captureFlowState(actorLookup);
		const flowTransitions = this._resolveFlowTransitions(actorLookup, incomingFlowState, blankTop, flowTransitionHeight);
		let commentxy = null;
		let comment = null;
		let commentwidth = null;
		let commentleft = null;
		if (this._isNoOpFlowTransition(flowTransitions, width, height, xoffset) && this._line.comment == null) {
			return {
				x: 0,
				y: starty,
			};
		}
		if (flowTransitions.requiresVisibleHeight) {
			blankBottom = Math.max(blankBottom, blankTop + flowTransitionHeight);
		}
		if (this._line.comment != null) {
			const commentGapBelow = this._getCommentBottomGap(working);
			comment = new Comment(ctx, this._line.comment);
			let commentwidth = comment.draw(working, blankleft + 2 * working.globalSpacing, blankTop + working.globalSpacing, 0, 0, true, true);
			commentleft = this._resolveCommentLeft(working, commentwidth, blankleft);
			if (Utilities.isNumber(commentleft) && commentleft < working.negativeX) {
				working.negativeX = commentleft - working.globalSpacing / 2;
			}
			if (commentleft == null) {
				commentleft = blankleft + 2 * working.globalSpacing;
			} else if (commentleft <= working.globalSpacing) {
				commentleft = 1.5 * working.globalSpacing;
			}
			comment = new Comment(ctx, this._line.comment);
			commentxy = comment.draw(working, commentleft, blankTop + working.globalSpacing, commentGapBelow, 0, true);
			blankBottom = commentxy.y + height + 1;
		}
		this._applyFlowTransitions(flowTransitions);
		let xy = Actor.drawTimelines(working, ctx, starty, blankBottom - blankTop, true);
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
		// 1. Background fragments
		Utilities.drawActiveFragments(working, this._ctx, starty, finalHeightOfAllLine, mimic);

		//////////////////////////////////////////////////////////////////////////////
		// 2. Time lines
		this._restoreFlowState(actorLookup, incomingFlowState);
		this._applyFlowTransitions(flowTransitions);
		xy = Actor.drawTimelines(working, ctx, starty, finalHeightOfAllLine, mimic);

		//////////////////////////////////////////////////////////////////////////////
		// 3. Comment
		if (comment != null) {
			commentxy = comment.draw(working, commentleft, blankTop + working.globalSpacing, this._getCommentBottomGap(working), 0, mimic);
		}

		working.manageMaxWidth(blankRight, blankBottom);
		return working.manageMaxWidth(0, starty + finalHeightOfAllLine);
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Apply blank-line flow transitions before the timeline pass.
	 *
	 * Resolve the effective blank-line flow transitions for this render pass.
	 *
	 * @param {*} actorLookup Parameter derived from actorLookup.
	 * @param {*} incomingFlowState Parameter derived from incomingFlowState.
	 * @param {*} topY Parameter derived from topY.
	 * @param {*} flowTransitionHeight Parameter derived from flowTransitionHeight.
	 * @returns {*} Result value.
	 * @example
	 * const flowTransitions = instance._resolveFlowTransitions(actorLookup, incomingFlowState, topY, flowTransitionHeight);
	 */
	_resolveFlowTransitions(actorLookup, incomingFlowState, topY, flowTransitionHeight) {
		let transitions = [];
		let requiresVisibleHeight = false;

		this._normaliseAliasArray(this._line.deactivate).forEach((alias) => {
			if (actorLookup[alias] && incomingFlowState[alias] && incomingFlowState[alias].flowStateContinue === true) {
				transitions.push({
					type: "deactivate",
					actor: actorLookup[alias],
					topY: topY,
					endY: topY + flowTransitionHeight,
				});
				requiresVisibleHeight = true;
			}
		});

		this._normaliseAliasArray(this._line.activate).forEach((alias) => {
			if (actorLookup[alias] && (!incomingFlowState[alias] || incomingFlowState[alias].flowStateContinue !== true)) {
				transitions.push({
					type: "activate",
					actor: actorLookup[alias],
					topY: topY,
				});
				requiresVisibleHeight = true;
			}
		});

		return {
			transitions: transitions,
			requiresVisibleHeight: requiresVisibleHeight,
		};
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Apply blank-line flow transitions before a timeline render pass.
	 *
	 * @param {*} flowTransitions Parameter derived from flowTransitions.
	 * @returns {void} Nothing.
	 * @example
	 * instance._applyFlowTransitions(flowTransitions);
	 */
	_applyFlowTransitions(flowTransitions) {
		if (!flowTransitions || !Array.isArray(flowTransitions.transitions)) {
			return;
		}

		flowTransitions.transitions.forEach((transition) => {
			if (transition.type === "activate") {
				transition.actor.flowStartYPos = transition.topY;
			} else if (transition.type === "deactivate") {
				transition.actor.flowEndYPos = transition.endY;
			}
		});
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Capture the incoming flow state for the actors in the current render pass.
	 *
	 * @param {*} actorLookup Parameter derived from actorLookup.
	 * @returns {*} Result value.
	 * @example
	 * const incomingFlowState = instance._captureFlowState(actorLookup);
	 */
	_captureFlowState(actorLookup) {
		let incomingFlowState = {};

		Object.keys(actorLookup).forEach((alias) => {
			incomingFlowState[alias] = {
				flowStateContinue: actorLookup[alias].isFlowStateContinue(),
				flowStartYPos: actorLookup[alias].flowStartYPos,
				flowEndYPos: actorLookup[alias].flowEndYPos,
			};
		});

		return incomingFlowState;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Restore the captured incoming flow state before the final render pass.
	 *
	 * @param {*} actorLookup Parameter derived from actorLookup.
	 * @param {*} incomingFlowState Parameter derived from incomingFlowState.
	 * @returns {void} Nothing.
	 * @example
	 * instance._restoreFlowState(actorLookup, incomingFlowState);
	 */
	_restoreFlowState(actorLookup, incomingFlowState) {
		Object.keys(actorLookup).forEach((alias) => {
			if (incomingFlowState[alias] && incomingFlowState[alias].flowStateContinue === true) {
				actorLookup[alias].setFlowStateContinue();
			} else {
				actorLookup[alias].clearFlowStateContinue();
			}

			actorLookup[alias].flowStartYPos = incomingFlowState[alias] ? incomingFlowState[alias].flowStartYPos : null;
			actorLookup[alias].flowEndYPos = incomingFlowState[alias] ? incomingFlowState[alias].flowEndYPos : null;
		});
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Build a quick alias-to-actor-class lookup for the current render pass.
	 *
	 * @param {*} working Parameter derived from working.
	 * @returns {*} Result value.
	 * @example
	 * const actorLookup = instance._buildActorLookup(working);
	 */
	_buildActorLookup(working) {
		let actorLookup = {};

		if (!Array.isArray(working.postdata && working.postdata.actors)) {
			return actorLookup;
		}

		working.postdata.actors.forEach((actor) => {
			if (actor && actor.clinstance && Utilities.isString(actor.alias)) {
				actorLookup[actor.alias] = actor.clinstance;
			}
		});

		return actorLookup;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Normalise a blank-line activation field into an alias array.
	 *
	 * @param {*} value Parameter derived from value.
	 * @returns {*} Result value.
	 * @example
	 * const aliases = instance._normaliseAliasArray(value);
	 */
	_normaliseAliasArray(value) {
		if (Utilities.isString(value)) {
			return [value];
		}

		if (Array.isArray(value)) {
			return value.filter((alias) => Utilities.isString(alias));
		}

		return [];
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return the minimum height needed to show a flow transition on a blank line.
	 *
	 * @param {*} working Parameter derived from working.
	 * @returns {*} Result value.
	 * @example
	 * const height = instance._getFlowTransitionHeight(working);
	 */
	_getFlowTransitionHeight(working) {
		return 5;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return the small vertical gap kept below blank-line comments.
	 *
	 * @param {*} working Parameter derived from working.
	 * @returns {*} Result value.
	 * @example
	 * const gap = instance._getCommentBottomGap(working);
	 */
	_getCommentBottomGap(working) {
		return Math.max(2, Math.round(working.globalSpacing / 10));
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Detect a no-op activation/deactivation blank line with no visible payload.
	 *
	 * @param {*} flowTransitions Parameter derived from flowTransitions.
	 * @param {*} width Parameter derived from width.
	 * @param {*} height Parameter derived from height.
	 * @param {*} xoffset Parameter derived from xoffset.
	 * @returns {*} Result value.
	 * @example
	 * const isNoOp = instance._isNoOpFlowTransition(flowTransitions, width, height, xoffset);
	 */
	_isNoOpFlowTransition(flowTransitions, width, height, xoffset) {
		return (
			flowTransitions &&
			Array.isArray(flowTransitions.transitions) &&
			flowTransitions.transitions.length === 0 &&
			(this._normaliseAliasArray(this._line.activate).length > 0 || this._normaliseAliasArray(this._line.deactivate).length > 0) &&
			width === 0 &&
			height === 0 &&
			xoffset === 0
		);
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Resolve the preferred horizontal origin for a blank-line comment.
	 *
	 * @param {*} working Parameter derived from working.
	 * @param {*} commentwidth Parameter derived from commentwidth.
	 * @param {*} blankleft Parameter derived from blankleft.
	 * @returns {*} Result value.
	 * @example
	 * instance._resolveCommentLeft(working, commentwidth, blankleft);
	 */
	_resolveCommentLeft(working, commentwidth, blankleft) {
		if (Array.isArray(this._line.actors) && this._line.actors.length >= 2) {
			let actorMiddles = working.postdata.actors
				.filter((actor) => this._line.actors.includes(actor.alias))
				.map((actor) => actor.clinstance.middle);

			if (actorMiddles.length >= 2) {
				let leftMiddle = Math.min.apply(null, actorMiddles);
				let rightMiddle = Math.max.apply(null, actorMiddles);
				return (leftMiddle + rightMiddle) / 2 - commentwidth / 2;
			}
		}

		let amiddle = null;
		working.postdata.actors.forEach((actor) => {
			if (this._line.actor == actor.alias) {
				amiddle = actor.clinstance.middle;
			}
		});

		return amiddle == null ? null : amiddle - commentwidth / 2;
	}
};
