var chai = require('chai')
  , expect = chai.expect
  , should = chai.should()
  , util = require('util')
  , stream = require('../lib/bunyan-gelf').createStream({
      graylogPort: 12201,
      graylogHostname: '127.0.0.1', 
      connection: 'lan',
      maxChunkSizeWan: 1420,
      maxChunkSizeLan: 8154
    });


describe('Smoking test',function(){
    it('should create a GelfStream',function(){
    	should.exist(stream);
    });
});

describe('When logging to GELF', function(done){
  var record = {
          "name": "mochatests",
          "component": "mocha",
          "hostname": "mocha.local",
          "pid": 123,
          "src": {
              "file": "/Users/trentm/tm/node-bunyan/examples/src.js",
              "line": 20,
              "func": "Wuzzle.woos"
          },
          "req": {
            "method": "GET",
            "url": "/path?q=1#anchor",
            "headers": {
              "x-hi": "Mom",
              "connection": "close"
            },
            "remoteAddress": "120.0.0.1",
            "remotePort": 51244
          },
          "user": "eric",
          "someDate": new Date(),          
          "access_token": null,
          "scopes": ["scope1", "scope2", 12345.0 ],
          "complexData": [{data: "name", source: { loc: "abc", time: new Date(), dest: 123.45 }}],          
          "level": 2,
          "msg": "testing event",
          "time": new Date().toISOString(),
          "v": 0
    }
    , Logger = require('bunyan');

  it('should return true from a write event',function(done){
    var result = stream.write(record);
    result.should.be.equal(true);
    done();
  });

  it('should log records successfully', function(done){
    var log = new Logger({
        name: "mywebapp",
        level: 'trace',
        service: 'exampleapp',
        stream: stream,
      });
    log.trace({err: 'errorname', stack:'somestack'}, 'test');
    done();
  })
});


describe('When converting a bunyan record to GELF', function(){
    var record = {
          "name": "webserver",
          "component": "child",
          "hostname": "banana.local",
          "id": 123456,
          "_id": 67890,
          "pid": 123,
          "req": {
            "method": "GET",
            "url": "/path?q=1#anchor",
            "headers": {
              "x-hi": "Mom",
              "connection": "close"
            },
            "remoteAddress": "120.0.0.1",
            "remotePort": 51244
          },
          "src": {
              "file": "/Users/craftti/bunyan-gelf/examples/broken.js",
              "line": 20,
              "func": "Wuzzle.woos"
          },
          "level": 3,
          "msg": "start request",
          "time": new Date().toISOString(),
          "v": 0
        }
        , gelf = stream.createMessage(record);

    it('should use 1.0 as version', function(done){
      gelf.should.have.property('version','1.0');
      done();
    });

    it('should use host as hostname', function(done){
        gelf.should.have.property('host', record.hostname);
        done();
    });

    it('should use msg as short_message', function(done){
        gelf.should.have.property('short_message', record.msg);
        done();
    });

    it('should use level as level', function(done){
      gelf.should.have.property('level', record.level);
      done();
    });

    it('should use time as timestamp', function(done){
      gelf.should.have.property('timestamp', Date.parse(record.time) / 1000);
      done();
    });

    it('should use name as facility', function(done){
      gelf.should.have.property('facility', record.name);
      done();
    });

    it('should not have _id', function(done){
      gelf.should.not.have.property('_id');
      done();
    });

    it('should send id as id (not as _id)', function(done){
      gelf.should.have.property('id', record.id);
      done();
    });

    it('should add extra fields as _field', function(done){
      gelf.should.have.property('_pid', 123);
      gelf.should.have.property('_component', record.component);
      done();
    });

    it('should serialize objects as flatten string',function(done){
      gelf.should.have.property('_req.method', record.req.method);
      gelf.should.have.property('_req.url', record.req.url);
      gelf.should.have.property('_req.headers.x-hi', record.req.headers["x-hi"]);
      gelf.should.have.property('_req.headers.connection', record.req.headers["connection"]);
      gelf.should.have.property('_req.remoteAddress', record.req.remoteAddress);
      gelf.should.have.property('_req.remotePort', record.req.remotePort);
      done();
    });

    it('should use src for line, file and _func fields', function(done){
      gelf.should.have.property('line', record.src.line);
      gelf.should.have.property('file', record.src.file);
      gelf.should.have.property('_func', record.src.func);
      done();
    });

    it('should send full src flattened as additional fields', function(done){
      gelf.should.have.property('_src.line', record.src.line);
      gelf.should.have.property('_src.file', record.src.file);
      gelf.should.have.property('_src.func', record.src.func);
      done();
    });

});

describe('When converting a bunyan record with an err object to GELF', function(){
    var record = {
          err: {
            message: "boom",
            name: "TypeError",
            stack: "TypeError: boom\n    at Object.<anonymous> ...",
            extra_info: { counter: 1, context: null, time: new Date() }
          },
          msg: "start request"
        }
        , gelf = stream.createMessage(record);

    it('should use err.message as short_message', function(done){
        gelf.should.have.property('short_message', record.err.message);
        done();
    });

    it('should use err.stack as full_message', function(done){
        gelf.should.have.property('full_message', record.err.stack);
        done();
    });

    it('should not use msg as short_message', function(done){
        gelf.short_message.should.not.be.equal(record.msg);
        done();
    });

    it('should send the full err flattened in additional fields',function(done){
      gelf.should.have.property('_err.message', record.err.message );
      gelf.should.have.property('_err.name', record.err.name );
      gelf.should.have.property('_err.stack', record.err.stack );
      gelf.should.have.property('_err.extra_info.counter', record.err.extra_info.counter );
      gelf.should.have.property('_err.extra_info.context', record.err.extra_info.context );
      gelf.should.have.property('_err.extra_info.time', record.err.extra_info.time );
      done()
    })
});

describe('When creating a message from a faulty record', function(done){

  it('should not throw exceptions when converting a faulty field', function(done){
    expect(stream.createMessage).to.not.throw();
    done();
  });

  it('should return at least a valid gelf message', function(done){
    var gelf = stream.createMessage({});
    gelf.should.have.property('version', '1.0');
    gelf.should.have.property('hostname');
    gelf.should.have.property('timestamp');
    gelf.should.have.property('short_message','no_message');
    gelf.should.have.property('facility','gelf');
    done();
  });

  // can't figure out how to really test this case.
  it('should serialize field excpetions as addtional __[field]Error and source record as __[field]ErrorJSON', function(done){
    var gelf = stream.createMessage({time: "blablahs"});
    gelf.should.have.property('__timeError');
    done();
  });
});