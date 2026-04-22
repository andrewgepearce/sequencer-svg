const fs = require('fs');
const path = require('path');

//////////////////////////////////////////////////////////////////////////////
/**
 * Return the checked-in Mermaid feature fixture input files.
 *
 * Call sites: this file's validity regression test.
 *
 * @returns {string[]} Absolute `input.mmd` paths for all Mermaid feature fixtures.
 * @throws {Error} If the feature directory cannot be read.
 * @example
 * const fixturePaths = listMermaidFixtureInputs();
 */
function listMermaidFixtureInputs() {
	////////////////////////////////////////////////////////////////////////////
	// Enumerate only fixture directories that carry a checked-in Mermaid input
	// so the regression test tracks the repo surface users actually review.
	const featuresDirectory = path.join(__dirname, 'mermaid-features');
	return fs
		.readdirSync(featuresDirectory, {withFileTypes: true})
		.filter((entry) => entry.isDirectory())
		.map((entry) => path.join(featuresDirectory, entry.name, 'input.mmd'))
		.filter((fixturePath) => fs.existsSync(fixturePath));
}

describe('Checked-in Mermaid fixtures', () => {
	test('avoid transformer-only configured participant declaration forms', () => {
		////////////////////////////////////////////////////////////////////////////
		// Block the legacy JSON declaration shortcuts that the repo transformer can
		// still parse but Mermaid itself does not treat as standard sequence syntax.
		const fixturePaths = listMermaidFixtureInputs();
		const invalidFixtures = fixturePaths.filter((fixturePath) => {
			const source = fs.readFileSync(fixturePath, 'utf8');
			return /^(?:\s*)(?:participant|actor)\s+[A-Za-z0-9_][-A-Za-z0-9_]*\s+as\s+\{/m.test(source) || /^(?:\s*)(?:participant|actor)\s+\{/m.test(source);
		});

		expect(invalidFixtures).toEqual([]);
	});
});
