# nitro-webshot


The goal of this proyect is to provide a way to render current page in server side avoiding cross-browser issues.

### Installation

``` sh
npm install nitro-webshot --save
```

### Quick usage

``` js
require('nitro-webshot').server(3000, '0.0.0.0');
```

### Testing in Browser

``` js
// copy and paste following into your browser console:

(function (d) {
  var s=d.createElement('script');
  s.src='http://0.0.0.0:3000/nitro-webshot.js';
  d.head.appendChild(s)
})(document);

// once loaded execute following:

var request = nitroWebshot.render();
```

#### TODO

- [x] Try http://slimerjs.org/
