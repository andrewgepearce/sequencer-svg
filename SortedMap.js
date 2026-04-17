//////////////////////////////////////////////////////////////////////////////
/**
 * Preserve map semantics while iterating regular keys in sorted order and
 * supporting explicit entries that must appear before or after the sorted body.
 * Instantiated in `SVGBuilder.constructor`.
 *
 * @example
 * const map = new SortedMap([["b", 2], ["a", 1]]);
 * map.setFirst("background", 0);
 */
class SortedMap {
	////////////////////////////////////////////////////////////////////////////
	/**
	 * Create the sorted map and seed it with any initial entries. Called from
	 * `SVGBuilder.constructor`.
	 *
	 * @param {Array<[string|number, *]>} [entries=[]] Entries to preload.
	 * @returns {void} Nothing.
	 * @example
	 * const map = new SortedMap([["z", 26]]);
	 */
	constructor(entries = []) {
		this.map = new Map();
		entries.forEach(([key, value]) => this.set(key, value));
		this.firstElements = [];
		this.lastElements = [];
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Insert or replace a sorted entry in the main map body.
	 *
	 * @param {string|number} key Entry key.
	 * @param {*} value Entry value.
	 * @returns {SortedMap} This map instance.
	 * @example
	 * map.set("node-1", { x: 1 });
	 */
	set(key, value) {
		this.map.set(key, value);
		this._sortKeys();
		return this;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Queue an entry that must appear before the sorted map body during
	 * iteration.
	 *
	 * @param {string|number} key Entry key.
	 * @param {*} value Entry value.
	 * @returns {void} Nothing.
	 * @example
	 * map.setFirst("defs", svgDefs);
	 */
	setFirst(key, value) {
		this.firstElements.push({ key, value });
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Queue an entry that must appear after the sorted map body during
	 * iteration.
	 *
	 * @param {string|number} key Entry key.
	 * @param {*} value Entry value.
	 * @returns {void} Nothing.
	 * @example
	 * map.setLast("overlay", svgOverlay);
	 */
	setLast(key, value) {
		this.lastElements.push({ key, value });
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Retrieve an entry by key, searching the forced-first and forced-last
	 * collections before the sorted body.
	 *
	 * @param {string|number} key Entry key.
	 * @returns {*} Stored value or `undefined` when absent.
	 * @example
	 * const value = map.get("defs");
	 */
	get(key) {
		const firstElement = this.firstElements.find((el) => el.key === key);
		if (firstElement) return firstElement.value;

		const lastElement = this.lastElements.find((el) => el.key === key);
		return lastElement ? lastElement.value : this.map.get(key);
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Check whether any collection within the sorted map contains the key.
	 *
	 * @param {string|number} key Entry key.
	 * @returns {boolean} True when the key exists.
	 * @example
	 * const exists = map.has("overlay");
	 */
	has(key) {
		return this.map.has(key) || this.firstElements.some((el) => el.key === key) || this.lastElements.some((el) => el.key === key);
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Remove a key from whichever internal collection currently owns it.
	 *
	 * @param {string|number} key Entry key.
	 * @returns {boolean} True when an entry was removed.
	 * @example
	 * const removed = map.delete("overlay");
	 */
	delete(key) {
		let index = this.firstElements.findIndex((el) => el.key === key);
		if (index !== -1) {
			this.firstElements.splice(index, 1);
			return true;
		}

		index = this.lastElements.findIndex((el) => el.key === key);
		if (index !== -1) {
			this.lastElements.splice(index, 1);
			return true;
		}

		const result = this.map.delete(key);
		if (result) this._sortKeys();
		return result;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Empty all internal collections.
	 *
	 * @returns {void} Nothing.
	 * @example
	 * map.clear();
	 */
	clear() {
		this.map.clear();
		this.firstElements = [];
		this.lastElements = [];
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Report the total number of entries across all collections.
	 *
	 * @returns {number} Total entry count.
	 * @example
	 * const count = map.size;
	 */
	get size() {
		return this.map.size + this.firstElements.length + this.lastElements.length;
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Sort the main map body by numeric or lexical key order after mutations.
	 * Called from `SortedMap.set` and `SortedMap.delete`.
	 *
	 * @returns {void} Nothing.
	 * @example
	 * map._sortKeys();
	 */
	_sortKeys() {
		const sortedEntries = [...this.map.entries()].sort(([keyA], [keyB]) => {
			if (typeof keyA === "number" && typeof keyB === "number") {
				return keyA - keyB;
			}

			return String(keyA).localeCompare(String(keyB));
		});
		this.map = new Map(sortedEntries);
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Expose the combined iterator used by `for...of` consumers.
	 *
	 * @returns {Iterator<[string|number, *]>} Iterator across the first, sorted,
	 * and last collections.
	 * @example
	 * for (const [key, value] of map) console.log(key, value);
	 */
	[Symbol.iterator]() {
		const firstIterator = this.firstElements[Symbol.iterator]();
		const mapIterator = this.map[Symbol.iterator]();
		const lastIterator = this.lastElements[Symbol.iterator]();

		return {
			////////////////////////////////////////////////////////////////////////////
			/**
			 * Advance the composite iterator by one entry.
			 *
			 * @returns {{ value?: [string|number, *], done: boolean }} Iterator step.
			 * @example
			 * const step = iterator.next();
			 */
			next() {
				let result = firstIterator.next();
				if (!result.done) return { value: [result.value.key, result.value.value], done: false };

				result = mapIterator.next();
				if (!result.done) return result;

				result = lastIterator.next();
				if (!result.done) return { value: [result.value.key, result.value.value], done: false };

				return { done: true };
			},
		};
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Invoke a callback for every entry in iteration order.
	 *
	 * @param {Function} callback Callback receiving value, key, and map.
	 * @param {*} thisArg Optional `this` binding.
	 * @returns {void} Nothing.
	 * @example
	 * map.forEach((value, key) => console.log(key, value));
	 */
	forEach(callback, thisArg) {
		this.firstElements.forEach((el) => callback.call(thisArg, el.value, el.key, this));
		this.map.forEach(callback, thisArg);
		this.lastElements.forEach((el) => callback.call(thisArg, el.value, el.key, this));
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Return an iterator across keys in full iteration order.
	 *
	 * @returns {Iterator<string|number>} Ordered key iterator.
	 * @example
	 * const keys = [...map.keys()];
	 */
	keys() {
		return [...this.firstElements.map((el) => el.key), ...this.map.keys(), ...this.lastElements.map((el) => el.key)].values();
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Return an iterator across values in full iteration order.
	 *
	 * @returns {Iterator<*>} Ordered value iterator.
	 * @example
	 * const values = [...map.values()];
	 */
	values() {
		return [...this.firstElements.map((el) => el.value), ...this.map.values(), ...this.lastElements.map((el) => el.value)].values();
	}

	////////////////////////////////////////////////////////////////////////////
	/**
	 * Return an iterator across entries in full iteration order.
	 *
	 * @returns {Iterator<[string|number, *]>} Ordered entry iterator.
	 * @example
	 * const entries = [...map.entries()];
	 */
	entries() {
		return [
			...this.firstElements.map((el) => [el.key, el.value]),
			...this.map.entries(),
			...this.lastElements.map((el) => [el.key, el.value]),
		].values();
	}
}

module.exports = SortedMap;
