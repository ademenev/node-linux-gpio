# node-linux-gpio
Access GPIO on Linux from nodejs using /sys filesystem

## Installation
```bash
npm install linux-gpio
```

## Usage

### Permissions
Note that a process writing to /sys filesystem should run with super user privileges

### Basic setup

#### Classical blinker example

```js
var gpio = require('linux-gpio');

gpio.export(266, {direction: gpio.DIR_OUT}, function(err, pin) {
  if (err) {
    console.error(err);
  } else {
    pin.set(function() {
      if (err) {
        console.error(err);
      } else {
        var count = 20;
        var interval = setInterval(function() {
          pin.toggle(function(err) {
            count--;
            if (err || !count) {
              clearInterval(interval);
        	    gpio.close();
            }
          });
        }, 1000);
      }
    });
  }
});
```

Note that for simplicity, further examples do not include error checking. You should always check for errors.

### Promises and callbacks

Most functions are asynchronous, returning immediately and delivering result later via callbacks.
Two approaches are possible: using node-style callbacks and using promises.

Code examples here use node-style callbacks:

```js
var gpio = require('linux-gpio');

gpio.export(266, {direction: gpio.DIR_OUT}, function(err, pin) {
  if (err) {
    console.error(err);
  } else {
    console.log("Exported pin %d", pin.pin);
  }
  gpio.close();
});
```

