
# nitro-webshot

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
