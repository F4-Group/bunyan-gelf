/**
 * GelfStream is a Writable Stream that sends logs to a GELF server using GELF-Node library.
 *
 * @param options {Object}, with the following fields:
 *
 *    - graylogPort: Graylogger service port
 *    - graylogHostname:  Graylogger hostname or IP address
 *    - connection: 'wan' or 'lan',
 *    - maxChunkSizeWan:
 *    - maxChunkSizeLan:
 */

const Gelf = require('gelf');
const util = require('util');
const {EventEmitter} = require('events');
const {flatten} = require('flat');
const os = require('os');

const SYSLOG = {emergency: 0, alert: 1, critical: 2, error: 3, warning: 4, informational: 6, debug: 7, notice: 5};
const LEVELS = {fatal: 60, error: 50, warn: 40, info: 30, debug: 20, trace: 10};

function GelfStream(options) {
    this.gelf = new Gelf(options);
    this.writable = true;
    this.pendingMessageCount = 0;
    EventEmitter.call(this);
}

util.inherits(GelfStream, EventEmitter);


GelfStream.prototype.createMessage = function (record) {

    record = record || {};
    const message = {
        version: "1.0",
        hostname: os.hostname(),
        timestamp: Date.parse(new Date()) / 1000,
        short_message: 'no_message',
        facility: 'gelf',
    };

    Object.keys(record).forEach(function (fieldName) {
        // prevent prefix misuse
        if (/^__/.test(fieldName)) {
            fieldName = fieldName.substring(2);
        } else if (/^_/.test(fieldName)) {
            fieldName = fieldName.substring(1);
        }

        const value = record[fieldName];
        const type = Object.prototype.toString.call(value);
        const isobject = (type === "[object Object]" || type === "[object Array]");

        // nasty nasty function...
        function addCustomField(fieldName) {
            if (value && isobject) {
                const flat = flatten(value);
                Object.keys(flat).forEach(function (key) {
                    message["_" + fieldName + "." + key] = flat[key];
                });
            } else {
                message["_" + fieldName] = value;
            }
        }

        try {
            switch (fieldName) {
                case "v":
                    message.version = "1.0";
                    break;
                case "name":
                    message.facility = value;
                    break;
                case "hostname":
                    message.host = value;
                    break;
                case "msg":
                    if (!record.err || (record.err && !record.err.message)) {// already handled in error
                        message.short_message = value;
                    }
                    break;
                case "time": {// Assuming ISO Date eg. new Date().toISODate()
                    const t = Date.parse(value);
                    if (isNaN(t)) {
                        message.__timeError = "time field has an invalid date: " + value;
                    } else {
                        message.timestamp = Date.parse(value) / 1000;
                    }
                    break;
                }
                case "id":
                    message.id = value;
                    break;
                case "level":
                    addCustomField(fieldName);
                    if (value == LEVELS.trace) {
                        message.level = SYSLOG.debug;
                    } else if (value == LEVELS.debug) {
                        message.level = SYSLOG.debug;
                    } else if (value == LEVELS.info) {
                        message.level = SYSLOG.informational;
                    } else if (value == LEVELS.warn) {
                        message.level = SYSLOG.notice;
                    } else if (value == LEVELS.error) {
                        message.level = SYSLOG.error;
                    } else if (value == LEVELS.fatal) {
                        message.level = SYSLOG.emergency;
                    } else {
                        message.level = SYSLOG.informational;
                    }
                    break;
                case "src":
                    if (isobject && record.src.line) {
                        message.line = record.src.line;
                    }
                    if (isobject && record.src.line) {
                        message.file = record.src.file;
                    }
                    if (isobject && record.src.func) {
                        message._func = record.src.func;
                    }
                    addCustomField(fieldName);
                    break;
                case "err": {
                    let prefix = "";
                    if (record.msg) {
                        prefix = record.msg + "\n";
                    }
                    if (isobject && record.err.message) {
                        message.short_message = prefix + record.err.message;
                    }
                    if (isobject && record.err.stack) {
                        message.full_message = prefix + record.err.stack;
                    }
                    addCustomField(fieldName);
                    break;
                }
                default:
                    addCustomField(fieldName);
                    break;
            }
        } catch (err) {
            message["__" + fieldName + "Error"] = err.toString();
            message["__" + fieldName + "ErrorJSON"] = JSON.stringify(record);
        }
    }); // ForEach
    return message;
};

GelfStream.prototype.write = function (record, callback) {
    if (!this.writable) {
        if (callback) {
            callback(new Error("stream not writable"));
        }
        return false;
    }

    const type = Object.prototype.toString.call(record);
    try {
        if (type === "[object String]") {
            record = JSON.parse(record); // sometimes we got a json string
        } else if (type !== "[object Object]") {
            record = {name: 'bunyan-gelf', invalidRecord: record, short_message: "invalid type " + type, level: 40};
        }
    } catch (err) {
        record = {name: 'bunyan-gelf', invalidRecord: record, short_message: err.toString(), level: 40};
    }

    this.pendingMessageCount++;
    return this.gelf.emit('gelf.log', this.createMessage(record), (err) => {
        this.pendingMessageCount--;
        if (callback) {
            callback(err);
        }
        if (this.pendingMessageCount == 0) {
            this.emit("drain");
        }
    });
};

GelfStream.prototype.end = function (record, callback) {
    if (typeof(record) == "function") {
        callback = record;
        record = null;
    }
    if (record) {
        this.write(record);
    }
    if (callback) {
        if (this.pendingMessageCount == 0) {
            callback();
        } else {
            this.on("drain", callback);
        }
    }
    this.writable = false;
};

GelfStream.prototype.destroy = function () {
    this.writable = false;
    this.emit('close');
};

GelfStream.prototype.destroySoon = function () {
    this.destroy();
};

module.exports = GelfStream;

module.exports.createStream = function (options) {
    return new GelfStream(options);
};
