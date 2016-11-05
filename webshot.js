
function uuid4 () {
  //// return uuid of form xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  var uuid = '', ii;
  for (ii = 0; ii < 32; ii += 1) {
    switch (ii) {
    case 8:
    case 20:
      uuid += '-';
      uuid += (Math.random() * 16 | 0).toString(16);
      break;
    case 12:
      uuid += '-';
      uuid += '4';
      break;
    case 16:
      uuid += '-';
      uuid += (Math.random() * 4 | 8).toString(16);
      break;
    default:
      uuid += (Math.random() * 16 | 0).toString(16);
    }
  }
  return uuid;
}

function dirname (filepath) {
  var parts = filepath.split('/');
  parts.pop();
  return parts.join('/');
}

function escapeHTML (html) {
  return html.replace(/'/g, '\\\'').replace(/"/g, '\\"').replace(/\n/g, '');
}

function htmlNoAnimations (html) {
  return html.replace(/<\/head>/, `
<style rel="stylesheet">
  *, *:before, *:after {
    -webkit-transition: none !important;
    -moz-transition: none !important;
    -o-transition: none !important;
    -ms-transition: none !important;
    transition: none !important;
    -webkit-animation: none !important;
    -moz-animation: none !important;
    -o-animation: none !important;
    -ms-animation: none !important;
    animation: none !important;
  }
</style>\n</head>`);
}

function htmlNoScripts (html) {
  return html.replace(/\s*<script[^>]*>([\s\S]*?)<\/script>\s*/g, '');
}

require('colors');

var express = require('express')
var bodyParser = require('body-parser')
var fs = require('fs')
var mkdirp = require('mkdirp')

var $q = require('q-promise');
function promisify (fn, options) {
  return function () {
    var _this = this, _args = [].slice.call(arguments);

    if( options ) {
      _args.push(_args, options);
    }

    return $q(function (resolve, reject) {
      fn.apply(_this, _args.concat(function (err, result) {
        if( err ) {
          reject(err);
        } else {
          resolve(result);
        }
      }) );
    });
  };
}

var _readFile = promisify(fs.createReadStream),
    _writeFile = promisify(fs.createWriteStream),
    file = {
      read: promisify(fs.readFile, { encoding: 'utf8' }),
      write: promisify(fs.writeFile, { encoding: 'utf8' }),
      mkdirp: promisify(mkdirp)
    },
    exec = promisify(require('child_process').exec);

function phantomjsCode (baseUrl, req, htmlFile, resultFile) {
return `
  var page = require('webpage').create();
  // if( '${ req.userAgent }' ) {
  //   page.onInitialized = function() {
  //     page.settings.userAgent = '${ req.userAgent }';
  //   };
  // }
  page.viewportSize = { width: ${ req.width || 1360 }, height: ${ req.height || 900 } };
  page.open('${baseUrl}/renders/${htmlFile}', function(status) {
    console.log("Status: " + status);
    if(status === "success") {
      page.scrollPosition = {
        top: 100,
        left: 0
      };
      setTimeout(function() {
        page.render('public/renders/phantom-${resultFile}');
        phantom.exit();
      }, ${ req.wait || 1000 });
    }
  });
  `;
}

function slimerjsCode (baseUrl, req, htmlFile, resultFile) {
return `
  var webpage = require('webpage').create();
  webpage
  .open('${baseUrl}/renders/${htmlFile}')
  .then(function(){
    // store a screenshot of the page
    webpage.viewportSize = { width: ${ req.width || 1360 }, height: ${ req.height || 900 } };
    // webpage.render('public/renders/slimer-${resultFile}', { onlyViewport: true });
    webpage.render('public/renders/slimer-${resultFile}', { onlyViewport: false });

    slimer.exit();
  });
  `;
}

function runServer (port, hostname) {

  port = port || 3000;
  hostname = hostname || '0.0.0.0';

  var baseUrl = `http://${hostname}:${port}`;

  var app = express()

  app.use(bodyParser.json({ limit: '5mb' })); // for parsing application/json
  app.use(bodyParser.urlencoded({ extended: true, limit: '5mb' })); // for parsing application/x-www-form-urlencoded

  app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });

  app.use(express.static('public'))

  app.post('/render', function (req, res) {

    var html = req.body.html,
        htmlShoot = htmlNoAnimations(htmlNoScripts(html));

    var resultFile = uuid4() + ( req.body.filename ? ( '/' + req.body.filename ) : '.png' ),
        htmlFile = resultFile.replace(/\.[a-zA-Z]+$/, '.html')

    var phantomScript = '/tmp/nitro-webshot/phantom-' + resultFile + '.js',
        slimerScript = '/tmp/nitro-webshot/slimer-' + resultFile + '.js';

    $q.all([
      file.write('last.html', html),
      file.mkdirp( dirname('public/renders/phantom-' + resultFile) ),
      file.mkdirp( dirname('public/renders/slimer-' + resultFile) ),
      file.mkdirp( dirname(phantomScript) )
    ]).then(function () {

      return $q.all([
        file.write(`public/renders/${htmlFile}`, htmlShoot),
        file.write( phantomScript, phantomjsCode(baseUrl, req.body, htmlFile, resultFile) ),
        file.write( slimerScript, slimerjsCode(baseUrl, req.body, htmlFile, resultFile) )
      ]);

    }).then(function () {

      $q.all([
        exec('$(npm bin)/phantomjs ' + phantomScript),
        exec('$(npm bin)/slimerjs ' + slimerScript)
      ]).then(function () {
        res.json({
          html: html,
          htmlShoot: htmlShoot,
          htmlFile: `/renders/phantom/${htmlFile}`,
          phantom: '/renders/phantom-' + resultFile,
          slimer: '/renders/slimer-' + resultFile
        });
      }, function () {
        res.status(500).send('error rendering!');
      });

    });

  });

  app.listen(3000, hostname, function () {
    console.log('Listening on ' + baseUrl.green )

    console.log('\ncopy and paste following into your browser console:\n'.yellow)
    console.log(`(function (d) {
var s=d.createElement('script');
s.src='${baseUrl}/nitro-webshot.js';
d.head.appendChild(s)
})(document);`)

    console.log('\nonce loaded execute following:\n'.yellow)

    console.log('var request = nitroWebshot.render();\n\n');

    fs.writeFileSync('public/index.html' ,
      '<p>copy and paste following into your browser console:</p>' +
      `<p><pre><code>(function (d) {
var s=d.createElement('script');
s.src='${baseUrl}/nitro-webshot.js';
d.head.appendChild(s)
})(document);</code></pre></p>` +
      '<br/>' +
      '<p>once loaded execute following:</p>' +
      "<p><pre>var request = nitroWebshot.render();</pre></p>"
    , { encoding: 'utf8' });


  });
}

module.exports = {
  server: runServer
};
