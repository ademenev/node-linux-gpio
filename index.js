// vim: set ts=2 sw=2 et ai si :

var Epoll = require('epoll').Epoll;
var Promise = require('bluebird');
var fs = require('fs');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var basePath = '/sys/class/gpio/';
var byPin = {};
var byFD = {};

var promiseOrCallback = function(thiz, promise, callback) {
  if (typeof callback !== 'function') {
    return promise;
  }
  promise.then(function() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift(null);
    callback.apply(thiz, args);
  }).catch(function(e) {
    callback.apply(thiz, [e]);
  });
}

var poller = new Epoll(function (err, fd, events) {
  // Read GPIO value file. Reading also clears the interrupt. 
  var buffer = new Buffer(1);
  // readSync here is used intentionally
  // it guarantees that events are emited in order
  fs.readSync(fd, buffer, 0, 1, 0);
  var pin = byFD[fd];
  if (pin) {
    var value = parseInt(buffer.toString()) ? 0 : 1;
    pin.emit('interrupt', value);
  };
});

var isExported = function(pin, callback) {
  var file = basePath + 'gpio' + pin + '/value';
  fs.stat(file, function(err, stat) {
    callback(!err);
  });
};

var Pin = function(pin) {
  EventEmitter.call(this);
  this.pin = pin;
}

util.inherits(Pin, EventEmitter);

var readFile = function(name) {
  return new Promise(function(fulfill, reject) {
    fs.readFile(name, function(err, data) {
      if (err) {
        reject(err);
      } else {
        fulfill(data.toString().trim());
      }
    });
  });
};

var writeFile = function(name, data) {
  return new Promise(function(fulfill, reject) {
    fs.writeFile(name, data, function(err) {
      if (err) {
        reject(err);
      } else {
        fulfill();
      }
    });
  });
};

Pin.prototype.unexport = function(callback) {
  var self = this;
  var promise = new Promise(function(fulfill, reject) {
    var file = basePath + 'unexport';
    if (self.fd) {
      poller.remove(self.fd);
      fs.close(self.fd);
      delete byFD[self.fd];
    }
    delete byPin[self.pin];
    self.fd = null;
    fs.stat(file, function(err, stat) {
      if (err) {
        reject(err);
      } else {
        isExported(self.pin, function(yes) {
          if (yes) {
            fs.writeFile(file, self.pin, function(err) {
              if (err) {
                reject(err);
              } else {
                fulfill();
              }
            });
          } else {
            fulfill();
          }
        });
      }
    });
  });
  return promiseOrCallback(this, promise, callback);
};

Pin.prototype.value = function(callback) {
  var file = basePath + 'gpio' + this.pin + '/value';
  var promise = new Promise(function(fulfill, reject) {
    fs.readFile(file, function(err, data) {
      if (err) {
        reject(err);
      } else {
        fulfill(parseInt(data));
      }
    });
  });
  return promiseOrCallback(this, promise, callback);
};

Pin.prototype.set = function(value, callback) {
  if (arguments.length == 1 && typeof value == 'function') {
    callback = value;
    value = undefined;
  }
  var file = basePath + 'gpio' + this.pin + '/value';
  var promise = new Promise(function(fulfill, reject) {
    if (typeof value === 'undefined') {
      value = 1;
    }
    value = value ? 1 : 0;
    fs.writeFile(file, value, function(err) {
      if (err) {
        reject(err);
      } else {
        fulfill();
      }
    });
  });
  return promiseOrCallback(this, promise, callback);
};

Pin.prototype.reset = function(callback) {
  return this.set(0, callback);
};

Pin.prototype.toggle = function(callback) {
  var file = basePath + 'gpio' + this.pin + '/value';
  var self = this;
  var promise = self.value().then(function(val) {
    return self.set(val ? 0 : 1).then(function() {
      return val;
    });
  });
  return promiseOrCallback(this, promise, callback);
};


