const fs = require('fs');
const os = require('os');
const path = require('path');
const {execFileSync, spawnSync} = require('child_process');

//////////////////////////////////////////////////////////////////////////////
/**
 * Create a temporary directory for PNG output integration tests.
 *
 * Call sites: this file's CLI PNG output tests.
 *
 * @param {string} prefix Temporary-directory prefix.
 * @returns {string} Temporary directory path.
 * @throws {Error} If the operating system temporary directory cannot be used.
 * @example
 * const tempDir = createTempDir("sequencer-svg-png-");
 */
function createTempDir(prefix) {
	////////////////////////////////////////////////////////////////////////////
	// Keep each CLI run isolated so output-file assertions do not rely on prior
	// files left behind by another test case.
	return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

//////////////////////////////////////////////////////////////////////////////
/**
 * Write a minimal YAML fixture for CLI raster-output tests.
 *
 * Call sites: this file's CLI PNG output tests.
 *
 * @param {string} fixturePath YAML file path to write.
 * @returns {void} Nothing.
 * @throws {Error} If the fixture file cannot be written.
 * @example
 * writeYamlFixture("/tmp/diagram.yaml");
 */
function writeYamlFixture(fixturePath) {
	////////////////////////////////////////////////////////////////////////////
	// Use a tiny but valid sequence document so the test exercises the PNG path
	// without depending on broader Mermaid-transform fixtures.
	fs.writeFileSync(
		fixturePath,
		['title: PNG output', "version: '1.0'", 'actors:', '  - {name: Caller, alias: caller}', '  - {name: Callee, alias: callee}', 'lines:', '  - type: call', '    from: caller', '    to: callee', '    text: Render both artefacts', ''].join(
			'\n',
		),
		'utf8',
	);
}

//////////////////////////////////////////////////////////////////////////////
/**
 * Return whether a file begins with the PNG signature bytes.
 *
 * Call sites: this file's successful PNG sidecar assertion.
 *
 * @param {string} filePath File to inspect.
 * @returns {boolean} True when the file starts with the PNG signature.
 * @throws {Error} If the file cannot be read.
 * @example
 * const isPng = hasPngSignature("/tmp/diagram.png");
 */
function hasPngSignature(filePath) {
	////////////////////////////////////////////////////////////////////////////
	// Check the binary header directly so the test confirms raster output rather
	// than merely checking that some file exists with a .png name.
	const signature = fs.readFileSync(filePath).subarray(0, 8);
	return signature.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
}

describe('CLI PNG output', () => {
	test('opinionated mode writes a PNG beside the SVG by default', () => {
		const tempDir = createTempDir('sequencer-svg-png-opinionated-');
		const inputFile = path.join(tempDir, 'diagram.yaml');
		const outputFile = path.join(tempDir, 'diagram.svg');
		const pngFile = path.join(tempDir, 'diagram.png');

		writeYamlFixture(inputFile);

		execFileSync('node', ['sequencer.js', inputFile], {
			cwd: path.join(__dirname, '..'),
			stdio: 'pipe',
		});

		expect(fs.readFileSync(outputFile, 'utf8')).toContain('<svg');
		expect(fs.existsSync(pngFile)).toBe(true);
		expect(fs.statSync(pngFile).size).toBeGreaterThan(0);
		expect(hasPngSignature(pngFile)).toBe(true);
	});

	test('writes a PNG beside the SVG when --outpng is enabled', () => {
		const tempDir = createTempDir('sequencer-svg-png-');
		const inputFile = path.join(tempDir, 'diagram.yaml');
		const outputFile = path.join(tempDir, 'diagram.svg');
		const pngFile = path.join(tempDir, 'diagram.png');

		writeYamlFixture(inputFile);

		execFileSync('node', ['sequencer.js', '-y', '-i', inputFile, '-o', outputFile, '-f', '--outpng'], {
			cwd: path.join(__dirname, '..'),
			stdio: 'pipe',
		});

		expect(fs.readFileSync(outputFile, 'utf8')).toContain('<svg');
		expect(fs.existsSync(pngFile)).toBe(true);
		expect(fs.statSync(pngFile).size).toBeGreaterThan(0);
		expect(hasPngSignature(pngFile)).toBe(true);
	});

	test('fails fast when --outpng is requested but SVG output would go to stdout', () => {
		const tempDir = createTempDir('sequencer-svg-png-stdout-');
		const inputFile = path.join(tempDir, 'diagram.yaml');

		writeYamlFixture(inputFile);

		const result = spawnSync('node', ['sequencer.js', '-y', '-i', inputFile, '--outpng'], {
			cwd: path.join(__dirname, '..'),
			encoding: 'utf8',
			stdio: 'pipe',
		});

		expect(result.status).not.toBe(0);
		expect(result.stderr).toContain('Cannot use --outpng when the SVG output is being written to stdout');
	});
});
