// npm install --save-dev jsdoc-to-markdown
// npx jsdoc2md SvgBuilder.js > SvgBuilder.md
// https://editsvgcode.com/

const fs = require("fs");
const { create } = require("xmlbuilder2");
const SortedMap = require("./SortedMap"); // Assuming the SortedMap is implemented as discussed

////////////////////////////////////////////////////////////////////////////////
/**
 * Manage svgbuilder behaviour for the sequencer renderer.
 *
 * @example
 * const instance = new SVGBuilder();
 */
class SVGBuilder {
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Initialise the SVGBuilder instance.
	 *
	 * @param {*} borderMargin Parameter derived from borderMargin = -1.
	 * @param {*} borderWidth Parameter derived from borderWidth = -1.
	 * @param {*} borderPadding Parameter derived from borderPadding = -1.
	 * @param {*} borderClass Parameter derived from borderClass = null.
	 * @param {*} width Parameter derived from width = 1.
	 * @param {*} height Parameter derived from height = 1.
	 * @returns {void} Nothing.
	 * @example
	 * const instance = new SVGBuilder(borderMargin, borderWidth, borderPadding, borderClass, width, height);
	 */
	constructor(borderMargin = -1, borderWidth = -1, borderPadding = -1, borderClass = null, width = 1, height = 1) {
		this.borderMargin = borderMargin;
		this.borderWidth = borderWidth;
		this.borderPadding = borderPadding;
		this.borderClass = borderClass;
		this.width = width;
		this.height = height;
		this.primitives = new SortedMap();
		this.styles = {};
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle set style.
	 *
	 * @param {*} selector Parameter derived from selector.
	 * @param {*} style Parameter derived from style.
	 * @returns {*} Result value.
	 * @example
	 * instance.setStyle(selector, style);
	 */
	setStyle(selector, style) {
		this.styles[selector] = { ...this.styles[selector], ...style };
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle add rectangle.
	 *
	 * @param {*} key Parameter derived from key.
	 * @param {*} options2 Parameter derived from { x, y, width, height, fill = "none", stroke = "black", strokeWidth = 1, className = "" }.
	 * @param {*} start Parameter derived from start = false.
	 * @param {*} end Parameter derived from end = false.
	 * @returns {*} Result value.
	 * @example
	 * instance.addRectangle(key, options2, start, end);
	 */
	addRectangle(key, { x, y, width, height, fill = "none", stroke = "black", strokeWidth = 1, className = "" }, start = false, end = false) {
		const rect = {
			name: "rect",
			attributes: { x, y, width, height, class: className, fill, stroke, "stroke-width": strokeWidth },
		};
		if (start) this.primitives.setFirst(key, rect);
		else if (end) this.primitives.setLast(key, rect);
		else if (key != null) this.primitives.set(key, rect);
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle add circle.
	 *
	 * @param {*} key Parameter derived from key.
	 * @param {*} options2 Parameter derived from { cx, cy, r, fill = "none", stroke = "black", strokeWidth = 1, className = "" }.
	 * @returns {*} Result value.
	 * @example
	 * instance.addCircle(key, options2);
	 */
	addCircle(key, { cx, cy, r, fill = "none", stroke = "black", strokeWidth = 1, className = "" }) {
		const circle = {
			name: "circle",
			attributes: { cx, cy, r, class: className, fill, stroke, "stroke-width": strokeWidth },
		};
		this.primitives.set(key, circle);
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle add line.
	 *
	 * @param {*} key Parameter derived from key.
	 * @param {*} options2 Parameter derived from { x1, y1, x2, y2, stroke = "black", strokeWidth = 1, className = "" }.
	 * @returns {*} Result value.
	 * @example
	 * instance.addLine(key, options2);
	 */
	addLine(key, { x1, y1, x2, y2, stroke = "black", strokeWidth = 1, className = "" }) {
		const line = {
			name: "line",
			attributes: { x1, y1, x2, y2, class: className, stroke, "stroke-width": strokeWidth },
		};
		this.primitives.set(key, line);
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle add polygon.
	 *
	 * @param {*} key Parameter derived from key.
	 * @param {*} options2 Parameter derived from { points, fill = "none", stroke = "black", strokeWidth = 1, className = "" }.
	 * @returns {*} Result value.
	 * @example
	 * instance.addPolygon(key, options2);
	 */
	addPolygon(key, { points, fill = "none", stroke = "black", strokeWidth = 1, className = "" }) {
		const polygon = {
			name: "polygon",
			attributes: { points, class: className, fill, stroke, "stroke-width": strokeWidth },
		};
		this.primitives.set(key, polygon);
	}

	///////////////////////////////////////////////////////////////////////////////

	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle add path.
	 *
	 * @param {*} key Parameter derived from key.
	 * @param {*} options2 Parameter derived from { d, className = null, fill = "none", stroke = "black", strokeWidth = 1, strokeDashArray = [] }.
	 * @returns {*} Result value.
	 * @example
	 * instance.addPath(key, options2);
	 */
	addPath(key, { d, className = null, fill = "none", stroke = "black", strokeWidth = 1, strokeDashArray = [] }) {
		const path = {
			name: "path",
			attributes: { d, class: className, fill, stroke, "stroke-width": strokeWidth, "stroke-dasharray": strokeDashArray },
		};
		this.primitives.set(key, path);
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle move to.
	 *
	 * @param {*} x Parameter derived from x.
	 * @param {*} y Parameter derived from y.
	 * @returns {*} Result value.
	 * @example
	 * instance.moveTo(x, y);
	 */
	moveTo(x, y) {
		return `M ${x} ${y}`;
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle line to.
	 *
	 * @param {*} x Parameter derived from x.
	 * @param {*} y Parameter derived from y.
	 * @returns {*} Result value.
	 * @example
	 * instance.lineTo(x, y);
	 */
	lineTo(x, y) {
		return `L ${x} ${y}`;
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle cubic bezier curve to.
	 *
	 * @param {*} x1 Parameter derived from x1.
	 * @param {*} y1 Parameter derived from y1.
	 * @param {*} x2 Parameter derived from x2.
	 * @param {*} y2 Parameter derived from y2.
	 * @param {*} x Parameter derived from x.
	 * @param {*} y Parameter derived from y.
	 * @returns {*} Result value.
	 * @example
	 * instance.cubicBezierCurveTo(x1, y1, x2, y2, x, y);
	 */
	cubicBezierCurveTo(x1, y1, x2, y2, x, y) {
		return `C ${x1} ${y1}, ${x2} ${y2}, ${x} ${y}`;
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle quadratic bezier curve to.
	 *
	 * @param {*} x1 Parameter derived from x1.
	 * @param {*} y1 Parameter derived from y1.
	 * @param {*} x Parameter derived from x.
	 * @param {*} y Parameter derived from y.
	 * @returns {*} Result value.
	 * @example
	 * instance.quadraticBezierCurveTo(x1, y1, x, y);
	 */
	quadraticBezierCurveTo(x1, y1, x, y) {
		return `Q ${x1} ${y1}, ${x} ${y}`;
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle close path.
	 * @returns {*} Result value.
	 * @example
	 * instance.closePath();
	 */
	closePath() {
		return `Z`;
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle add text.
	 *
	 * @param {*} key Parameter derived from key.
	 * @param {*} options2 Parameter derived from { x, y, content, fontSize = 16, fill = "black", className = "", fontFamily = "Arial" }.
	 * @returns {*} Result value.
	 * @example
	 * instance.addText(key, options2);
	 */
	addText(key, { x, y, content, fontSize = 16, fill = "black", className = "", fontFamily = "Arial" }) {
		const text = {
			name: "text",
			attributes: { x, y, "font-size": fontSize, fill, class: className, "font-family": fontFamily },
			content,
		};
		this.primitives.set(key, text);
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle reset.
	 * @returns {*} Result value.
	 * @example
	 * instance.reset();
	 */
	reset() {
		this.primitives.clear();
		this.styles = {};
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle styles to css.
	 * @returns {*} Result value.
	 * @example
	 * instance.stylesToCSS();
	 */
	stylesToCSS() {
		return Object.entries(this.styles)
			.map(([selector, style]) => {
				const styleString = Object.entries(style)
					.map(([prop, value]) => `${prop}: ${value};`)
					.join(" ");
				return `${selector} { ${styleString} }`;
			})
			.join(" ");
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle calculate bounding box.
	 * @returns {*} Result value.
	 * @example
	 * instance.calculateBoundingBox();
	 */
	calculateBoundingBox() {
		let minX = 0,
			minY = 0,
			maxX = this.width,
			maxY = this.height;
		for (const [, primitive] of this.primitives) {
			const attrs = primitive.attributes;
			if (attrs.x !== undefined) minX = Math.min(minX, attrs.x);
			if (attrs.y !== undefined) minY = Math.min(minY, attrs.y);
			if (primitive.name === "text" && attrs["font-size"] !== undefined && attrs.y !== undefined)
				minY = Math.min(minY, attrs.y - attrs["font-size"]);
			if (attrs.cx !== undefined) minX = Math.min(minX, attrs.cx - (attrs.r || 0));
			if (attrs.cy !== undefined) minY = Math.min(minY, attrs.cy - (attrs.r || 0));
			if (attrs.x1 !== undefined) minX = Math.min(minX, attrs.x1);
			if (attrs.y1 !== undefined) minY = Math.min(minY, attrs.y1);
			if (attrs.x2 !== undefined) maxX = Math.max(maxX, attrs.x2);
			if (attrs.y2 !== undefined) maxY = Math.max(maxY, attrs.y2);
			if (attrs.width !== undefined) maxX = Math.max(maxX, attrs.x + attrs.width);
			if (attrs.height !== undefined) maxY = Math.max(maxY, attrs.y + attrs.height);
			if (attrs.points) {
				const points = attrs.points.split(" ").map((p) => p.split(",").map(Number));
				points.forEach(([px, py]) => {
					minX = Math.min(minX, px);
					minY = Math.min(minY, py);
					maxX = Math.max(maxX, px);
					maxY = Math.max(maxY, py);
				});
			}
		}
		return { minX, minY, maxX, maxY };
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle shift primitives.
	 *
	 * @param {*} shiftX Parameter derived from shiftX.
	 * @param {*} shiftY Parameter derived from shiftY.
	 * @returns {*} Result value.
	 * @example
	 * instance.shiftPrimitives(shiftX, shiftY);
	 */
	shiftPrimitives(shiftX, shiftY) {
		for (const [, primitive] of this.primitives) {
			const attrs = primitive.attributes;
			if (attrs.x !== undefined) attrs.x += shiftX;
			if (attrs.y !== undefined) attrs.y += shiftY;
			if (attrs.cx !== undefined) attrs.cx += shiftX;
			if (attrs.cy !== undefined) attrs.cy += shiftY;
			if (attrs.x1 !== undefined) attrs.x1 += shiftX;
			if (attrs.y1 !== undefined) attrs.y1 += shiftY;
			if (attrs.x2 !== undefined) attrs.x2 += shiftX;
			if (attrs.y2 !== undefined) attrs.y2 += shiftY;
			if (attrs.points) {
				attrs.points = attrs.points
					.split(" ")
					.map((p) => {
						const [px, py] = p.split(",").map(Number);
						return `${px + shiftX},${py + shiftY}`;
					})
					.join(" ");
			}
		}
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle adjust primitives to fit canvas.
	 * @returns {*} Result value.
	 * @example
	 * instance.adjustPrimitivesToFitCanvas();
	 */
	adjustPrimitivesToFitCanvas() {
		const { minX, minY, maxX, maxY } = this.calculateBoundingBox();
		const shiftX = minX < 0 ? -minX : 0;
		const shiftY = minY < 0 ? -minY : 0;
		console.error(`Shify X by ${shiftX}, shift Y by ${shiftY}`);
		this.shiftPrimitives(shiftX, shiftY);
		this.width = Math.max(this.width, maxX + shiftX);
		this.height = Math.max(this.height, maxY + shiftY);
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	/**
	 * Handle to svg.
	 *
	 * @param {*} outputFile Parameter derived from outputFile = null.
	 * @returns {*} Result value.
	 * @example
	 * instance.toSVG(outputFile);
	 */
	toSVG(outputFile = null) {
		console.error(this.calculateBoundingBox());
		if (this.borderMargin <= 0) this.borderMargin = 0;
		if (this.borderWidth <= 0) this.borderWidth = 0;
		if (this.borderPadding <= 0) this.borderPadding = 0;

		if (this.borderMargin > 0 || this.borderWidth > 0 || this.borderPadding > 0) {
			const { minX, minY, maxX, maxY } = this.calculateBoundingBox();
			let totalMarginWidthPadding = this.borderMargin + this.borderWidth + this.borderPadding;
			let totalWidthPadding = this.borderWidth + this.borderPadding;
			let totalPadding = this.borderPadding;

			/////////////////////////////////////////////////////////////////////////////
			// Add Margin
			if (this.borderMargin > 0) {
				const marginRectangle = {
					x: minX - totalMarginWidthPadding,
					y: minY - totalMarginWidthPadding,
					width: maxX - minX + totalMarginWidthPadding * 2,
					height: maxY - minY + totalMarginWidthPadding * 2,
					strokeWidth: 0,
					fill: "none",
				};
				this.addRectangle("margin", marginRectangle, true);
			}
			/////////////////////////////////////////////////////////////////////////////
			// Add border
			if (this.borderWidth > 0) {
				const borderRectangle = {
					x: minX - totalWidthPadding,
					y: minY - totalWidthPadding,
					width: maxX - minX + totalWidthPadding * 2,
					height: maxY - minY + totalWidthPadding * 2,
					strokeWidth: this.borderWidth,
					fill: "none",
				};
				this.addRectangle("border", borderRectangle, true);
			}
			/////////////////////////////////////////////////////////////////////////////
			// Add padding
			if (this.borderPadding > 0) {
				const paddingRectangle = {
					x: minX - totalPadding,
					y: minY - totalPadding,
					width: maxX - minX + totalPadding * 2,
					height: maxY - minY + totalPadding * 2,
					strokeWidth: 0,
					fill: "none",
				};
				this.addRectangle("padding", paddingRectangle, true);
			}
		}
		console.error(this.primitives);
		console.error(this.calculateBoundingBox());
		this.adjustPrimitivesToFitCanvas();
		console.error(this.calculateBoundingBox());

		const svg = create({ version: "1.0" }).ele("svg", {
			xmlns: "http://www.w3.org/2000/svg",
			width: this.width,
			height: this.height,
		});

		const css = this.stylesToCSS();
		if (css) {
			svg.ele("style").txt(css).up();
		}

		for (const [_, primitive] of this.primitives) {
			console.error(primitive);

			const element = svg.ele(primitive.name, primitive.attributes);

			if (primitive.content) {
				element.txt(primitive.content);
			}
		}

		const svgString = svg.end({ prettyPrint: true });

		if (outputFile) {
			fs.writeFileSync(outputFile, svgString);
		} else {
			console.log(svgString);
		}

		return svgString;
	}
}

module.exports.svg = new SVGBuilder(10, -1, -1);
module.exports.SVGBuilder = SVGBuilder;