var readOrWrite = function(file, args, boolValue) {
  var value, callback;
  if (args.length == 1 && typeof args[0] === 'function') {
    callback = args[0];
  } else if (args.length == 1) {
    value = args[0];
  } else if (args.length > 1) {
    value = args[0];
    callback = args[1];
  }
  if (boolValue) {
    value = value ? 1 : 0;
  }
  var promise;
  if (typeof value === 'undefined') {
    promise = readFile(file);
  } else {
    promise = writeFile(file, value);
  }
  return promiseOrCallback(this, promise, callback);
}

Pin.prototype.direction = function(value, callback) {
  var file = basePath + 'gpio' + this.pin + '/direction';
  return readOrWrite(file, arguments);
}

Pin.prototype.edge = function(value, callback) {
  var file = basePath + 'gpio' + this.pin + '/edge';
  return readOrWrite(file, arguments);
}

Pin.prototype.invert = function(value, callback) {
  var file = basePath + 'gpio' + this.pin + '/active_low';
  return readOrWrite(file, arguments, true);
}

var watchPin = function(pin) {
  return new Promise(function(fulfill, reject) {
    var file = basePath + 'gpio' + pin.pin + '/value';
    fs.open(file, 'r', function(err, fd) {
      if (err) {
        reject(err);
      } else {
        var buffer = new Buffer(1);
        fs.read(fd, buffer, 0, 1, 0, function(err) {
          if (err) {
            reject(err);
          } else {
            pin.fd = fd;
            byFD[fd] = pin;
            poller.add(fd, Epoll.EPOLLPRI);
            fulfill();
          }
        });
      }
    });
  });
};

Pin.export = function(pin, callback) {
  var file = basePath + 'export';
  fs.stat(file, function(err, stat) {
    if (err) {
      return callback(err);
    }
    isExported(pin, function(yes) {
      if (!yes) {
        fs.writeFile(file, pin, function(err) {
          if (err) {
            return callback(err);
          }
          return callback(null, new Pin(pin));
        });
      } else {
        return callback(null, new Pin(pin));
      }
    })
  });
};

var _export = function(pin, options, callback) {
  if (arguments.length == 2 && typeof options === 'function') {
    callback = options;
    options = {};
  }
  if (typeof options !== 'object') {
    options = {};
  }
  pin = parseInt(pin);
  var promise = new Promise(function(fulfill, reject) {
    if (isNaN(pin)) {
      reject(new Error('Invalid pin number'));
      return;
    }
    if (byPin[pin]) {
      fulfill(byPin[pin]);
      return;
    }
    Pin.export(pin, function(err, thePin) {
      if (err) {
        reject(err);
        return;
      }
      byPin[pin] = thePin;
      byFD[thePin.fd] = thePin;
      fulfill(thePin);
    });
  });
  var thePin;
  var ret = promise.then(function(p) {
    thePin = p;
    if (typeof options.direction !== 'undefined') {
      return thePin.direction(options.direction);
    }
  }).then(function() {
    if (typeof options.invert !== 'undefined') {
      return thePin.invert(options.invert);
    }
  }).then(function() {
    if (typeof options.edge !== 'undefined') {
      return thePin.edge(options.edge);
    }
  }).then(function() {
    return watchPin(thePin);
  }).then(function() {
    return thePin;
  });
  return promiseOrCallback(this, ret, callback);
};

var close = function() {
  poller.close();
  for (var pinNumber in byPin) {
    var pin = byPin[pinNumber];
    if (pin.fd) {
      fs.close(pin.fd);
      pin.fd = null;
    }
  }
  byPin = {};
  byFD = {};
};

module.exports = {
  export: _export,
  close: close,
  DIR_IN : 'in',
  DIR_OUT : 'out',
  EDGE_NONE: 'none',
  EDGE_RISING: 'rising',
  EDGE_FALLING: 'falling',
  EDGE_BOTH: 'both'
};

