const Utilities = require("./Utilities.js");
const TextMetadata = require("./TextMetadata.js");

///////////////////////////////////////////////////////////////////////////////
/**
 * Render bottom-layer actor-group boxes behind the actor headers and timelines.
 */
module.exports = class ActorGroup {
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Draw all resolved actor-group runs for the current render pass.
	 *
	 * @param {object} working Shared working state.
	 * @param {object} ctx SVG drawing context.
	 * @param {number} actorStartY Top y coordinate of the actor band.
	 * @param {boolean} mimic Whether this is a measurement pass.
	 * @returns {{x:number,y:number}} Furthest rendered coordinates.
	 * @example
	 * ActorGroup.drawAll(working, ctx, actorStartY, false);
	 */
	static drawAll(working, ctx, actorStartY, mimic) {
		const runs = Array.isArray(working.resolvedActorGroupRuns) ? working.resolvedActorGroupRuns : [];
		if (runs.length === 0) {
			return working.manageMaxWidth(working.startX, actorStartY);
		}

		const style = ActorGroup._getStyle(working);
		const textMetaData = ActorGroup._getTitleTextMetadata();
		const laidOutRuns = [];

		runs.forEach((run) => {
			const actorInstances = run.actors
				.map((alias) => ActorGroup._findActorInstance(working, alias))
				.filter((actorInstance) => actorInstance != null);
			if (actorInstances.length === 0) {
				return;
			}

			const titleLines = Utilities.isString(run.title) && run.title.length > 0 ? [run.title] : [];
			const titleWh =
				titleLines.length > 0 ? Utilities.getTextWidthAndHeight(ctx, textMetaData, titleLines, working.tags) : { w: 0, h: 0, lines: [] };
			const titleReserve = titleLines.length > 0 ? titleWh.h + style.titlePaddingPx : 0;
			const left = Math.min(...actorInstances.map((actorInstance) => actorInstance.x)) - style.horizontalPaddingPx;
			const right = Math.max(...actorInstances.map((actorInstance) => actorInstance.x + actorInstance.width)) + style.horizontalPaddingPx;
			const top = Math.max(0, actorStartY - style.topPaddingPx - titleReserve);
			const bottom = Math.max(top + 20, working.canvasHeight - style.bottomPaddingPx);

			laidOutRuns.push({
				title: run.title,
				bgColour: run.bgColour,
				left: left,
				right: right,
				top: top,
				bottom: bottom,
				titleLines: titleLines,
				titleWh: titleWh,
			});
		});

		ActorGroup._applyAdjacentColourGaps(laidOutRuns, style.gapBetweenDifferentColoursPx);

		laidOutRuns.forEach((run) => {
			const width = Math.max(20, run.right - run.left);
			const height = Math.max(20, run.bottom - run.top);
			Utilities.drawRectangle(
				ctx,
				style.borderWidth,
				style.borderColour,
				[],
				run.bgColour,
				run.top,
				run.left,
				width,
				height,
				style.cornerRadiusPx,
				true,
				true,
				true,
				true,
				mimic
			);
			if (run.titleLines.length > 0) {
				const titleX = run.left + style.horizontalPaddingPx / 2;
				const titleY = run.top + style.titlePaddingPx / 2;
				const titleXy = Utilities.drawTextRectangleNoBorderOrBg(
					ctx,
					run.titleLines,
					textMetaData,
					titleY,
					titleX,
					null,
					null,
					mimic,
					run.titleWh,
					working.tags
				);
				working.manageMaxWidthXy(titleXy);
			}
			working.manageMaxWidth(run.right, run.bottom);
		});

		return working.manageMaxWidth(0, actorStartY);
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return the renderer style for actor-group boxes.
	 *
	 * @param {object} working Shared working state.
	 * @returns {{ horizontalPaddingPx:number, topPaddingPx:number, bottomPaddingPx:number, gapBetweenDifferentColoursPx:number, titlePaddingPx:number, borderWidth:number, borderColour:string, cornerRadiusPx:number }} Actor-group style.
	 * @example
	 * const style = ActorGroup._getStyle(working);
	 */
	static _getStyle(working) {
		const params = Utilities.isObject(working.postdata && working.postdata.params && working.postdata.params.actorGroup)
			? working.postdata.params.actorGroup
			: {};
		return {
			horizontalPaddingPx:
				Utilities.isNumberGtEq0(params.horizontalPaddingPx) ? params.horizontalPaddingPx : Math.max(18, Math.round(working.globalSpacing * 0.8)),
			topPaddingPx: Utilities.isNumberGtEq0(params.topPaddingPx) ? params.topPaddingPx : 0,
			bottomPaddingPx:
				Utilities.isNumberGtEq0(params.bottomPaddingPx) ? params.bottomPaddingPx : Math.max(18, Math.round(working.globalSpacing * 0.8)),
			gapBetweenDifferentColoursPx:
				Utilities.isNumberGtEq0(params.gapBetweenDifferentColoursPx)
					? params.gapBetweenDifferentColoursPx
					: Math.max(8, Math.round(working.globalSpacing / 4)),
			titlePaddingPx:
				Utilities.isNumberGtEq0(params.titlePaddingPx) ? params.titlePaddingPx : Math.max(8, Math.round(working.globalSpacing / 3)),
			borderWidth: Utilities.isNumberGtEq0(params.borderWidth) ? params.borderWidth : 1,
			borderColour: Utilities.validColour(params.borderColour) ? params.borderColour : "rgb(0,0,0)",
			cornerRadiusPx: Utilities.isNumberGtEq0(params.cornerRadiusPx) ? params.cornerRadiusPx : 0,
		};
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Return the default title text metadata for actor-group labels.
	 *
	 * @returns {object} Text metadata object.
	 * @example
	 * const tmd = ActorGroup._getTitleTextMetadata();
	 */
	static _getTitleTextMetadata() {
		const textMetaData = TextMetadata.getDefaultTmd();
		textMetaData.fontSizePx = 14;
		textMetaData.bold = true;
		textMetaData.italic = false;
		textMetaData.padding = 0;
		textMetaData.spacing = 1;
		textMetaData.bgColour = "rgba(0,0,0,0)";
		return textMetaData;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Find the actor renderer instance for an alias.
	 *
	 * @param {object} working Shared working state.
	 * @param {string} alias Actor alias.
	 * @returns {object|null} Actor renderer instance, or null if absent.
	 * @example
	 * const actorInstance = ActorGroup._findActorInstance(working, "API");
	 */
	static _findActorInstance(working, alias) {
		const actors = Array.isArray(working.postdata && working.postdata.actors) ? working.postdata.actors : [];
		const actor = actors.find((candidate) => candidate && candidate.alias === alias && candidate.clinstance);
		return actor && actor.clinstance ? actor.clinstance : null;
	}

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Apply horizontal gaps between adjacent boxes of different colours.
	 *
	 * @param {Array<object>} runs Resolved actor-group run geometry.
	 * @param {number} gapPx Desired gap in pixels.
	 * @returns {void} Nothing.
	 * @example
	 * ActorGroup._applyAdjacentColourGaps(runs, 8);
	 */
	static _applyAdjacentColourGaps(runs, gapPx) {
		runs.sort((leftRun, rightRun) => leftRun.left - rightRun.left);

		for (let index = 0; index < runs.length - 1; index++) {
			const currentRun = runs[index];
			const nextRun = runs[index + 1];
			if (!Utilities.isString(currentRun.bgColour) || !Utilities.isString(nextRun.bgColour)) {
				continue;
			}
			if (currentRun.bgColour.trim().toLowerCase() === nextRun.bgColour.trim().toLowerCase()) {
				continue;
			}

			const actualGap = nextRun.left - currentRun.right;
			if (actualGap >= gapPx) {
				continue;
			}

			const shrinkBy = (gapPx - actualGap) / 2;
			currentRun.right = Math.max(currentRun.left + 20, currentRun.right - shrinkBy);
			nextRun.left = Math.min(nextRun.right - 20, nextRun.left + shrinkBy);
		}
	}
};
