const opentype = require("opentype.js");
const fontsConfig = require("./fonts.js");

//////////////////////////////////////////////////////////////////////////////
/**
 * Load bundled TTF files and provide text-measurement helpers for the SVG
 * renderer. Instantiated in `SvgStart.constructor` and used through
 * `Working.isValidFont` and `SvgContext.measureText`.
 *
 * @example
 * const manager = new FontManager();
 * manager.loadDefaults();
 */
class FontManager {
	////////////////////////////////////////////////////////////////////////////
	/**
	 * Create an empty font registry ready for the bundled families to be loaded.
	 * Called from `SvgStart.constructor`.
	 *
	 * @returns {void} Nothing.
	 * @example
	 * const manager = new FontManager();
	 */
	constructor() {
		this._fonts = {};
		this._loadedFamilies = new Set();
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Build the internal cache key for a specific family, weight, and style
	 * combination. Called from `FontManager.loadFont` and `FontManager.getFont`.
	 *
	 * @param {string} family Requested font family.
	 * @param {boolean} bold Whether the font should be bold.
	 * @param {boolean} italic Whether the font should be italic.
	 * @returns {string} Stable cache key for the font variant.
	 * @example
	 * const key = manager._fontKey("sans-serif", true, false);
	 */
	_fontKey(family, bold, italic) {
		const weight = bold ? "bold" : "normal";
		const style = italic ? "italic" : "normal";
		return `${family}:${weight}:${style}`;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Load a single font file into the in-memory registry. Called from
	 * `FontManager.loadDefaults`.
	 *
	 * @param {string} family Logical font family name.
	 * @param {boolean} bold Whether this file is the bold variant.
	 * @param {boolean} italic Whether this file is the italic variant.
	 * @param {string} ttfPath Absolute or repo-local TTF path.
	 * @returns {void} Nothing.
	 * @example
	 * manager.loadFont("sans-serif", false, false, "/tmp/font.ttf");
	 */
	loadFont(family, bold, italic, ttfPath) {
		////////////////////////////////////////////////////////////////////////////
		// Attempt to load the font eagerly so later text measurement can stay
		// synchronous inside the render pipeline.
		const key = this._fontKey(family, bold, italic);
		try {
			this._fonts[key] = opentype.loadSync(ttfPath);
			this._loadedFamilies.add(family);
		} catch (err) {
			console.error(`FontManager: failed to load font ${ttfPath}: ${err.message}`);
		}
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Load every bundled font family declared in `fonts.js`. Called from
	 * `SvgStart.constructor`.
	 *
	 * @returns {void} Nothing.
	 * @example
	 * manager.loadDefaults();
	 */
	loadDefaults() {
		////////////////////////////////////////////////////////////////////////////
		// Register each configured family variant so fallback lookup can stay
		// within the local cache during rendering.
		for (const [family, paths] of Object.entries(fontsConfig.families)) {
			this.loadFont(family, false, false, paths.normal);
			this.loadFont(family, true, false, paths.bold);
			this.loadFont(family, false, true, paths.italic);
			this.loadFont(family, true, true, paths.boldItalic);
		}
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Resolve the best available font object for a requested family and style,
	 * falling back through lighter variants and finally the bundled sans-serif
	 * family. Called from `FontManager.measureText`.
	 *
	 * @param {string} family Requested font family.
	 * @param {boolean} bold Whether bold text was requested.
	 * @param {boolean} italic Whether italic text was requested.
	 * @returns {object|null} Loaded opentype font or `null` if none was found.
	 * @example
	 * const font = manager.getFont("serif", false, true);
	 */
	getFont(family, bold, italic) {
		let key = this._fontKey(family, bold, italic);
		if (this._fonts[key]) return this._fonts[key];

		////////////////////////////////////////////////////////////////////////////
		// Retry with progressively looser matches before falling back to the
		// bundled sans-serif family.
		key = this._fontKey(family, bold, false);
		if (this._fonts[key]) return this._fonts[key];

		key = this._fontKey(family, false, italic);
		if (this._fonts[key]) return this._fonts[key];

		key = this._fontKey(family, false, false);
		if (this._fonts[key]) return this._fonts[key];

		key = this._fontKey("sans-serif", bold, italic);
		if (this._fonts[key]) return this._fonts[key];

		key = this._fontKey("sans-serif", false, false);
		return this._fonts[key] || null;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Measure the rendered width of a string for the active font settings.
	 * Called from `SvgContext.measureText`.
	 *
	 * @param {string} text Text to measure.
	 * @param {number} fontSizePx Font size in pixels.
	 * @param {string} fontFamily Requested font family.
	 * @param {boolean} bold Whether the text is bold.
	 * @param {boolean} italic Whether the text is italic.
	 * @returns {{ width: number }} Approximate or exact measured width.
	 * @example
	 * const size = manager.measureText("Hello", 14, "sans-serif", false, false);
	 */
	measureText(text, fontSizePx, fontFamily, bold, italic) {
		const font = this.getFont(fontFamily, bold, italic);
		if (!font) {
			////////////////////////////////////////////////////////////////////////////
			// Use a simple proportional fallback so rendering can continue even when a
			// configured font file is unavailable.
			return { width: text.length * fontSizePx * 0.6 };
		}

		return { width: font.getAdvanceWidth(text, fontSizePx) };
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Check whether a font family is available either from the bundled font set
	 * or the CSS generic-family fallbacks. Called from `Working.isValidFont`.
	 *
	 * @param {string} fontFamily Requested font family.
	 * @returns {boolean} True when the family can be resolved by the renderer.
	 * @example
	 * const ok = manager.isValidFont("monospace");
	 */
	isValidFont(fontFamily) {
		if (this._loadedFamilies.has(fontFamily)) return true;
		if (fontFamily === "monospace" || fontFamily === "sans-serif" || fontFamily === "serif") return true;
		return false;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Map an internal family name to the SVG font-family string emitted in the
	 * final document. Called from `SvgContext.fillText`.
	 *
	 * @param {string} family Internal family name.
	 * @returns {string} SVG-ready font-family string.
	 * @example
	 * const family = manager.getSvgFontFamily("sans-serif");
	 */
	getSvgFontFamily(family) {
		return fontsConfig.svgFamilyNames[family] || family;
	}
}

module.exports = FontManager;
