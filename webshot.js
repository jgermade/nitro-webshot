
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

require('colors');

function runServer (port, hostname) {

  port = port || 3000;
  hostname = hostname || '0.0.0.0';

  var baseUrl = `http://${hostname}:${port}`;

  var express = require('express')
  var app = express()
  var bodyParser = require('body-parser')
  var fs = require('fs')

  app.use(bodyParser.json({ limit: '5mb' })); // for parsing application/json
  app.use(bodyParser.urlencoded({ extended: true, limit: '5mb' })); // for parsing application/x-www-form-urlencoded

  app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });

  // app.get('/', function (req, res) {
  //   res.send('Hello World!')
  // })

  app.use(express.static('public'))

  app.post('/render', function (req, res) {
    var html = req.body.html.replace(/\s*<script[^>]*>([\s\S]*?)<\/script>\s*/g, '');
    var resultFile = uuid4() + ( req.body.filename ? ( '/' + req.body.filename ) : '.png' ),
        htmlFile = resultFile.replace(/\.[a-zA-Z]+$/, '.html')
    // renderJS = 'render-this-html.js';
    var renderScript = '/tmp/nitro-webshot/' + resultFile + '.js';

    var mkdirp = require('mkdirp');

    html = html.replace(/<\/head>/, `\n<style rel="stylesheet">
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

    fs.writeFileSync('last.html' , html, { encoding: 'utf8' });

    var htmlEscaped = html.replace(/'/g, '\\\'').replace(/\n/g, '');

    console.log('resultDir', dirname('public/renders/' + resultFile), resultFile );
    console.log('renderScriptDir', dirname(renderScript) );

    mkdirp( dirname('public/renders/' + resultFile), function (err) {
      if (err) {
        res.status(500).send('error creating output folder');
        return;
      }

      mkdirp( dirname(renderScript), function (err) {
        if (err) {
          res.status(500).send('error creating tmp script');
          return;
        }

        fs.writeFileSync(`public/renders/${htmlFile}`, html, { encoding: 'utf8' });

        // fs.writeFileSync(renderScript , `
        //   var page = require('webpage').create();
        //   page.viewportSize = { width: ${ req.body.width || 1360 }, height: ${ req.body.height || 900 } };
        //   page.content = '${ htmlEscaped }';
        //   setTimeout(function() {
        //     page.render('public/renders/${resultFile}');
        //     phantom.exit();
        //   }, ${ req.body.wait || 1000 });
        //   `, { encoding: 'utf8' });

        fs.writeFileSync(renderScript , `
          var page = require('webpage').create();
          page.viewportSize = { width: ${ req.body.width || 1360 }, height: ${ req.body.height || 900 } };
          page.open('${baseUrl}/renders/${htmlFile}', function(status) {
            console.log("Status: " + status);
            if(status === "success") {
              page.scrollPosition = {
                top: 100,
                left: 0
              };
              setTimeout(function() {
                page.render('public/renders/${resultFile}');
                phantom.exit();
              }, ${ req.body.wait || 1000 });
            }
          });
          `, { encoding: 'utf8' });

          require('child_process').exec('$(npm bin)/phantomjs ' + renderScript, function (err) {
            if( !err ) {
              res.json({
                file: '/renders/' + resultFile,
                htmlFile: `/renders/${htmlFile}`,
                html: html,
                htmlEscaped: htmlEscaped
              });
              // res.send(resultFile);
            } else {
              res.status(500).send('error rendering!');
            }
          });
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
