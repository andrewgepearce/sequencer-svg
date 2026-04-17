// Copyright (C) 2019 Mark The Page
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

const _schemaUtils = require("./schemaUtils.js");
let TextMetadata = require("./TextMetadata.js");

//////////////////////////////////////////////////////////////////////////////
/**
 * Hold the title-schema property bag before text-rectangle defaults are merged
 * in.
 *
 * @type {object}
 */
let _propertiesForFullObject = {
	text: {
		oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
	},
};

_propertiesForFullObject = _schemaUtils._extendPropertiesWithTextRectangle(
	_propertiesForFullObject,
	TextMetadata.getDefaultTmd(),
	undefined,
	undefined,
	0,
	false,
	false,
	false,
	false
);

//////////////////////////////////////////////////////////////////////////////
/**
 * Export the JSON schema fragment that validates diagram titles.
 *
 * @type {object}
 */
module.exports._title = {
	$schema: "http://json-schema.org/draft-07/schema#",
	$id: _schemaUtils._base + "title",
	title: "Title Text Rectangle Schema",
	decription: "Defines the title of the sequence diagram.",
	oneOf: [
		{ type: "string" },
		{ type: "array", items: { type: "string" } },
		{
			type: "object",
			properties: _propertiesForFullObject,
		},
	],
};
