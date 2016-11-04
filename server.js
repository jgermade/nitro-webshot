
var express = require('express')
var app = express()
var bodyParser = require('body-parser')
var fs = require('fs')

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.get('/', function (req, res) {
  res.send('Hello World!')
})

app.use(express.static('public'))

app.post('/render', function (req, res) {
  var html = req.body.html.replace(/'/g, '\\\'').replace(/\n/g, '');

  fs.writeFileSync('render-this-html.js' , `
    page.content = '${ html }';
    setTimeout(function() {
        page.render('public/page.pdf');
        phantom.exit();
    }, 5000);
  `, { encoding: 'utf8' });

  require('child_process').execSync('$(npm bin)/phantomjs render-this-html.js')

  res.send('rendering!');
})

app.listen(3000, function () {
  console.log('Example app listening on port 3000!')

  var baseUrl = 'http://localhost:3000';

  console.log(`(function (d,h) {var s=d.createElement('script');s.src='${baseUrl}/nitro-webshot.js';h.appendChild(s)})(document,document.head);`)
});


// window.checkoutHTML = function () {
//
//   // var html = document.documentElement.outerHTML,
//   //     styles = [];
//   //
//   // html = html.replace(/<link[^>]*href="(.*?)"/g, function (_matched, href) {
//   //   styles.push( fetch(href).then(function (response) { return response.text(); }) );
//   //   console.debug('loading style', href);
//   //   return '<style rel="stylkesheet">$css{' + (styles.length - 1) + '}</style>';
//   // });
//   //
//   // return Promise.all(styles).then(function (fetchedStyles) {
//   //   html = html.replace(/\$css{(.*?)}/g, function (matched, index) {
//   //     return fetchedStyles[Number(index)];
//   //   });
//   //
//   //   console.log('render html', html);
//   //   return html;
//   // });
//
//
//   var matchedBase = location.origin + '/',
//       html = document.documentElement.outerHTML.replace(/<base\s+href="(.*)"[^>]*\/?>/, function (_matched, base) {
//         matchedBase = location.origin + base;
//         return '';
//       });
//
//   return html.replace(/<head>/, '<head><base href="' + matchedBase + '"/>').replace(/\s*<script[^>]*>([\s\S]*?)<\/script>\s*/g, '');
//
// };
