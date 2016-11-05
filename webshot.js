
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
var URL = require('url')

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

var fetch = function (url) {
  return $q(function (resolve, reject) {

    url = URL.parse(url);

    var options = {
      method: 'GET',
      hostname: url.hostname,
      port: url.port,
      path: url.path,
      encoding: null
    };

    options.method = 'GET';

    var data = null;
    // var data = [];

    var req = require(url.protocol.replace(/:$/, '')).request(options, (res) => {
      // console.log(`STATUS: ${res.statusCode}`);
      // console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
      // res.setEncoding('utf8');
      res.setEncoding('binary');

      res.on('data', (chunk) => {

        data = data ? data.concat(chunk) : chunk;
        // data.push(chunk);

      });

      res.on('end', () => {
        console.log('fetched', url.format() );
        resolve({ config: options, data: data });
        // resolve({ config: options, data: Buffer.concat(data) });
      });

      res.on('error', function(err) {
        console.log("Error during HTTP request");
        console.log(err.message);
        reject(err);
      });
    });

    req.on('error', (e) => {
      reject(e);
      // console.log(`problem with request: ${e.message}`);
    });

    req.end();

  });
}

fetch.responseData = function (response) { return response.data };

function fetchContentsCSS (css, origin, staticDir) {

  var replaces = [];

  css.replace(/url\(\s*["']?(.*?)["']?\s*\)/g, function (_matched, href) {
    if( /^data/.test(href) ) {
      return _matched;
    }

    console.log('matched css url', href);

    if( /^\//.test(href) ) {
      href = origin + href;
    }
    replaces.push( fetch( href ).then(function (response) {
      var filename = href.replace(/[?#].*/, '').replace(/[:/]+/g, '-');
      return file.write( 'public' + staticDir + filename, response.data )
        .then(function () {
          return { data: response.data, old: _matched, new: `url('${staticDir}${filename}')`, filename: filename };
        });
    }) );
    return _matched;
  });

  if( !replaces.length ) {
    return $q.resolve(css);
  }

  return $q.all(replaces).then(function (replaces) {
    replaces.forEach(function (item) {
      css = css.replace(item.old, item.new);
    });

    return css;
  });
}

function fetchContentsHTML (html, origin, staticDir) {

  var replaces = [];

  html.replace(/<(link|img)([^>]*)(href|src)="(.*?)"([^>]*)>/g, function (_matched, tag, pre, attr, href, post) {
    if( /^data/.test(href) ) {
      return _matched;
    }

    if( /^\//.test(href) ) {
      href = origin + href;
    }
    replaces.push( fetch( href ).then(function (response) {1
      var filename = href.replace(/[?#].*/, '').replace(/[:/]+/g, '-');

      return ( /\.css$/.test(filename) ? fetchContentsCSS('' + response.data, origin, staticDir) : $q.resolve(response.data) ).then(function (data) {
        return file.write( 'public' + staticDir + filename, data )
          .then(function () {
            return { data: data, old: _matched, new: `<${tag}${pre}${attr}="${staticDir}${filename}"${post}>`, filename: filename };
          });
      });

    }) );
    return _matched;
  });

  if( !replaces.length ) {
    return $q.resolve(html);
  }

  return $q.all(replaces).then(function (replaces) {
    replaces.forEach(function (item) {
      html = html.replace(item.old, item.new);
    });

    return html;
  });
}

// fetch('https://doomus.me').then(function (response) {
//   console.log('fetched data', response.data);
// });

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

// express.static.mime.define({
//  'application/x-font-woff': ['woff'],
//  'application/font-woff': ['woff']
// });

var mime = require('mime-types');

function runServer (port, hostname) {

  port = port || 3000;
  hostname = hostname || '0.0.0.0';

  var baseUrl = `http://${hostname}:${port}`;

  var app = express()

  app.use(bodyParser.json({ limit: '5mb' })); // for parsing application/json
  app.use(bodyParser.urlencoded({ extended: true, limit: '5mb' })); // for parsing application/x-www-form-urlencoded

  app.use(function(req, res, next) {
    if( !req.headers['content-type'] ) {
      if( /\.woff2?$/.test(req.path) ) {
        res.header("Content-Type", 'application/font-woff' );
      }
    }
    next();
  });

  app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });
  // app.use(function (req, res, next) {
  //
  //   // Website you wish to allow to connect
  //   res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8888');
  //
  //   // Request methods you wish to allow
  //   res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  //
  //   // Request headers you wish to allow
  //   res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
  //
  //   // Set to true if you need the website to include cookies in the requests sent
  //   // to the API (e.g. in case you use sessions)
  //   res.setHeader('Access-Control-Allow-Credentials', true);
  //
  //   // Pass to next layer of middleware
  //   next();
  // });

  app.use(express.static('public'))

  app.post('/api/render', function (req, res) {

    var html = req.body.html,
        referer = URL.parse(req.body.referer),
        origin = referer.protocol + '//' + referer.host;

    var id = uuid4(),
        resultFile = id + ( req.body.filename ? ( '/' + req.body.filename ) : '.png' ),
        htmlFile = resultFile.replace(/\.[a-zA-Z]+$/, '.html');

    var phantomScript = '/tmp/nitro-webshot/phantom-' + resultFile + '.js',
        slimerScript = '/tmp/nitro-webshot/slimer-' + resultFile + '.js';

    console.log('\n## CREATING FOLDERS \n');

    $q.all([
      file.write('last.html', html),
      file.mkdirp( 'public/shots/' + id + '/static' ),
      file.mkdirp( dirname('public/renders/phantom-' + resultFile) ),
      file.mkdirp( dirname('public/renders/slimer-' + resultFile) ),
      file.mkdirp( dirname(phantomScript) )
    ]).then(function () {

      console.log('\n## FETCHING CONTENTS \n');

      return fetchContentsHTML( htmlNoAnimations(htmlNoScripts(html)), origin, '/shots/' + id + '/static/' );

    }).then(function (htmlShot) {

      console.log('\n## WRITING SCRIPTS \n');

      return $q.all([
        file.write(`public/renders/${htmlFile}`, htmlShot),
        file.write( phantomScript, phantomjsCode(baseUrl, req.body, htmlFile, resultFile) ),
        file.write( slimerScript, slimerjsCode(baseUrl, req.body, htmlFile, resultFile) )
      ]).then(function () { return htmlShot; });

    }).then(function (htmlShot) {

      console.log('\n## LAUNCHING BROWSERS \n');

      $q.all([
        exec('$(npm bin)/phantomjs ' + phantomScript),
        exec('$(npm bin)/slimerjs ' + slimerScript)
      ]).then(function () {
        res.json({
          html: html,
          htmlShot: htmlShot,
          htmlFile: `/renders/${htmlFile}`,
          phantom: `/renders/phantom-${resultFile}`,
          slimer: `/renders/slimer-${resultFile}`
        });

        console.log('\n-----------------------------------------------------');
        console.log('\n## ' + 'RENDERED'.yellow );
        console.log('\n----------------------------------------------------- \n');
        console.log(`- ${'HTML'.yellow}: ${baseUrl}/renders/${htmlFile}`);
        console.log(`- phantom: ${baseUrl}/renders/phantom-${resultFile}`);
        console.log(`- slimer: ${baseUrl}/renders/slimer-${resultFile}`);
        console.log('\n----------------------------------------------------- \n');

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
