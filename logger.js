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

"use strict";

const { createLogger, format, transports } = require("winston");

require("winston-daily-rotate-file");

//////////////////////////////////////////////////////////////////////////////
/**
 * Store the rotating file transport used for persisted sequencer logs.
 *
 * @type {import("winston-daily-rotate-file")}
 */
const logRotateTransport = new transports.DailyRotateFile({
	filename: "seqeuncer-%DATE%.log",
	datePattern: "YYYY-MM-DD-HH",
	zippedArchive: true,
	utc: true,
	createSymlink: true,
	symlinkName: "sequencer-current.log",
	maxFiles: "14d",
});

//////////////////////////////////////////////////////////////////////////////
/**
 * Format winston log records as JSON strings with an ISO timestamp and the
 * measured elapsed time field. Used by `logger`.
 *
 * @param {{ level?: string, message?: string, ms?: string }} info Raw winston
 * log payload.
 * @returns {string} JSON-encoded log record.
 * @example
 * const line = formatLogEntry({ level: "info", message: "Started", ms: "5ms" });
 */
function formatLogEntry(info) {
	////////////////////////////////////////////////////////////////////////////
	// Normalise the optional winston fields before serialising the record.
	const now = new Date().toISOString();
	const level = typeof info.level === "string" ? info.level : null;
	const message = typeof info.message === "string" ? info.message : null;
	const ms = typeof info.ms === "string" ? info.ms : null;

	return JSON.stringify({
		date: now,
		ms: ms,
		level: level,
		message: message,
	});
}

//////////////////////////////////////////////////////////////////////////////
/**
 * Log the removal of an expired rotated log file.
 *
 * @param {string} removedFilename Name of the deleted file.
 * @returns {void} Nothing.
 * @example
 * handleRemovedLogFile("sequencer-2026-04-17-10.log");
 */
function handleRemovedLogFile(removedFilename) {
	logger.info(`Log file ${removedFilename} removed`);
}

logRotateTransport.on("logRemoved", handleRemovedLogFile);

//////////////////////////////////////////////////////////////////////////////
/**
 * Hold the custom winston formatter built from `formatLogEntry`.
 *
 * @type {import("logform").Format}
 */
const jsonLogFormat = format.printf(formatLogEntry);

//////////////////////////////////////////////////////////////////////////////
/**
 * Provide the shared sequencer logger instance used across the application.
 *
 * @type {import("winston").Logger & { stream?: { write: Function } }}
 */
const logger = createLogger({
	level: "debug",
	exitOnError: false,
	format: format.combine(format.ms(), jsonLogFormat),
	transports: [new transports.Console(), logRotateTransport],
});

//////////////////////////////////////////////////////////////////////////////
/**
 * Bridge stream-style logging integrations back into the shared logger.
 *
 * @param {string} message Message emitted by the upstream stream.
 * @param {string} encoding Stream encoding value supplied by the caller.
 * @returns {void} Nothing.
 * @example
 * writeStreamMessage("request complete", "utf8");
 */
function writeStreamMessage(message, encoding) {
	////////////////////////////////////////////////////////////////////////////
	// Ignore the encoding metadata because winston only needs the message body.
	void encoding;
	logger.info(message);
}

logger.stream = {
	write: writeStreamMessage,
};

module.exports = logger;
