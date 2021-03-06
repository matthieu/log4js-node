describe 'log4js'
  before
      extend(context, {
        log4js : require("log4js"),
        fs: require("fs"),
        waitForWriteAndThenReadFile : function (filename) {
          process.loop();
          return fs.readFileSync(filename, "utf8");
        }
      });
  end

  before_each 
    log4js.clearAppenders();
    event = '';
    logger = log4js.getLogger('tests');
    logger.setLevel("TRACE");
    logger.addListener("log", function (logEvent) { event = logEvent; });    
  end
  
  describe 'getLogger'
          
    it 'should take a category and return a Logger'
      logger.category.should.be 'tests'
      logger.level.should.be log4js.levels.TRACE
      logger.should.respond_to 'debug'
      logger.should.respond_to 'info'
      logger.should.respond_to 'warn'
      logger.should.respond_to 'error'
      logger.should.respond_to 'fatal'
    end
    
    it 'should emit log events'
      logger.trace("Trace event");
      
      event.level.toString().should.be 'TRACE'
      event.message.should.be 'Trace event'
      event.startTime.should.not.be undefined
    end
    
    it 'should not emit events of a lower level than the minimum'
      logger.setLevel("DEBUG");
      event = undefined;
      logger.trace("This should not generate a log message");
      event.should.be undefined
    end
  end
  
  describe 'addAppender'
    before_each
      appenderEvent = undefined;
      appender = function(logEvent) { appenderEvent = logEvent; };
    end
        
    describe 'without a category'
      it 'should register the function as a listener for all loggers'
        log4js.addAppender(appender);
        logger.debug("This is a test");
        appenderEvent.should.be event
      end
      
      it 'should also register as an appender for loggers if an appender for that category is defined'
        var otherEvent;
        log4js.addAppender(appender);
        log4js.addAppender(function (evt) { otherEvent = evt; }, 'cheese');
        
        var cheeseLogger = log4js.getLogger('cheese');
        cheeseLogger.addListener("log", function (logEvent) { event = logEvent; });    

        cheeseLogger.debug('This is a test');
        
        appenderEvent.should.be event
        otherEvent.should.be event
        
        otherEvent = undefined;
        appenderEvent = undefined;
        log4js.getLogger('pants').debug("this should not be propagated to otherEvent");
        otherEvent.should.be undefined
        appenderEvent.should.not.be undefined
        appenderEvent.message.should.be "this should not be propagated to otherEvent"
        
        cheeseLogger = null;
      end
    end
    
    describe 'with a category'
      it 'should only register the function as a listener for that category'
        log4js.addAppender(appender, 'tests');
        
        logger.debug('this is a test');
        appenderEvent.should.be event
        
        appenderEvent = undefined;
        log4js.getLogger('some other category').debug('Cheese');
        appenderEvent.should.be undefined
      end
    end
    
    describe 'with multiple categories'
      it 'should register the function as a listener for all the categories'
        log4js.addAppender(appender, 'tests', 'biscuits');
        
        logger.debug('this is a test');
        appenderEvent.should.be event
        appenderEvent = undefined;
        
        var otherLogger = log4js.getLogger('biscuits');
        otherLogger.debug("mmm... garibaldis");
        appenderEvent.should.not.be undefined
        appenderEvent.message.should.be "mmm... garibaldis"
        appenderEvent = undefined;
        
        otherLogger = null;
        
        log4js.getLogger("something else").debug("pants");
        appenderEvent.should.be undefined
      end
      
      it 'should register the function when the list of categories is an array'
        log4js.addAppender(appender, ['tests', 'pants']);
        
        logger.debug('this is a test');
        appenderEvent.should.be event
        appenderEvent = undefined;
        
        var otherLogger = log4js.getLogger('pants');
        otherLogger.debug("big pants");
        appenderEvent.should.not.be undefined
        appenderEvent.message.should.be "big pants"
        appenderEvent = undefined;
        
        otherLogger = null;
        
        log4js.getLogger("something else").debug("pants");
        appenderEvent.should.be undefined
      end      
    end
  end
  
  describe 'basicLayout'
    it 'should take a logevent and output a formatted string'
      logger.debug('this is a test');
      var output = log4js.basicLayout(event);
      output.should.match /\[.*?\] \[DEBUG\] tests - this is a test/
    end
    
    it 'should output a stacktrace, message if the event has an error attached'
      var error = new Error("Some made-up error");
      var stack = error.stack.split(/\n/);
      
      logger.debug('this is a test', error);

      var output = log4js.basicLayout(event);
      var lines = output.split(/\n/);
      lines.length.should.be stack.length+1 
      lines[0].should.match /\[.*?\] \[DEBUG\] tests - this is a test/
      lines[1].should.match /\[.*?\] \[DEBUG\] tests - Error: Some made-up error/
      for (var i = 1; i < stack.length; i++) {
        lines[i+1].should.eql stack[i]
      }
    end
    
    it 'should output a name and message if the event has something that pretends to be an error'
      logger.debug('this is a test', { name: 'Cheese', message: 'Gorgonzola smells.' });
      var output = log4js.basicLayout(event);
      var lines = output.split(/\n/);
      lines.length.should.be 2 
      lines[0].should.match /\[.*?\] \[DEBUG\] tests - this is a test/
      lines[1].should.match /\[.*?\] \[DEBUG\] tests - Cheese: Gorgonzola smells./
    end
  end
  
  describe 'messagePassThroughLayout'
    it 'should take a logevent and output only the message'
      logger.debug('this is a test');
      log4js.messagePassThroughLayout(event).should.be 'this is a test'
    end
  end
  
  describe 'fileAppender'
    before
      log4js.clearAppenders();
      try {
        fs.unlinkSync('./tmp-tests.log');
      } catch(e) {
        //print('Could not delete tmp-tests.log: '+e.message);
      }
    end
    
    it 'should write log events to a file'
      log4js.addAppender(log4js.fileAppender('./tmp-tests.log', log4js.messagePassThroughLayout), 'tests');
      logger.debug('this is a test');
      
      waitForWriteAndThenReadFile('./tmp-tests.log').should.be 'this is a test\n'
    end
  end
  
  describe 'logLevelFilter'
  
    it 'should only pass log events greater than or equal to its own level'
      var logEvent;
      log4js.addAppender(log4js.logLevelFilter('ERROR', function(evt) { logEvent = evt; }));
      logger.debug('this should not trigger an event');
      logEvent.should.be undefined
      
      logger.warn('neither should this');
      logEvent.should.be undefined
      
      logger.error('this should, though');
      logEvent.should.not.be undefined
      logEvent.message.should.be 'this should, though'
      
      logger.fatal('so should this')
      logEvent.message.should.be 'so should this'
    end
    
  end
  
  describe 'configure'    
    before_each
      log4js.clearAppenders();
      try {
        fs.unlinkSync('./tmp-tests.log');
      } catch(e) {
        //print('Could not delete tmp-tests.log: '+e.message);
      }
      try {
        fs.unlinkSync('./tmp-tests-warnings.log');
      } catch (e) {
        //print('Could not delete tmp-tests-warnings.log: '+e.message);
      }
    end

    it 'should load appender configuration from a json file'
      //this config file defines one file appender (to ./tmp-tests.log)
      //and sets the log level for "tests" to WARN
      log4js.configure('spec/fixtures/log4js.json');
      event = undefined;
      logger = log4js.getLogger("tests");
      logger.addListener("log", function(evt) { event = evt });
      
      logger.info('this should not fire an event');
      event.should.be undefined
      
      logger.warn('this should fire an event');
      event.message.should.be 'this should fire an event'
      waitForWriteAndThenReadFile('./tmp-tests.log').should.be 'this should fire an event\n'
    end
    
    it 'should handle logLevelFilter configuration'
      log4js.configure('spec/fixtures/with-logLevelFilter.json');
      
      logger.info('main');
      logger.error('both');
      logger.warn('both');
      logger.debug('main');

      waitForWriteAndThenReadFile('./tmp-tests.log').should.be 'main\nboth\nboth\nmain\n'
      waitForWriteAndThenReadFile('./tmp-tests-warnings.log').should.be 'both\nboth\n'
    end
  end
  
end

describe 'Date'
  before
    require("log4js");
  end
  
  describe 'toFormattedString'
    it 'should add a toFormattedString method to Date'
      var date = new Date();
      date.should.respond_to 'toFormattedString'
    end
    
    it 'should default to a format'
      var date = new Date(2010, 0, 11, 14, 31, 30, 5);
      date.toFormattedString().should.be '2010-01-11 14:31:30.005'
    end
  end
end
