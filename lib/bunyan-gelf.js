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

 var   Gelf = require('gelf')
     , util = require('util')
     , EventEmitter = require('events').EventEmitter
     , flatten = require('flat').flatten
     , os = require('os');


function GelfStream(options) {
  this.gelf = new Gelf(options);
  this.writable = true;
  EventEmitter.call(this);
}

util.inherits(GelfStream, EventEmitter);


GelfStream.prototype.createMessage = function(record){

  var record = record || {}
     ,message = {
          version: "1.0"
        , hostname: os.hostname()
        , timestamp: Date.parse(new Date()) / 1000
        , short_message: 'no_message'
        , facility: 'gelf' };

  var syslog = { emergency: 0 ,alert: 1 ,critical: 2, error: 3, warning: 4 ,informational: 6 ,debug: 7, notice: 5 }
     ,levels = { fatal: 60, error: 50, warn: 40, info: 30, debug: 20, trace: 10};


  Object.keys(record).forEach(function(fieldName){
      // prevent prefix misuse
      if (fieldName.indexOf("__") === 0)
        fieldName = fieldName.substring(2);
      else if (fieldName.indexOf("_") === 0)
        fieldName = fieldName.substring(1);

      var value = record[fieldName]
        , type = Object.prototype.toString.call(value)
        , isobject = (type === "[object Object]" || type === "[object Array]");
      // nasty nasty function...
      function addCustomField(fieldName){
        if ( value && isobject ){
          var flat = flatten(value);
          Object.keys(flat).forEach(function(key){ 
            message["_" + fieldName + "." + key] =  flat[key];
          })
        }else
          message["_" + fieldName] = value;
      };

      try{
        switch(fieldName){
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
          if (!record.err || (record.err && !record.err.message)) // record.err.message has precedence over msg
            message.short_message = value;
          break;
        case "time": // Assuming ISO Date eg. new Date().toISODate()
          var t = Date.parse(value);
          if (isNaN(t))
            message["__timeError"] = "time field has an invalid date: " + value;
          else
            message.timestamp = Date.parse(value) / 1000;
          break;
        case "id":
          message.id = value;
          break;
        case "level":
          addCustomField(fieldName);
          if (value == levels.trace )
            message.level = syslog.debug;
          else if (value == levels.debug )
            message.level = syslog.debug;
          else if (value == levels.info )
            message.level = syslog.informational;
          else if (value == levels.warn )
            message.level = syslog.notice;
          else if (value == levels.error )
            message.level = syslog.error;
          else if (value == levels.fatal )
            message.level = syslog.emergency;
          else
            message.level = syslog.informational;
          break;
        case "src":
          if (isobject && record.src.line)
            message.line = record.src.line;
          if (isobject && record.src.line)
            message.file = record.src.file;
          if (isobject && record.src.func)
            message._func = record.src.func;
          addCustomField(fieldName);
          break;
        case "err":
          if (isobject && record.err.message)
            message.short_message = record.err.message;
          if (isobject && record.err.stack)
            message.full_message = record.err.stack;
          addCustomField(fieldName);
          break;
        default:
          addCustomField(fieldName);
          break;
        }
      }catch(err){
        message["__" + fieldName + "Error"] = err.toString();
        message["__" + fieldName + "ErrorJSON"] = JSON.stringify(record);
      }
  }); // ForEach
  return message;
};

GelfStream.prototype.write = function (record) {
  if (!this.writable)
    throw (new Error('GelfStream has been ended already'));

  if (Object.prototype.toString.call(record) === "[object String]")
    record = JSON.parse(record); // sometimes we got a json string
  
  return this.gelf.emit('gelf.log',this.createMessage(record));
};

GelfStream.prototype.end = function () {
  if (arguments.length > 0)
    this.write.apply(this, Array.prototype.slice.call(arguments));
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

module.exports.createStream = function(options){
  return new GelfStream(options);
}