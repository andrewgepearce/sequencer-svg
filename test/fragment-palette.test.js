const Utilities = require("../Utilities.js");

describe("built-in fragment background palette", () => {
	test("provides ten nesting-depth colours", () => {
		expect(Utilities.getBuiltInFragmentBgColours()).toEqual([
			"rgb(184,184,184)",
			"rgb(255,182,196)",
			"rgb(158,255,25)",
			"rgb(66,227,245)",
			"rgb(255,212,121)",
			"rgb(220,210,255)",
			"rgb(202,245,224)",
			"rgb(255,244,204)",
			"rgb(214,232,255)",
			"rgb(255,218,232)",
		]);
	});
});
