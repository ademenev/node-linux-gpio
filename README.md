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

```js
var gpio = require('linux-gpio');

gpio.export(266, {direction: gpio.DIR_OUT}, function(err, pin) {
  if (err) {
    console.error(err);
  } else {
    pin.set(function() {
      if (err) {
        console.error(err);
      }
      gpio.close();
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
[bluebird](https://github.com/petkaantonov/bluebird) is used for promises.

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

Before using a GPIO pin, it must be first exported by writing pin number to `/sys/class/gpio/export`. This creates `/sys/class/gpioXXX/`
directory with some files inside used to control the pin. Use `gpio.export()` function:

```js
var gpio = require('linux-gpio');

gpio.export(266, {direction: gpio.DIR_OUT}, function(err, pin) {
  console.log("Exported pin %d", pin.pin);
  gpio.close();
});
```
#### Specifying options