To use promises, omit the last callback argument – and a promise will be returned.
By default, [bluebird](https://github.com/petkaantonov/bluebird) is used for promises.
See below for information about using other promise implementations

```js
var gpio = require('linux-gpio');

gpio.export(266, {direction: gpio.DIR_OUT})
  .then(function(pin) {
    console.log("Exported pin %d", pin.pin);
  })
  .catch(function(err) {
    console.error(err);
  })
  .finally(function() {
    gpio.close();
  });
```

### Expoting GPIO pin

Before using a GPIO pin, it must be first exported by writing pin number to `/sys/class/gpio/export`. 
This creates `/sys/class/gpioXXX/` directory with some files inside used to control the pin. 
Use `gpio.export()` function:

```js
var gpio = require('linux-gpio');

gpio.export(266, {direction: gpio.DIR_OUT}, function(err, pin) {
  console.log("Exported pin %d", pin.pin);
  gpio.close();
});
```

#### Specifying options

Second argument to `export()` is an object used to specify options such as pin I/O direction, interrupt mode and invert mode.
All keys are optional. If a key is not specified, corresponding option is not changed

```js
{
  "direction": gpio.DIR_OUT, // gpio.DIR_OUT, gpio.DIR_IN
  "invert": false, // true/false
  "edge": gpio.EDGE_RISING // gpio.EDGE_NONE, gpio.EDGE_RISING, gpio.EDGE_FALLING, gpio.EDGE_BOTH
}
```

See below for details about each option

### Stopping event loop

After you are done with GPIO, call `close()` to stop event loop used for interrupt handling. Otherwise, your program will not exit when you expect it to do so

### Changing pin direction

```js
var gpio = require('linux-gpio');

gpio.export(266, {}, function(err, pin) {
  console.log("Exported pin %d", pin.pin);
  pin.direction(gpio.DIR_OUT, function(err) {
    console.log("Pin %d configured as output", pin.pin);
    pin.direction(gpio.DIR_IN, function(err) {
      console.log("Pin %d configured as input", pin.pin);
      gpio.close();
    });
  });
});
```

Use `gpio.DIR_OUT` for output, `gpio.DIR_IN` for input

I/O direction can also be specified using `direction` option for `gpio.export()` call.

### Reading pin direction

```js
var gpio = require('linux-gpio');

gpio.export(266, {}, function(err, pin) {
  console.log("Exported pin %d", pin.pin);
  pin.direction(function(err, dir) {
    console.log("Pin %d configured as %s", pin.pin, dir);
    gpio.close();
  });
});
```

### Changing pin invert mode

```js
var gpio = require('linux-gpio');

gpio.export(266, {}, function(err, pin) {
  console.log("Exported pin %d", pin.pin);
    pin.invert(true, function(err) {
    console.log("Pin %d is in inverted mode", pin.pin);
    pin.invert(false, function(err) {
      console.log("Pin %d is in non-inverted mode", pin.pin);
      gpio.close();
    });
  });
});
```

Inverted mode can also be specified using `invert` option for `gpio.export()` call.

### Reading pin invert mode

```js
var gpio = require('linux-gpio');

gpio.export(266, {}, function(err, pin) {
  console.log("Exported pin %d", pin.pin);
  pin.invert(function(err, inv) {
    console.log("Pin %d inverted mode:", pin.pin, inv);
    gpio.close();
  });
});
```

### Reading pin state
```js
var gpio = require('linux-gpio');

gpio.export(266, {}, function(err, pin) {
  console.log("Exported pin %d", pin.pin);
  pin.value(function(err, state) {
    console.log("Pin %d state:", pin.pin, state);
    gpio.close();
  });
});
```

### Changing pin state

#### Set to high

```js
var gpio = require('linux-gpio');

gpio.export(266, {}, function(err, pin) {
  console.log("Exported pin %d", pin.pin);
  pin.set(function(err) {
    console.log("Pin %d set to high", pin.pin);
    gpio.close();
  });
});
```

or

```js
var gpio = require('linux-gpio');

gpio.export(266, {}, function(err, pin) {
  console.log("Exported pin %d", pin.pin);
  pin.set(1, function(err) {
    console.log("Pin %d set to high", pin.pin);
    gpio.close();
  });
});
```
#### Set to low

```js
var gpio = require('linux-gpio');

gpio.export(266, {}, function(err, pin) {
  console.log("Exported pin %d", pin.pin);
  pin.reset(function(err) {
    console.log("Pin %d set to low", pin.pin);
    gpio.close();
  });
});
```

or

```js
var gpio = require('linux-gpio');

gpio.export(266, {}, function(err, pin) {
  console.log("Exported pin %d", pin.pin);
  pin.set(0, function(err) {
    console.log("Pin %d set to low", pin.pin);
    gpio.close();
  });
});
```

#### Toggling pin state

```js
var gpio = require('linux-gpio');

gpio.export(266, {}, function(err, pin) {
  console.log("Exported pin %d", pin.pin);
  pin.toggle(function(err, prev) {
    console.log("Pin %d toggled, previous state was %d", pin.pin, prev);
    gpio.close();
  });
});
```

### Interrupts

#### Setting interrupt mode

```js
var gpio = require('linux-gpio');

gpio.export(266, {direction: gpio.DIR_IN}, function(err, pin) {
  console.log("Exported pin %d", pin.pin);
  pin.edge(gpio.EDGE_BOTH, function(err) {
    console.log("Pin %d interrupt mode set to \"both\"", pin.pin);
    gpio.close();
  });
});
```

Use one of `gpio.EDGE_NONE`, `gpio.EDGE_RISING`, `gpio.EDGE_FALLING` and `gpio.EDGE_BOTH`. `gpio.EDGE_NONE` disables interrupt.

Interrupt mode can also be specified using `edge` option for `gpio.export()` call.

Interrupt mode can be only specified for pins configured as inputs. Not all GPIO pins can generate interrupts, even if configured as input. Refer to yor system's documentation to find out which pins are interrupt-enabled.

#### Reading interrupt mode

```js
var gpio = require('linux-gpio');

gpio.export(266, {direction: gpio.DIR_IN}, function(err, pin) {
  console.log("Exported pin %d", pin.pin);
  pin.edge(function(err, edge) {
    console.log("Pin %d interrupt mode is \"%s\"", pin.pin, edge);
    gpio.close();
  });
});
```

#### Reacting to interrupts

```js
var gpio = require('linux-gpio');

gpio.export(266, {direction: gpio.DIR_IN}, function(err, pin) {
  console.log("Exported pin %d", pin.pin);
  pin.edge(gpio.EDGE_BOTH, function(err) {
    console.log("Pin %d interrupt mode set to \"both\"", pin.pin);
    pin.on('interrupt', function() {
      console.log('interrupt');
    });
    setTimeout(gpio.close, 5000);
  });
});
```

### Unexporting a pin

Unexporting a pin removes corresponding directory from /sys filesystem, and removes event handlers.

```js
var gpio = require('linux-gpio');

gpio.export(266, {direction: gpio.DIR_IN}, function(err, pin) {
  console.log("Exported pin %d", pin.pin);
  pin.unexport(function(err) {
    console.log("Pin %d unexported", pin.pin);
    gpio.close();
  });
});
```

### Using other promise libraries

If you prefer other promise library to bluebird, you have to configure node-linux-gpio first.

Simpliest form (using [Q](https://github.com/kriskowal/q) as example):

```js
var gpio = require('linux-gpio');
var Q = require('q');

gpio.usePromise(Q.Promise);
```

Just pass promise constructor or function returning a new promise to `usePromise`.

Promises are expected to support `then`, `catch`, and `finally` methods. If your (hypotetical) promise library uses other method names, do the following:

```js
var gpio = require('linux-gpio');
var Q = require('q');

/* Q supports legacy fail() and fin() methods */
gpio.usePromise({
  func: Q.Promise,
  then: 'then',
  'catch': 'fail',
  'finally' : 'fin'
});
```

and then you can do

```js
gpio.export(266, {direction: gpio.DIR_OUT})
  .then(function(pin) {
    console.log("Exported pin %d", pin.pin);
  })
  .fail(function(err) {
    console.error(err);
  })
  .fin(function() {
    gpio.close();
  });
  ```
