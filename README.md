Ovt plugin for [baiji](https://github.com/baijijs/baiji)
========================================================

# Installation

```bash
# npm install ovt-plugin-baiji
```

``` js
const ovt = require('ovt');

ovt.plugin('baiji');

// Or

ovt.plugin(require('ovt-plugin-baiji'));

// middleware
const middleware = require('ovt-plugin-baiji').middleware(function(ctx, next) {
  if (ctx.ovtErrors) {
    // handle error logic
  }
}, { abortEarly: true });
```
